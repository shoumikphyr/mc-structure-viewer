'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { DatabaseSync } = require('node:sqlite');
const { normalizeEmail, validateNewPassword, hashPassword, verifyPassword, generateCode, hashCode, verifyCode } = require('./src/server/security');
const { sendSecurityCode } = require('./src/server/mailer');

const ROOT = __dirname;
const DATA_DIR = path.resolve(process.env.MC_VIEWER_DATA_DIR || path.join(ROOT, 'data'));
const UPLOAD_DIR = path.resolve(process.env.MC_VIEWER_UPLOAD_DIR || path.join(ROOT, 'storage', 'structures'));
const DB_FILE = path.resolve(process.env.MC_VIEWER_DB_FILE || path.join(DATA_DIR, 'mc-viewer.sqlite'));
const OWNER_CONFIG_FILE = path.join(DATA_DIR, 'owner.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_FORMATS = [
    { extension: '.png', type: 'image/png', matches: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { extension: '.jpg', type: 'image/jpeg', matches: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
    { extension: '.webp', type: 'image/webp', matches: buffer => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' }
];
const SESSION_DAYS = 30;
const OWNER_USER_ID = '5dab9040-1212-446c-84ff-db6b93501c67';
const OWNER_USERNAME = 'shoumikphyr';
const CHALLENGE_COOKIE = 'mc_viewer_challenge';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_RESEND_MS = 60 * 1000;
const scrypt = promisify(crypto.scrypt);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        creator_enabled INTEGER NOT NULL DEFAULT 0 CHECK (creator_enabled IN (0, 1)),
        email TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
        mfa_enabled INTEGER NOT NULL DEFAULT 0 CHECK (mfa_enabled IN (0, 1)),
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS structures (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        size_bytes INTEGER NOT NULL,
        uploaded_at TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS structures_owner_date ON structures(user_id, uploaded_at DESC);
    CREATE TABLE IF NOT EXISTS auth_challenges (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        email TEXT,
        code_salt TEXT,
        code_hash TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        sends INTEGER NOT NULL DEFAULT 0,
        last_sent_at INTEGER,
        expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS security_codes (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        target_email TEXT NOT NULL,
        code_salt TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        sends INTEGER NOT NULL DEFAULT 1,
        window_started_at INTEGER NOT NULL,
        last_sent_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
    );
`);
const userColumnNames = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
for (const [name, definition] of [
    ['role', "TEXT NOT NULL DEFAULT 'user'"],
    ['creator_enabled', 'INTEGER NOT NULL DEFAULT 0'],
    ['email', 'TEXT'],
    ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
    ['mfa_enabled', 'INTEGER NOT NULL DEFAULT 0']
]) {
    if (!userColumnNames.includes(name)) db.exec('ALTER TABLE users ADD COLUMN ' + name + ' ' + definition);
}
const sessionColumnNames = db.prepare('PRAGMA table_info(sessions)').all().map(column => column.name);
const addedMfaVerified = !sessionColumnNames.includes('mfa_verified');
if (addedMfaVerified) db.exec('ALTER TABLE sessions ADD COLUMN mfa_verified INTEGER NOT NULL DEFAULT 1');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email COLLATE NOCASE) WHERE email IS NOT NULL');

// The active owner is loaded by immutable ID. The initial ID remains the safe
// fallback; no role is promoted or account data changed during startup.
let activeOwnerUserId = OWNER_USER_ID;
try {
    const persistedOwner = JSON.parse(fs.readFileSync(OWNER_CONFIG_FILE, 'utf8')).ownerId;
    if (typeof persistedOwner === 'string'
        && /^[0-9a-f-]{36}$/i.test(persistedOwner)
        && db.prepare('SELECT 1 FROM users WHERE id = ?').get(persistedOwner)) {
        activeOwnerUserId = persistedOwner;
    }
} catch {}

// If the legacy MFA column is added, protect the account identified by ID,
// never whichever account happens to have the reserved username.
const principalAdmin = db.prepare('SELECT id FROM users WHERE id = ?').get(activeOwnerUserId);
if (addedMfaVerified && principalAdmin) {
    db.prepare('UPDATE sessions SET mfa_verified = 0 WHERE user_id = ?').run(principalAdmin.id);
}
const structureColumns = db.prepare('PRAGMA table_info(structures)').all();
if (!structureColumns.some(column => column.name === 'is_public')) {
    db.exec('ALTER TABLE structures ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1))');
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};
const authAttempts = new Map();
const DAY_MS = 24 * 60 * 60 * 1000;
const liveReloadClients = new Set();
let liveReloadTimer = null;

function notifyLiveReload() {
    clearTimeout(liveReloadTimer);
    liveReloadTimer = setTimeout(() => {
        liveReloadTimer = null;
        for (const client of liveReloadClients) {
            client.write('event: project-change\ndata: reload\n\n');
        }
    }, 400);
}

try {
    const watcher = fs.watch(ROOT, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const relativePath = filename.toString().replace(/\\/g, '/');
        const rootEntry = relativePath.split('/')[0].toLowerCase();
        const fileName = path.posix.basename(relativePath).toLowerCase();
        if (['data', 'storage', '.git', '.vscode'].includes(rootEntry)
            || fileName === 'server.js'
            || fileName.endsWith('.bat')
            || fileName.endsWith('.pid')) {
            return;
        }
        notifyLiveReload();
    });
    watcher.on('error', error => console.warn('No se pudo observar cambios para recarga en vivo:', error.message));
} catch (error) {
    console.warn('No se pudo activar la recarga en vivo:', error.message);
}

function serveLiveReloadEvents(req, res) {
    if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido.' });
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('retry: 1000\n\n');
    liveReloadClients.add(res);
    req.on('close', () => liveReloadClients.delete(res));
}

function json(res, status, payload, extraHeaders = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...extraHeaders
    });
    res.end(JSON.stringify(payload));
}

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
}

function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').map(part => {
        const separator = part.indexOf('=');
        if (separator < 0) return ['', ''];
        return [part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim())];
    }).filter(([key]) => key));
}

function sessionCookie(token, req, clear = false) {
    const secure = process.env.NODE_ENV === 'production' || req.socket.encrypted;
    return [
        `mc_viewer_session=${clear ? '' : encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        secure ? 'Secure' : '',
        clear ? 'Max-Age=0' : `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`
    ].filter(Boolean).join('; ');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function challengeCookie(token, req, clear = false) {
    const secure = process.env.NODE_ENV === 'production' || req.socket.encrypted;
    return [
        CHALLENGE_COOKIE + '=' + (clear ? '' : encodeURIComponent(token)),
        'Path=/',
        'HttpOnly',
        'SameSite=Strict',
        secure ? 'Secure' : '',
        clear ? 'Max-Age=0' : 'Max-Age=600'
    ].filter(Boolean).join('; ');
}

function clearChallengeCookie(req, res) {
    res.setHeader('Set-Cookie', [
        sessionCookie('', req, true),
        challengeCookie('', req, true)
    ]);
}

function safeUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: effectiveRole(user),
        creatorEnabled: effectiveRole(user) === 'admin' || Boolean(user.creator_enabled),
        email: user.email_verified ? user.email : null,
        emailVerified: Boolean(user.email_verified),
        mfaEnabled: Boolean(user.mfa_enabled || requiresPrivilegedMfa(user))
    };
}

function isOwner(user) {
    return Boolean(user && user.id === activeOwnerUserId);
}

function effectiveRole(user) {
    if (isOwner(user)) return 'admin';
    // An admin role outside the active owner is treated with subadmin scope;
    // owner status cannot be obtained by editing a role field.
    if (user?.role === 'admin') return 'subadmin';
    return user?.role || 'user';
}

function requiresPrivilegedMfa(user) {
    const role = effectiveRole(user);
    return role === 'admin' || role === 'subadmin';
}

function requireOwner(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (!isOwner(user)) {
        json(res, 403, { error: 'No tienes permiso para realizar esta operación.' });
        return null;
    }
    return user;
}

function requireAdmin(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (effectiveRole(user) !== 'admin') {
        json(res, 403, { error: 'No tienes permiso para realizar esta operación.' });
        return null;
    }
    return user;
}

function requireSubadmin(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    const role = effectiveRole(user);
    if (role !== 'admin' && role !== 'subadmin') {
        json(res, 403, { error: 'No tienes permiso para realizar esta operación.' });
        return null;
    }
    return user;
}

function getChallenge(req) {
    const token = parseCookies(req.headers.cookie)[CHALLENGE_COOKIE];
    if (!token) return null;
    const row = db.prepare('SELECT * FROM auth_challenges WHERE token_hash = ?').get(hashToken(token));
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
        db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(row.token_hash);
        return null;
    }
    return { ...row, token };
}

async function createAuthChallenge(userId, purpose, req, res) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + (purpose === 'email_setup' ? 10 : 5) * 60 * 1000;
    db.prepare('INSERT INTO auth_challenges(token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)')
        .run(tokenHash, userId, purpose, expiresAt);
    res.setHeader('Set-Cookie', challengeCookie(token, req));
    return { token, token_hash: tokenHash, user_id: userId, purpose, expires_at: expiresAt };
}

async function sendChallengeCode(challenge, email, purpose) {
    const code = generateCode();
    const hashed = await hashCode(code);
    const now = Date.now();
    const result = db.prepare('UPDATE auth_challenges SET email = ?, code_salt = ?, code_hash = ?, attempts = 0, sends = sends + 1, last_sent_at = ?, expires_at = ? WHERE token_hash = ? AND expires_at > ? AND sends < 5 AND (last_sent_at IS NULL OR last_sent_at <= ?)')
        .run(email, hashed.salt, hashed.hash, now, now + CHALLENGE_TTL_MS, challenge.token_hash, now, now - CODE_RESEND_MS);
    if (!result.changes) {
        const error = new Error('Solicitud de código limitada.');
        error.code = 'code_rate_limited';
        throw error;
    }
    await sendSecurityCode(email, code, purpose);
}

async function requestAccountCode(user, purpose, email) {
    const now = Date.now();
    const code = generateCode();
    const codeHash = await hashCode(code);
    let sends;
    let windowStarted;
    db.exec('BEGIN IMMEDIATE');
    try {
        const prior = db.prepare('SELECT * FROM security_codes WHERE user_id = ?').get(user.id);
        if (prior && prior.purpose === purpose && prior.last_sent_at > now - CODE_RESEND_MS) {
            db.exec('ROLLBACK');
            return { error: 'Espera un minuto antes de solicitar otro código.', status: 429 };
        }
        const sameWindow = prior && prior.purpose === purpose && prior.window_started_at > now - 60 * 60 * 1000;
        sends = sameWindow ? prior.sends + 1 : 1;
        if (sends > 5) {
            db.exec('ROLLBACK');
            return { error: 'Se alcanzó el límite de envío. Intenta de nuevo más tarde.', status: 429 };
        }
        windowStarted = sameWindow ? prior.window_started_at : now;
        db.prepare('INSERT INTO security_codes(user_id, purpose, target_email, code_salt, code_hash, attempts, sends, window_started_at, last_sent_at, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET purpose = excluded.purpose, target_email = excluded.target_email, code_salt = excluded.code_salt, code_hash = excluded.code_hash, attempts = 0, sends = excluded.sends, window_started_at = excluded.window_started_at, last_sent_at = excluded.last_sent_at, expires_at = excluded.expires_at')
            .run(user.id, purpose, email, codeHash.salt, codeHash.hash, sends, windowStarted, now, now + EMAIL_CODE_TTL_MS);
        db.exec('COMMIT');
    } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
    }
    try {
        await sendSecurityCode(email, code, purpose === 'mfa_enable' ? 'login' : 'email');
    } catch (error) {
        return { error: error.code === 'mail_not_configured' ? 'El envío de correo no está configurado.' : 'No se pudo enviar el código. Inténtalo más tarde.', status: 503 };
    }
    return { ok: true };
}

