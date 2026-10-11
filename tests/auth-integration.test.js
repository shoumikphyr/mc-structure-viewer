'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword, hashCode } = require('../src/server/security');

const root = path.resolve(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-viewer-security-'));
const dbPath = path.join(tempRoot, 'mc-viewer.sqlite');
const uploadPath = path.join(tempRoot, 'uploads');
const port = 43000 + crypto.randomInt(0, 10000);
const baseUrl = 'http://127.0.0.1:' + port;
const adminPassword = 'ExistingAdminTestPassword9';
const oldAdminToken = 'legacy-admin-session-token';
let serverProcess;
const adminCode = '735194';
let adminChallengeCookie = '';
let adminSessionCookie = '';
let normalSessionCookie = '';
const normalPassword = 'OrdinaryPassword9';
const normalUser = 'safetytestuser';

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}
function readCookie(response, name) {
    const rows = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie') || ''];
    const row = rows.find(value => value && value.startsWith(name + '='));
    return row ? row.split(';', 1)[0] : '';
}
async function request(route, options = {}, cookie = '') {
    const headers = new Headers(options.headers || {});
    if (cookie) headers.set('Cookie', cookie);
    return fetch(baseUrl + route, { ...options, headers });
}
async function post(route, payload, cookie = '') {
    return request(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, cookie);
}
async function seedOldDatabase() {
    const db = new DatabaseSync(dbPath);
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, role TEXT NOT NULL DEFAULT 'user', password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);");
    const admin = await hashPassword(adminPassword);
    db.prepare('INSERT INTO users(id, username, role, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run('5dab9040-1212-446c-84ff-db6b93501c67', 'shoumikphyr', 'admin', admin.salt, admin.hash, new Date().toISOString());
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(tokenHash(oldAdminToken), '5dab9040-1212-446c-84ff-db6b93501c67', Date.now() + 60000);
    db.close();
}
async function startServer() {
    await seedOldDatabase();
    serverProcess = spawn(process.execPath, [path.join(root, 'server.js')], {
        cwd: root,
        env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), MC_VIEWER_DATA_DIR: tempRoot, MC_VIEWER_UPLOAD_DIR: uploadPath, MC_VIEWER_DB_FILE: dbPath, SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '', SMTP_SECURE: 'false' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    serverProcess.stdout.on('data', chunk => { output += chunk.toString(); });
    serverProcess.stderr.on('data', chunk => { output += chunk.toString(); });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        if (serverProcess.exitCode !== null) throw new Error('Server exited: ' + output);
        try {
            const response = await fetch(baseUrl + '/api/auth/me');
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
    throw new Error('Server did not start: ' + output);
}
function testDb() {
    return new DatabaseSync(dbPath);
}

test('roles, MFA challenge, one-time codes, and password-change session revocation', async t => {
    await startServer();
    t.after(async () => {
        if (serverProcess && serverProcess.exitCode === null) serverProcess.kill();
        await new Promise(resolve => setTimeout(resolve, 150));
        fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    const migrationDb = testDb();
    assert.equal(migrationDb.prepare('SELECT COUNT(*) AS count FROM users WHERE username = ? COLLATE NOCASE').get('shoumikphyr').count, 1);
    assert.equal(migrationDb.prepare('SELECT role FROM users WHERE username = ?').get('shoumikphyr').role, 'admin');
    migrationDb.close();
    assert.equal((await request('/admin')).status, 401);
    assert.equal((await request('/admin.html')).status, 404);
    const oldAdminResponse = await request('/api/auth/me', {}, 'mc_viewer_session=' + oldAdminToken);
    assert.equal((await oldAdminResponse.json()).user, null);

    for (const reservedUsername of ['Shoumikphyr', 'Ｓｈｏｕｍｉｋｐｈｙｒ']) {
        const reserved = await post('/api/auth/register', { username: reservedUsername, password: normalPassword, role: 'admin' });
        assert.equal(reserved.status, 400);
    }

    const registered = await post('/api/auth/register', { username: normalUser, password: normalPassword, role: 'admin' });
    assert.equal(registered.status, 201);
    normalSessionCookie = readCookie(registered, 'mc_viewer_session');
    const normalMe = await request('/api/auth/me', {}, normalSessionCookie);
    const normalUserData = (await normalMe.json()).user;
    assert.equal(normalUserData.role, 'user');
    assert.equal(normalUserData.creatorEnabled, false);
    const creatorOn = await post('/api/account/creator-mode', { enabled: true, role: 'admin' }, normalSessionCookie);
    assert.equal(creatorOn.status, 200);
    assert.deepEqual(await creatorOn.json(), { role: 'user', creatorEnabled: true });
    const creatorProfile = await request('/api/profiles/' + encodeURIComponent(normalUser), {}, normalSessionCookie);
    assert.equal((await creatorProfile.json()).profile.creatorEnabled, true);
    const creatorOff = await post('/api/account/creator-mode', { enabled: false }, normalSessionCookie);
    assert.deepEqual(await creatorOff.json(), { role: 'user', creatorEnabled: false });
    assert.equal((await post('/api/account/creator-mode', { enabled: 'yes' }, normalSessionCookie)).status, 400);
    assert.equal((await request('/api/admin/example', {}, normalSessionCookie)).status, 403);
    const roleAccessDb = testDb();
    roleAccessDb.prepare("UPDATE users SET role = 'admin' WHERE username = ?").run(normalUser);
    roleAccessDb.close();
    assert.equal((await request('/api/admin/roles', {}, normalSessionCookie)).status, 404);
    assert.equal((await request('/api/admin/users/5dab9040-1212-446c-84ff-db6b93501c67/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'subadmin' })
    }, normalSessionCookie)).status, 403);
    const restoreRoleDb = testDb();
    restoreRoleDb.prepare("UPDATE users SET role = 'user' WHERE username = ?").run(normalUser);
    restoreRoleDb.close();
    assert.equal((await request('/admin', {}, normalSessionCookie)).status, 403);

    const passwordChange = await post('/api/security/password', { currentPassword: normalPassword, newPassword: 'NewOrdinaryPassword10', confirmPassword: 'NewOrdinaryPassword10' }, normalSessionCookie);
    assert.equal(passwordChange.status, 200);
    assert.equal((await (await request('/api/auth/me', {}, normalSessionCookie)).json()).user, null);
    assert.equal((await post('/api/auth/login', { username: normalUser, password: normalPassword })).status, 401);
    assert.equal((await post('/api/auth/login', { username: normalUser, password: 'NewOrdinaryPassword10' })).status, 200);

    const adminLogin = await post('/api/auth/login', { username: 'shoumikphyr', password: adminPassword });
    assert.equal(adminLogin.status, 202);
    assert.equal((await adminLogin.json()).emailSetupRequired, true);
    adminChallengeCookie = readCookie(adminLogin, 'mc_viewer_challenge');
    assert.ok(adminChallengeCookie);
    assert.equal((await (await request('/api/auth/me', {}, adminChallengeCookie)).json()).user, null);

    const mailUnavailable = await post('/api/auth/setup-email/request', { email: 'admin@company.example' }, adminChallengeCookie);
    assert.equal(mailUnavailable.status, 503);
    let db = testDb();
    let adminRow = db.prepare('SELECT email, email_verified FROM users WHERE username = ?').get('shoumikphyr');
    assert.equal(adminRow.email, null);
    assert.equal(adminRow.email_verified, 0);
    db.close();

    const challengeToken = decodeURIComponent(adminChallengeCookie.slice('mc_viewer_challenge='.length));
    const setupHash = await hashCode(adminCode);
    db = testDb();
    db.prepare('UPDATE auth_challenges SET purpose = ?, email = ?, code_salt = ?, code_hash = ?, attempts = 0, expires_at = ? WHERE token_hash = ?')
        .run('email_setup', 'admin@company.example', setupHash.salt, setupHash.hash, Date.now() + 300000, tokenHash(challengeToken));
    db.close();

    assert.equal((await post('/api/auth/setup-email/verify', { code: '000000' }, adminChallengeCookie)).status, 401);
    db = testDb();
    adminRow = db.prepare('SELECT email_verified FROM users WHERE username = ?').get('shoumikphyr');
    assert.equal(adminRow.email_verified, 0);
    db.close();

    const setupVerified = await post('/api/auth/setup-email/verify', { code: adminCode }, adminChallengeCookie);
    assert.equal(setupVerified.status, 200);
    adminSessionCookie = readCookie(setupVerified, 'mc_viewer_session');
    assert.ok(adminSessionCookie);
    const ownerMe = (await (await request('/api/auth/me', {}, adminSessionCookie)).json()).user;
    assert.equal(ownerMe.id, '5dab9040-1212-446c-84ff-db6b93501c67');
    assert.equal(ownerMe.role, 'admin');
    assert.equal(ownerMe.creatorEnabled, true);
    assert.equal((await request('/api/admin/example', {}, adminSessionCookie)).status, 404);
    assert.equal((await request('/api/admin/roles', {}, adminSessionCookie)).status, 404);

    const ownerUsersResponse = await request('/api/admin/users', {}, adminSessionCookie);
    assert.equal(ownerUsersResponse.status, 200);
    let ownerUsers = await ownerUsersResponse.json();
    assert.equal(ownerUsers.canManageRoles, true);
    const ownerAccount = ownerUsers.users.find(account => account.id === ownerMe.id);
    assert.equal(ownerAccount.role, 'admin');
    assert.equal(ownerAccount.isOwner, true);

    // Ownership follows the immutable ID, not the reserved handle.
    db = testDb();
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run('renamed-owner-test', ownerMe.id);
    db.close();
    assert.equal((await (await request('/api/auth/me', {}, adminSessionCookie)).json()).user.role, 'admin');
    db = testDb();
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run('shoumikphyr', ownerMe.id);
    db.close();

    const candidate = ownerUsers.users.find(account => account.username === normalUser);
    assert.ok(candidate);
    assert.equal((await request('/api/admin/users/' + ownerMe.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'subadmin' })
    }, adminSessionCookie)).status, 403);
    assert.equal((await request('/api/admin/users/' + candidate.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin' })
    }, adminSessionCookie)).status, 400);
    assert.equal((await request('/api/admin/users/' + candidate.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'subadmin' })
    }, normalSessionCookie)).status, 401);
    const promoted = await request('/api/admin/users/' + candidate.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'subadmin' })
    }, adminSessionCookie);
    assert.equal(promoted.status, 200);
    assert.equal((await (await request('/api/auth/me', {}, normalSessionCookie)).json()).user, null);

    const delegatedToken = crypto.randomBytes(32).toString('base64url');
    db = testDb();
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, mfa_verified) VALUES (?, ?, ?, 1)')
        .run(tokenHash(delegatedToken), candidate.id, Date.now() + 60000);
    db.close();
    const delegatedCookie = 'mc_viewer_session=' + delegatedToken;
    const delegatedUsers = await request('/api/admin/users', {}, delegatedCookie);
    assert.equal(delegatedUsers.status, 200);
    assert.equal((await delegatedUsers.json()).canManageRoles, false);
    assert.equal((await request('/api/admin/users/' + candidate.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user' })
    }, delegatedCookie)).status, 403);
    assert.equal((await post('/api/admin/owner-transfer/request', {}, delegatedCookie)).status, 403);
    assert.equal((await request('/api/admin/owner-transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, delegatedCookie)).status, 403);

    assert.equal((await request('/api/admin/users/' + candidate.id + '/role', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user' })
    }, adminSessionCookie)).status, 200);

    // The one-time MFA code and owner-file transfer are exercised only against this temporary fixture.
    db = testDb();
    db.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').run('candidate@example.test', candidate.id);
    const transferHash = await hashCode('804216');
    db.prepare('INSERT INTO security_codes(user_id, purpose, target_email, code_salt, code_hash, attempts, sends, window_started_at, last_sent_at, expires_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)')
        .run(ownerMe.id, 'owner_transfer:' + candidate.id, 'admin@company.example', transferHash.salt, transferHash.hash, Date.now(), Date.now(), Date.now() + 300000);
    db.close();
    const transfer = await post('/api/admin/owner-transfer', {
        targetUserId: candidate.id,
        currentPassword: adminPassword,
        code: '804216',
        confirmation: 'TRANSFERIR ' + normalUser
    }, adminSessionCookie);
    assert.equal(transfer.status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(tempRoot, 'owner.json'), 'utf8')).ownerId, candidate.id);
    const oldOwnerStillAdmin = await request('/api/admin/users', {}, adminSessionCookie);
    assert.equal(oldOwnerStillAdmin.status, 200);
    assert.equal((await oldOwnerStillAdmin.json()).canManageRoles, false);
    const newOwnerToken = crypto.randomBytes(32).toString('base64url');
    db = testDb();
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at, mfa_verified) VALUES (?, ?, ?, 1)')
        .run(tokenHash(newOwnerToken), candidate.id, Date.now() + 60000);
    db.close();
    const newOwnerResponse = await request('/api/admin/users', {}, 'mc_viewer_session=' + newOwnerToken);
    assert.equal(newOwnerResponse.status, 200);
    assert.equal((await newOwnerResponse.json()).canManageRoles, true);

    const smtpUnavailableLogin = await post('/api/auth/login', { username: 'shoumikphyr', password: adminPassword });
    assert.equal(smtpUnavailableLogin.status, 503);
    assert.equal((await (await request('/api/auth/me')).json()).user, null);
    assert.equal((await post('/api/auth/setup-email/verify', { code: adminCode }, adminChallengeCookie)).status, 401);

    const challengeToken2 = 'login-challenge-expired-test';
    const loginHash = await hashCode(adminCode);
    db = testDb();
    db.prepare('INSERT INTO auth_challenges(token_hash, user_id, purpose, email, code_salt, code_hash, attempts, sends, last_sent_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)')
        .run(tokenHash(challengeToken2), '5dab9040-1212-446c-84ff-db6b93501c67', 'login', 'admin@company.example', loginHash.salt, loginHash.hash, Date.now(), Date.now() + 300000);
    db.close();
    const challengeCookie2 = 'mc_viewer_challenge=' + challengeToken2;
    assert.equal((await (await request('/api/auth/me', {}, challengeCookie2)).json()).user, null);
    assert.equal((await post('/api/auth/verify-code', { code: '000000' }, challengeCookie2)).status, 401);
    db = testDb();
    db.prepare('UPDATE auth_challenges SET expires_at = ? WHERE token_hash = ?').run(Date.now() - 1, tokenHash(challengeToken2));
    db.close();
    assert.equal((await post('/api/auth/verify-code', { code: adminCode }, challengeCookie2)).status, 401);

    const challengeToken3 = 'login-challenge-reuse-test';
    const reusableHash = await hashCode(adminCode);
    db = testDb();
    db.prepare('INSERT INTO auth_challenges(token_hash, user_id, purpose, email, code_salt, code_hash, attempts, sends, last_sent_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)')
        .run(tokenHash(challengeToken3), '5dab9040-1212-446c-84ff-db6b93501c67', 'login', 'admin@company.example', reusableHash.salt, reusableHash.hash, Date.now(), Date.now() + 300000);
    db.close();
    const challengeCookie3 = 'mc_viewer_challenge=' + challengeToken3;
    const validCode = await post('/api/auth/verify-code', { code: adminCode }, challengeCookie3);
    assert.equal(validCode.status, 200);
    const verifiedSession = readCookie(validCode, 'mc_viewer_session');
    assert.ok(verifiedSession);
    assert.equal((await post('/api/auth/verify-code', { code: adminCode }, challengeCookie3)).status, 401);
    const verifiedAdmin = (await (await request('/api/auth/me', {}, verifiedSession)).json()).user;
    assert.equal(verifiedAdmin.role, 'subadmin');
    assert.equal(verifiedAdmin.creatorEnabled, false);
    assert.equal((await post('/api/account/creator-mode', { enabled: true }, verifiedSession)).status, 200);
});