async function verifyAccountCode(user, purpose, inputCode) {
    const row = db.prepare('SELECT * FROM security_codes WHERE user_id = ? AND purpose = ?').get(user.id, purpose);
    if (!row || row.expires_at <= Date.now() || row.attempts >= CODE_MAX_ATTEMPTS) {
        if (row && (row.expires_at <= Date.now() || row.attempts >= CODE_MAX_ATTEMPTS)) db.prepare('DELETE FROM security_codes WHERE user_id = ?').run(user.id);
        return { ok: false, expired: true };
    }
    const valid = await verifyCode(inputCode, row.code_salt, row.code_hash);
    if (!valid) {
        db.prepare('UPDATE security_codes SET attempts = attempts + 1 WHERE user_id = ? AND purpose = ? AND attempts < ?').run(user.id, purpose, CODE_MAX_ATTEMPTS);
        const attempts = db.prepare('SELECT attempts FROM security_codes WHERE user_id = ?').get(user.id)?.attempts || CODE_MAX_ATTEMPTS;
        if (attempts >= CODE_MAX_ATTEMPTS) db.prepare('DELETE FROM security_codes WHERE user_id = ?').run(user.id);
        return { ok: false };
    }
    const consumed = db.prepare('DELETE FROM security_codes WHERE user_id = ? AND purpose = ? AND code_hash = ? AND expires_at > ? AND attempts < ?').run(user.id, purpose, row.code_hash, Date.now(), CODE_MAX_ATTEMPTS);
    if (!consumed.changes) return { ok: false, expired: true };
    return { ok: true, email: row.target_email };
}
function currentUser(req) {
    const token = parseCookies(req.headers.cookie).mc_viewer_session;
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = db.prepare('SELECT users.id, users.username, users.role, users.creator_enabled, users.email, users.email_verified, users.mfa_enabled, users.password_salt, users.password_hash, sessions.mfa_verified FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?')
        .get(tokenHash, Date.now());
    if (!row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    if (row && requiresPrivilegedMfa(row) && !row.mfa_verified) return null;
    return row || null;
}

function rateLimited(req) {
    const now = Date.now();
    const ip = req.socket.remoteAddress || 'unknown';
    const current = authAttempts.get(ip);
    if (!current || now - current.startedAt > 15 * 60 * 1000) {
        authAttempts.set(ip, { startedAt: now, count: 1 });
        return false;
    }
    current.count += 1;
    return current.count > 15;
}

function checkSameOrigin(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
        if (new URL(origin).host === req.headers.host) return true;
    } catch {}
    json(res, 403, { error: 'Solicitud de origen no permitido.' });
    return false;
}

async function readJson(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > 32 * 1024) {
            const error = new Error('La solicitud es demasiado grande.');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
        const error = new Error('El formato enviado no es válido.');
        error.status = 400;
        throw error;
    }
}

async function createSession(userId, req, res, mfaVerified = true) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = Date.now() + SESSION_DAYS * DAY_MS;
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, mfa_verified) VALUES (?, ?, ?, ?)')
        .run(tokenHash, userId, expiresAt, mfaVerified ? 1 : 0);
    res.setHeader('Set-Cookie', [sessionCookie(token, req), challengeCookie('', req, true)]);
}

function validateUsername(value) {
    const username = String(value || '').trim();
    if (!/^[\p{L}\p{N}._-]{3,20}$/u.test(username)) {
        return { error: 'El usuario debe tener entre 3 y 20 caracteres (letras, números, punto, guion o guion bajo).' };
    }
    const normalizedUsername = username.normalize('NFKC').toLocaleLowerCase('en-US');
    if (normalizedUsername === OWNER_USERNAME.normalize('NFKC').toLocaleLowerCase('en-US')) {
        return { error: 'Ese nombre de usuario está reservado.' };
    }
    return { username };
}

async function register(req, res) {
    if (rateLimited(req)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' });
    const input = await readJson(req);
    const validation = validateUsername(input.username);
    if (validation.error) return json(res, 400, { error: validation.error });
    const password = String(input.password || '');
    if (password.length < 8 || password.length > 128) {
        return json(res, 400, { error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
    }

    const salt = crypto.randomBytes(16);
    const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const id = crypto.randomUUID();
    try {
        db.prepare("INSERT INTO users(id, username, password_salt, password_hash, created_at, role) VALUES (?, ?, ?, ?, ?, 'user')")
            .run(id, validation.username, salt.toString('hex'), Buffer.from(derived).toString('hex'), new Date().toISOString());
    } catch (error) {
        if (String(error.message).includes('UNIQUE')) return json(res, 409, { error: 'Ese nombre de usuario ya está en uso.' });
        throw error;
    }
    await createSession(id, req, res);
    const user = db.prepare('SELECT id, username, role, creator_enabled, email, email_verified, mfa_enabled FROM users WHERE id = ?').get(id);
    json(res, 201, { user: safeUser(user) });
}

async function login(req, res) {
    if (rateLimited(req)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos y vuelve a probar.' });
    const input = await readJson(req);
    const username = String(input.username || '').trim();
    const user = db.prepare('SELECT id, username, role, creator_enabled, email, email_verified, mfa_enabled, password_salt, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user || !(await verifyPassword(input.password, user.password_salt, user.password_hash))) {
        return json(res, 401, { error: 'Usuario o contraseña incorrectos.' });
    }

    if (requiresPrivilegedMfa(user) || user.mfa_enabled) {
        if (!user.email || !user.email_verified) {
            if (!requiresPrivilegedMfa(user)) return json(res, 403, { error: 'Verifica un correo desde una sesión activa antes de usar la verificación en dos pasos.' });
            const challenge = await createAuthChallenge(user.id, 'email_setup', req, res);
            return json(res, 202, { emailSetupRequired: true, challengeExpiresInSeconds: 600 });
        }
        const challenge = await createAuthChallenge(user.id, 'login', req, res);
        try {
            await sendChallengeCode(challenge, user.email, 'login');
        } catch (error) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            if (error.code === 'code_rate_limited') return json(res, 429, { error: 'Espera un minuto antes de solicitar otro código.' });
            const message = error.code === 'mail_not_configured'
                ? 'El envío de correo no está configurado en el servidor.'
                : 'No se pudo enviar el código. Inténtalo más tarde.';
            return json(res, 503, { error: message });
        }
        return json(res, 202, { mfaRequired: true, challengeExpiresInSeconds: 300 });
    }

    await createSession(user.id, req, res, true);
    return json(res, 200, { user: safeUser(user) });
}

function safeDisplayName(rawName) {
    let value = String(rawName || '').replace(/\\/g, '/').split('/').pop().replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!value || value.length > 160) return null;
    const ext = path.extname(value).toLowerCase();
    if (ext !== '.schem' && ext !== '.litematic') return null;
    return value;
}

async function readUpload(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_UPLOAD_BYTES) {
            const error = new Error('Cada estructura puede pesar hasta 64 MB.');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    if (!size) {
        const error = new Error('El archivo está vacío.');
        error.status = 400;
        throw error;
    }
    return { buffer: Buffer.concat(chunks, size), size };
}

async function readCoverUpload(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_COVER_BYTES) {
            const error = new Error('La imagen puede pesar hasta 5 MB.');
            error.status = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    if (!size) {
        const error = new Error('El archivo de imagen está vacío.');
        error.status = 400;
        throw error;
    }
    const buffer = Buffer.concat(chunks, size);
    const format = COVER_FORMATS.find(candidate => candidate.matches(buffer));
    if (!format) {
        const error = new Error('Usa una imagen PNG, JPEG o WebP válida.');
        error.status = 415;
        throw error;
    }
    return { buffer, format };
}

async function findStructureCover(id) {
    for (const format of COVER_FORMATS) {
        const filePath = path.join(UPLOAD_DIR, id + format.extension);
        try {
            await fs.promises.access(filePath, fs.constants.R_OK);
            return { filePath, format };
        } catch {}
    }
    return null;
}

async function addCoverUrls(structures) {
    return Promise.all(structures.map(async structure => {
        if (!(await findStructureCover(structure.id))) return structure;
        return { ...structure, coverUrl: `/api/structures/${encodeURIComponent(structure.id)}/cover` };
    }));
}

function requireUser(req, res) {
    const user = currentUser(req);
    if (!user) json(res, 401, { error: 'Inicia sesión para continuar.' });
    return user;
}

async function handleApi(req, res, url) {
    const route = url.pathname;
    if (req.method === 'GET' && route === '/api/auth/me') {
        const user = currentUser(req);
        return json(res, 200, { user: user ? safeUser(user) : null });
    }

    if (route === '/api/account/creator-mode' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const role = effectiveRole(user);
        if (role === 'admin') return json(res, 400, { error: 'El propietario ya tiene acceso a las herramientas de creador.' });
        if (role !== 'user' && role !== 'subadmin') return json(res, 403, { error: 'El modo creador no cambia los permisos administrativos.' });
        const input = await readJson(req);
        if (typeof input.enabled !== 'boolean') return json(res, 400, { error: 'Indica si quieres activar o desactivar el modo creador.' });
        db.prepare("UPDATE users SET creator_enabled = ? WHERE id = ? AND role IN ('user', 'subadmin')").run(input.enabled ? 1 : 0, user.id);
        return json(res, 200, { role, creatorEnabled: input.enabled });
    }

    if (route === '/api/auth/register' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        return register(req, res);
    }

    if (route === '/api/auth/login' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        return login(req, res);
    }

    if (route === '/api/auth/logout' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const token = parseCookies(req.headers.cookie).mc_viewer_session;
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
        return json(res, 200, { ok: true }, { 'Set-Cookie': [sessionCookie('', req, true), challengeCookie('', req, true)] });
    }

    if (route === '/api/auth/cancel-challenge' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const challenge = getChallenge(req);
        if (challenge) db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
        res.setHeader('Set-Cookie', challengeCookie('', req, true));
        return json(res, 200, { ok: true });
    }
    if (route === '/api/auth/verify-code' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const challenge = getChallenge(req);
        if (!challenge || challenge.purpose !== 'login' || !challenge.code_hash) {
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        }
        const input = await readJson(req);
        if (challenge.attempts >= CODE_MAX_ATTEMPTS) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 429, { error: 'Se alcanzó el límite de intentos. Inicia sesión nuevamente.' });
        }
        const valid = await verifyCode(input.code, challenge.code_salt, challenge.code_hash);
        if (!valid) {
            db.prepare('UPDATE auth_challenges SET attempts = attempts + 1 WHERE token_hash = ? AND attempts < ?').run(challenge.token_hash, CODE_MAX_ATTEMPTS);
            const attempts = db.prepare('SELECT attempts FROM auth_challenges WHERE token_hash = ?').get(challenge.token_hash)?.attempts || CODE_MAX_ATTEMPTS;
            if (attempts >= CODE_MAX_ATTEMPTS) {
                db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
                res.setHeader('Set-Cookie', challengeCookie('', req, true));
            }
            return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        }
        const user = db.prepare('SELECT id, username, role, creator_enabled, email, email_verified, mfa_enabled FROM users WHERE id = ?').get(challenge.user_id);
        if (!user || !user.email_verified || (!requiresPrivilegedMfa(user) && !user.mfa_enabled)) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 401, { error: 'No se pudo completar el inicio de sesión.' });
        }
        const consumed = db.prepare('DELETE FROM auth_challenges WHERE token_hash = ? AND code_hash = ? AND expires_at > ? AND attempts < ?').run(challenge.token_hash, challenge.code_hash, Date.now(), CODE_MAX_ATTEMPTS);
        if (!consumed.changes) return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        res.setHeader('Set-Cookie', challengeCookie('', req, true));
        await createSession(user.id, req, res, true);
        return json(res, 200, { user: safeUser(user) });
    }

    if (route === '/api/auth/resend-code' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const challenge = getChallenge(req);
        if (!challenge || challenge.purpose !== 'login') return json(res, 401, { error: 'El proceso de inicio de sesión caducó.' });
        const now = Date.now();
        if (challenge.last_sent_at && challenge.last_sent_at > now - CODE_RESEND_MS) return json(res, 429, { error: 'Espera un minuto antes de solicitar otro código.' });
        if (challenge.sends >= 5) return json(res, 429, { error: 'Se alcanzó el límite de envío. Inicia sesión nuevamente más tarde.' });
        try {
            await sendChallengeCode(challenge, challenge.email, 'login');
            return json(res, 200, { sent: true });
        } catch (error) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, error.code === 'code_rate_limited' ? 429 : 503, { error: error.code === 'code_rate_limited' ? 'Espera un minuto antes de solicitar otro código.' : 'No se pudo enviar el código. Inténtalo más tarde.' });
        }
    }

    if (route === '/api/auth/setup-email/request' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const challenge = getChallenge(req);
        if (!challenge || challenge.purpose !== 'email_setup') return json(res, 401, { error: 'El proceso de configuración caducó. Inicia sesión nuevamente.' });
        const input = await readJson(req);
        const email = normalizeEmail(input.email);
        if (!email) return json(res, 400, { error: 'Escribe una dirección de correo válida.' });
        if (db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id <> ?').get(email, challenge.user_id)) {
            return json(res, 400, { error: 'No se pudo utilizar esa dirección. Compruébala e intenta otra.' });
        }
        const now = Date.now();
        if (challenge.last_sent_at && challenge.last_sent_at > now - CODE_RESEND_MS) return json(res, 429, { error: 'Espera un minuto antes de solicitar otro código.' });
        if (challenge.sends >= 5) return json(res, 429, { error: 'Se alcanzó el límite de envío. Intenta de nuevo más tarde.' });
        try {
            await sendChallengeCode(challenge, email, 'email');
            return json(res, 200, { sent: true, expiresInSeconds: 300 });
        } catch (error) {
            if (error.code === 'code_rate_limited') return json(res, 429, { error: 'Espera un minuto antes de solicitar otro código.' });
            const message = error.code === 'mail_not_configured'
                ? 'El envío de correo no está configurado en el servidor.'
                : 'No se pudo enviar el código. Inténtalo más tarde.';
            return json(res, 503, { error: message });
        }
    }

    if (route === '/api/auth/setup-email/verify' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const challenge = getChallenge(req);
        if (!challenge || challenge.purpose !== 'email_setup' || !challenge.code_hash || !challenge.email) {
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        }
        const input = await readJson(req);
        if (challenge.attempts >= CODE_MAX_ATTEMPTS) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 429, { error: 'Se alcanzó el límite de intentos. Inicia sesión nuevamente.' });
        }
        if (!(await verifyCode(input.code, challenge.code_salt, challenge.code_hash))) {
            db.prepare('UPDATE auth_challenges SET attempts = attempts + 1 WHERE token_hash = ? AND attempts < ?').run(challenge.token_hash, CODE_MAX_ATTEMPTS);
            const attempts = db.prepare('SELECT attempts FROM auth_challenges WHERE token_hash = ?').get(challenge.token_hash)?.attempts || CODE_MAX_ATTEMPTS;
            if (attempts >= CODE_MAX_ATTEMPTS) {
                db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
                res.setHeader('Set-Cookie', challengeCookie('', req, true));
            }
            return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        }
        const consumed = db.prepare('DELETE FROM auth_challenges WHERE token_hash = ? AND code_hash = ? AND expires_at > ? AND attempts < ?').run(challenge.token_hash, challenge.code_hash, Date.now(), CODE_MAX_ATTEMPTS);
        if (!consumed.changes) return json(res, 401, { error: 'El código no es válido o ha caducado.' });
        try {
            db.prepare('UPDATE users SET email = ?, email_verified = 1, mfa_enabled = 1 WHERE id = ?')
                .run(challenge.email, challenge.user_id);
        } catch (error) {
            db.prepare('DELETE FROM auth_challenges WHERE token_hash = ?').run(challenge.token_hash);
            res.setHeader('Set-Cookie', challengeCookie('', req, true));
            return json(res, 400, { error: 'No se pudo vincular esa dirección de correo.' });
        }
        const user = db.prepare('SELECT id, username, role, creator_enabled, email, email_verified, mfa_enabled FROM users WHERE id = ?').get(challenge.user_id);
        db.prepare('DELETE FROM auth_challenges WHERE user_id = ?').run(challenge.user_id);
        res.setHeader('Set-Cookie', challengeCookie('', req, true));
        await createSession(user.id, req, res, true);
        return json(res, 200, { user: safeUser(user) });
    }

    if (route === '/api/admin/users' && req.method === 'GET') {
        const user = requireSubadmin(req, res);
        if (!user) return;
        const users = db.prepare('SELECT id, username, role, creator_enabled FROM users ORDER BY username COLLATE NOCASE').all()
            .map(account => ({
                id: account.id,
                username: account.username,
                role: effectiveRole(account),
                creatorEnabled: effectiveRole(account) === 'admin' || Boolean(account.creator_enabled),
                isOwner: isOwner(account)
            }));
        return json(res, 200, { users, canManageRoles: isOwner(user) });
    }

    const managedRoleMatch = route.match(/^\/api\/admin\/users\/([0-9a-f-]{36})\/role$/i);
    if (managedRoleMatch && req.method === 'PATCH') {
        if (!checkSameOrigin(req, res)) return;
        const owner = requireOwner(req, res);
        if (!owner) return;
        const targetId = managedRoleMatch[1];
        if (targetId === activeOwnerUserId) return json(res, 403, { error: 'La cuenta propietaria está protegida.' });
        const input = await readJson(req);
        if (input.role !== 'user' && input.role !== 'subadmin') {
            return json(res, 400, { error: 'El rol permitido es user o subadmin. Admin se reserva para el propietario.' });
        }
        let result;
        try {
            db.exec('BEGIN IMMEDIATE');
            result = db.prepare('UPDATE users SET role = ? WHERE id = ? AND id <> ?')
                .run(input.role, targetId, activeOwnerUserId);
            if (result.changes && input.role === 'subadmin') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
            db.exec('COMMIT');
        } catch (error) {
            try { db.exec('ROLLBACK'); } catch {}
            throw error;
        }
        if (!result.changes) return json(res, 404, { error: 'No se encontró esa cuenta.' });
        return json(res, 200, { id: targetId, role: input.role });
    }

    if (route === '/api/admin/owner-transfer/request' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const owner = requireOwner(req, res);
        if (!owner) return;
        const input = await readJson(req);
        const target = db.prepare('SELECT id, role, email, email_verified FROM users WHERE id = ?').get(String(input.targetUserId || ''));
        if (!target || target.id === activeOwnerUserId || !['user', 'subadmin', 'admin'].includes(effectiveRole(target))) {
            return json(res, 400, { error: 'Selecciona una cuenta válida para transferir la propiedad.' });
        }
        if (!owner.email_verified || !owner.email) return json(res, 400, { error: 'Verifica un correo en la cuenta propietaria antes de transferirla.' });
        if (!(await verifyPassword(input.currentPassword, owner.password_salt, owner.password_hash))) {
            return json(res, 401, { error: 'No se pudo verificar la solicitud.' });
        }
        const result = await requestAccountCode(owner, 'owner_transfer:' + target.id, owner.email);
        if (result.error) return json(res, result.status, { error: result.error });
        return json(res, 200, { sent: true, expiresInSeconds: 300 });
    }

    if (route === '/api/admin/owner-transfer' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const owner = requireOwner(req, res);
        if (!owner) return;
        const input = await readJson(req);
        const target = db.prepare('SELECT id, username, role, email, email_verified FROM users WHERE id = ?').get(String(input.targetUserId || ''));
        if (!target || target.id === activeOwnerUserId || !['user', 'subadmin'].includes(effectiveRole(target))) {
            return json(res, 400, { error: 'Selecciona una cuenta válida para transferir la propiedad.' });
        }
        if (String(input.confirmation || '') !== 'TRANSFERIR ' + target.username) {
            return json(res, 400, { error: 'Escribe exactamente TRANSFERIR seguido del nombre de la cuenta elegida.' });
        }
        if (!target.email || !target.email_verified) return json(res, 400, { error: 'La cuenta elegida debe tener un correo verificado para completar el segundo factor.' });
        if (!(await verifyPassword(input.currentPassword, owner.password_salt, owner.password_hash))) {
            return json(res, 401, { error: 'No se pudo verificar la solicitud.' });
        }
        const verifiedCode = await verifyAccountCode(owner, 'owner_transfer:' + target.id, input.code);
        if (!verifiedCode.ok) return json(res, verifiedCode.expired ? 410 : 400, { error: 'El código no es válido o ha caducado.' });

        const previousOwnerId = activeOwnerUserId;
        const temporaryPath = OWNER_CONFIG_FILE + '.' + crypto.randomUUID() + '.tmp';
        try {
            await fs.promises.writeFile(temporaryPath, JSON.stringify({ ownerId: target.id }), { flag: 'wx' });
        } catch {
            await fs.promises.rm(temporaryPath, { force: true });
            return json(res, 500, { error: 'No se pudo preparar la transferencia. El propietario actual conserva el acceso.' });
        }
        let ownerFileReplaced = false;
        try {
            db.exec('BEGIN IMMEDIATE');
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run('subadmin', previousOwnerId);
            db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', target.id);
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
            fs.renameSync(temporaryPath, OWNER_CONFIG_FILE);
            ownerFileReplaced = true;
            db.exec('COMMIT');
            activeOwnerUserId = target.id;
        } catch (error) {
            try { db.exec('ROLLBACK'); } catch {}
            try { fs.rmSync(temporaryPath, { force: true }); } catch {}
            // If the file was replaced but commit failed, restore the last active owner.
            if (ownerFileReplaced) {
                try { fs.writeFileSync(OWNER_CONFIG_FILE, JSON.stringify({ ownerId: previousOwnerId })); } catch {}
            }
            return json(res, 500, { error: 'No se pudo completar la transferencia. El propietario actual conserva el acceso.' });
        }
        return json(res, 200, { transferred: true, owner: { id: target.id, username: target.username } });
    }

    if (route.startsWith('/api/admin/')) {
        if (!requireSubadmin(req, res)) return;
        return json(res, 404, { error: 'Ruta administrativa no encontrada.' });
    }

    if (route === '/api/security' && req.method === 'GET') {
        const user = requireUser(req, res);
        if (!user) return;
        return json(res, 200, { security: {
            email: user.email_verified ? user.email : null,
            emailVerified: Boolean(user.email_verified),
            mfaEnabled: Boolean(user.mfa_enabled || requiresPrivilegedMfa(user)),
            mfaRequired: requiresPrivilegedMfa(user)
        } });
    }

    if (route === '/api/security/email/request' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const input = await readJson(req);
        const email = normalizeEmail(input.email);
        if (!email) return json(res, 400, { error: 'Escribe una dirección de correo válida.' });
        if (!(await verifyPassword(input.currentPassword, user.password_salt, user.password_hash))) {
            return json(res, 401, { error: 'No se pudo verificar la solicitud.' });
        }
        if (db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id <> ?').get(email, user.id)) {
            return json(res, 400, { error: 'No se pudo utilizar esa dirección. Compruébala e intenta otra.' });
        }
        const result = await requestAccountCode(user, 'email_change', email);
        if (result.error) return json(res, result.status, { error: result.error });
        return json(res, 200, { sent: true, expiresInSeconds: 300 });
    }

    if (route === '/api/security/email/verify' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const input = await readJson(req);
        const result = await verifyAccountCode(user, 'email_change', input.code);
        if (!result.ok) return json(res, result.expired ? 410 : 400, { error: 'El código no es válido o ha caducado.' });
        try {
            db.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').run(result.email, user.id);
        } catch {
            return json(res, 400, { error: 'No se pudo vincular esa dirección. Solicita un código para otra.' });
        }
        return json(res, 200, { email: result.email, emailVerified: true });
    }

    if (route === '/api/security/mfa/request' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        if (requiresPrivilegedMfa(user)) return json(res, 400, { error: 'La verificación en dos pasos es obligatoria para esta cuenta.' });
        if (user.mfa_enabled) return json(res, 400, { error: 'La verificación en dos pasos ya está activada.' });
        if (!user.email_verified || !user.email) return json(res, 400, { error: 'Primero vincula y verifica un correo electrónico.' });
        const input = await readJson(req);
        if (!(await verifyPassword(input.currentPassword, user.password_salt, user.password_hash))) {
            return json(res, 401, { error: 'No se pudo verificar la solicitud.' });
        }
        const result = await requestAccountCode(user, 'mfa_enable', user.email);
        if (result.error) return json(res, result.status, { error: result.error });
        return json(res, 200, { sent: true, expiresInSeconds: 300 });
    }

    if (route === '/api/security/mfa/verify' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        if (requiresPrivilegedMfa(user)) return json(res, 400, { error: 'La verificación en dos pasos es obligatoria para esta cuenta.' });
        const input = await readJson(req);
        const result = await verifyAccountCode(user, 'mfa_enable', input.code);
        if (!result.ok) return json(res, result.expired ? 410 : 400, { error: 'El código no es válido o ha caducado.' });
        db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ? AND email_verified = 1').run(user.id);
        return json(res, 200, { mfaEnabled: true });
    }

    if (route === '/api/security/mfa/disable' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        if (requiresPrivilegedMfa(user)) return json(res, 400, { error: 'La verificación en dos pasos es obligatoria para esta cuenta.' });
        const input = await readJson(req);
        if (!(await verifyPassword(input.currentPassword, user.password_salt, user.password_hash))) {
            return json(res, 401, { error: 'No se pudo verificar la solicitud.' });
        }
        db.prepare('UPDATE users SET mfa_enabled = 0 WHERE id = ?').run(user.id);
        db.prepare('DELETE FROM security_codes WHERE user_id = ?').run(user.id);
        return json(res, 200, { mfaEnabled: false });
    }

    if (route === '/api/security/password' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const input = await readJson(req);
        if (!(await verifyPassword(input.currentPassword, user.password_salt, user.password_hash))) {
            return json(res, 401, { error: 'La contraseña actual es incorrecta.' });
        }
        const validation = validateNewPassword(input.newPassword);
        if (validation.error) return json(res, 400, { error: validation.error });
        if (validation.password !== String(input.confirmPassword || '')) return json(res, 400, { error: 'Las contraseñas nuevas no coinciden.' });
        const hashed = await hashPassword(validation.password);
        db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(hashed.salt, hashed.hash, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM auth_challenges WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM security_codes WHERE user_id = ?').run(user.id);
        return json(res, 200, { changed: true }, { 'Set-Cookie': [sessionCookie('', req, true), challengeCookie('', req, true)] });
    }
    if (route === '/api/public/structures' && req.method === 'GET') {
        const query = String(url.searchParams.get('q') || '').trim().slice(0, 100);
        const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
        const structures = db.prepare(`
            SELECT structures.id, structures.display_name AS name, structures.size_bytes AS size,
                   structures.uploaded_at AS uploadedAt, users.username
            FROM structures JOIN users ON users.id = structures.user_id
            WHERE structures.is_public = 1
              AND (? = '' OR structures.display_name LIKE ? ESCAPE '\\' OR users.username LIKE ? ESCAPE '\\')
            ORDER BY structures.uploaded_at DESC
            LIMIT 60
        `).all(query, pattern, pattern);
        return json(res, 200, { structures: await addCoverUrls(structures) });
    }

    const profileMatch = route.match(/^\/api\/profiles\/([^/]+)$/);
    if (profileMatch && req.method === 'GET') {
        let username;
        try { username = decodeURIComponent(profileMatch[1]); } catch { return json(res, 400, { error: 'El perfil no es válido.' }); }
        const user = db.prepare('SELECT id, username, creator_enabled FROM users WHERE username = ? COLLATE NOCASE').get(username);
        if (!user) return json(res, 404, { error: 'No se encontró ese perfil.' });
        const structures = db.prepare(`
            SELECT id, display_name AS name, size_bytes AS size, uploaded_at AS uploadedAt
            FROM structures WHERE user_id = ? AND is_public = 1
            ORDER BY uploaded_at DESC LIMIT 60
        `).all(user.id);
        return json(res, 200, { profile: { username: user.username, creatorEnabled: effectiveRole(user) === 'admin' || Boolean(user.creator_enabled), structures: await addCoverUrls(structures) } });
    }

    if (route === '/api/structures' && req.method === 'GET') {
        const user = requireUser(req, res);
        if (!user) return;
        const structures = db.prepare(`
            SELECT id, display_name AS name, size_bytes AS size, uploaded_at AS uploadedAt,
                   is_public AS isPublic
            FROM structures WHERE user_id = ? ORDER BY uploaded_at DESC
        `).all(user.id);
        return json(res, 200, { structures: await addCoverUrls(structures) });
    }

    if (route === '/api/structures' && req.method === 'POST') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const displayName = safeDisplayName(decodeURIComponent(String(req.headers['x-file-name'] || '')));
        if (!displayName) return json(res, 400, { error: 'Usa un archivo .schem o .litematic con un nombre válido.' });
        const isPublic = req.headers['x-structure-public'] === 'true' ? 1 : 0;
        const declaredSize = Number(req.headers['content-length'] || 0);
        if (declaredSize > MAX_UPLOAD_BYTES) return json(res, 413, { error: 'Cada estructura puede pesar hasta 64 MB.' });

        const { buffer, size } = await readUpload(req);
        const id = crypto.randomUUID();
        const ext = path.extname(displayName).toLowerCase();
        const storedName = `${id}${ext}`;
        await fs.promises.writeFile(path.join(UPLOAD_DIR, storedName), buffer, { flag: 'wx' });
        try {
            db.prepare('INSERT INTO structures(id, user_id, display_name, stored_name, size_bytes, uploaded_at, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(id, user.id, displayName, storedName, size, new Date().toISOString(), isPublic);
        } catch (error) {
            await fs.promises.rm(path.join(UPLOAD_DIR, storedName), { force: true });
            throw error;
        }
        return json(res, 201, { structure: { id, name: displayName, size, uploadedAt: new Date().toISOString() } });
    }

    const coverMatch = route.match(/^\/api\/structures\/([0-9a-f-]{36})\/cover$/i);
    if (coverMatch && req.method === 'GET') {
        const user = currentUser(req);
        const structure = db.prepare('SELECT user_id, is_public FROM structures WHERE id = ?').get(coverMatch[1]);
        if (!structure || (!structure.is_public && structure.user_id !== user?.id)) {
            return json(res, 404, { error: 'No se encontró esa imagen.' });
        }
        const cover = await findStructureCover(coverMatch[1]);
        if (!cover) return json(res, 404, { error: 'La imagen no está disponible.' });
        const stat = await fs.promises.stat(cover.filePath);
        res.writeHead(200, {
            'Content-Type': cover.format.type,
            'Content-Length': stat.size,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff'
        });
        return fs.createReadStream(cover.filePath).pipe(res);
    }

    if (coverMatch && req.method === 'PUT') {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const structure = db.prepare('SELECT id FROM structures WHERE id = ? AND user_id = ?').get(coverMatch[1], user.id);
        if (!structure) return json(res, 404, { error: 'No se encontró esa estructura en tu biblioteca.' });
        const { buffer, format } = await readCoverUpload(req);
        const targetPath = path.join(UPLOAD_DIR, coverMatch[1] + format.extension);
        const temporaryPath = path.join(UPLOAD_DIR, coverMatch[1] + '.' + crypto.randomUUID() + '.tmp');
        try {
            await fs.promises.writeFile(temporaryPath, buffer, { flag: 'wx' });
            await fs.promises.rename(temporaryPath, targetPath);
            for (const candidate of COVER_FORMATS) {
                if (candidate.extension !== format.extension) {
                    await fs.promises.rm(path.join(UPLOAD_DIR, coverMatch[1] + candidate.extension), { force: true });
                }
            }
        } catch (error) {
            await fs.promises.rm(temporaryPath, { force: true });
            throw error;
        }
        return json(res, 200, { ok: true });
    }

    const match = route.match(/^\/api\/structures\/([0-9a-f-]{36})(?:\/(download))?$/i);
    if (match && req.method === 'GET' && match[2] === 'download') {
        const user = currentUser(req);
        const structure = db.prepare('SELECT * FROM structures WHERE id = ?').get(match[1]);
        if (!structure || (!structure.is_public && structure.user_id !== user?.id)) {
            return json(res, 404, { error: 'No se encontró esa estructura.' });
        }
        const filePath = path.join(UPLOAD_DIR, structure.stored_name);
        try {
            const stat = await fs.promises.stat(filePath);
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Length': stat.size,
                'Content-Disposition': `attachment; filename="structure${path.extname(structure.display_name)}"; filename*=UTF-8''${encodeURIComponent(structure.display_name)}`,
                'X-File-Name': encodeURIComponent(structure.display_name),
                'Cache-Control': 'no-store'
            });
            return fs.createReadStream(filePath).pipe(res);
        } catch {
            return json(res, 404, { error: 'El archivo ya no está disponible.' });
        }
    }

    if (match && req.method === 'PATCH' && !match[2]) {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const input = await readJson(req);
        if (typeof input.isPublic !== 'boolean') return json(res, 400, { error: 'Indica si la estructura será pública.' });
        const result = db.prepare('UPDATE structures SET is_public = ? WHERE id = ? AND user_id = ?')
            .run(input.isPublic ? 1 : 0, match[1], user.id);
        if (!result.changes) return json(res, 404, { error: 'No se encontró esa estructura en tu biblioteca.' });
        return json(res, 200, { ok: true, isPublic: input.isPublic });
    }

    if (match && req.method === 'DELETE' && !match[2]) {
        if (!checkSameOrigin(req, res)) return;
        const user = requireUser(req, res);
        if (!user) return;
        const structure = db.prepare('SELECT * FROM structures WHERE id = ? AND user_id = ?').get(match[1], user.id);
        if (!structure) return json(res, 404, { error: 'No se encontró esa estructura en tu biblioteca.' });
        db.prepare('DELETE FROM structures WHERE id = ? AND user_id = ?').run(match[1], user.id);
        await fs.promises.rm(path.join(UPLOAD_DIR, structure.stored_name), { force: true });
        for (const format of COVER_FORMATS) await fs.promises.rm(path.join(UPLOAD_DIR, match[1] + format.extension), { force: true });
        return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: 'Ruta API no encontrada.' });
}

async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Método no permitido.' });
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return json(res, 400, { error: 'Ruta no válida.' });
    }
    if (pathname === '/') pathname = '/index.html';
    if (pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) {
        return json(res, 404, { error: 'No encontrado.' });
    }
    const filePath = path.resolve(ROOT, `.${pathname}`);
    const relativePath = path.relative(ROOT, filePath);
    const relativeSegments = relativePath.split(path.sep);
    if (path.isAbsolute(relativePath) || relativeSegments[0] === '..') return json(res, 404, { error: 'No encontrado.' });
    const firstSegment = (relativeSegments[0] || '').toLowerCase();
    if (firstSegment === 'data' || firstSegment === 'storage' || relativePath.toLowerCase() === 'server.js') {
        return json(res, 404, { error: 'No encontrado.' });
    }
    try {
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) return json(res, 404, { error: 'No encontrado.' });
        const extension = path.extname(filePath).toLowerCase();
        const isHtml = extension === '.html';
        let htmlBody = null;
        if (isHtml) {
            htmlBody = await fs.promises.readFile(filePath, 'utf8');
            const reloadScript = `<script>if(window.EventSource){const source=new EventSource('/__dev/events');source.addEventListener('project-change',()=>window.location.reload());}</script>`;
            const bodyClose = htmlBody.toLowerCase().lastIndexOf('</body>');
            htmlBody = bodyClose >= 0
                ? `${htmlBody.slice(0, bodyClose)}${reloadScript}${htmlBody.slice(bodyClose)}`
                : `${htmlBody}${reloadScript}`;
        }
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
            'Content-Length': isHtml ? Buffer.byteLength(htmlBody) : stat.size,
            'Cache-Control': 'no-cache'
        });
        if (req.method === 'HEAD') return res.end();
        if (isHtml) return res.end(htmlBody);
        fs.createReadStream(filePath).pipe(res);
    } catch {
        json(res, 404, { error: 'No encontrado.' });
    }
}

const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        if (url.pathname === '/__dev/events') return serveLiveReloadEvents(req, res);
        const lowerPath = url.pathname.toLowerCase();
        if (lowerPath === '/admin' || lowerPath.startsWith('/admin/')) {
            if (!requireAdmin(req, res)) return;
            return json(res, 404, { error: 'Panel administrativo no disponible.' });
        }
        if (lowerPath === '/admin.html') return json(res, 404, { error: 'No encontrado.' });
        if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
        return await serveStatic(req, res, url);
    } catch (error) {
        console.error('Solicitud fallida:', error);
        if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Ocurrió un error en el servidor.' });
        else res.destroy();
    }
});

server.listen(PORT, HOST, () => {
    console.log(`MC Viewer disponible en http://${HOST}:${PORT}`);
    console.log(`Base de datos: ${DB_FILE}`);
});

