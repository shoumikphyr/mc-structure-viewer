'use strict';

const net = require('node:net');
const tls = require('node:tls');
const { normalizeEmail } = require('./security');

const MAIL_TIMEOUT_MS = 12000;

class SmtpReplies {
    constructor(socket) {
        this.socket = socket;
        this.buffer = '';
        this.pendingLines = [];
        this.expectedCode = null;
        this.replies = [];
        this.waiters = [];
        this.onData = chunk => this.consume(chunk);
        this.onError = () => this.fail();
        this.onClose = () => this.fail();
        socket.on('data', this.onData);
        socket.on('error', this.onError);
        socket.on('close', this.onClose);
    }

    consume(chunk) {
        this.buffer += chunk.toString('utf8');
        let boundary;
        while ((boundary = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, boundary).replace(/\r$/u, '');
            this.buffer = this.buffer.slice(boundary + 1);
            const match = line.match(/^(\d{3})([ -])/u);
            if (!match) continue;
            const code = Number(match[1]);
            if (this.expectedCode !== null && code !== this.expectedCode) {
                this.pendingLines = [];
                this.expectedCode = null;
            }
            this.pendingLines.push(line);
            if (match[2] === ' ') {
                const reply = { code, lines: this.pendingLines };
                this.pendingLines = [];
                this.expectedCode = null;
                this.deliver(reply);
            } else {
                this.expectedCode = code;
            }
        }
    }

    deliver(reply) {
        const waiter = this.waiters.shift();
        if (waiter) waiter.resolve(reply);
        else this.replies.push(reply);
    }

    fail() {
        while (this.waiters.length) this.waiters.shift().reject(new Error('SMTP connection failed'));
    }

    read() {
        if (this.replies.length) return Promise.resolve(this.replies.shift());
        return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    }

    detach() {
        this.socket.removeListener('data', this.onData);
        this.socket.removeListener('error', this.onError);
        this.socket.removeListener('close', this.onClose);
    }
}

function smtpError() {
    const error = new Error('No se pudo completar el envío SMTP.');
    error.code = 'smtp_send_failed';
    return error;
}

function configuredSettings() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const user = String(process.env.SMTP_USER || '');
    const pass = String(process.env.SMTP_PASS || '');
    const from = normalizeEmail(process.env.SMTP_FROM);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
        const error = new Error('El servicio de correo no está configurado.');
        error.code = 'mail_not_configured';
        throw error;
    }
    return { host, port, user, pass, from, secure };
}

async function connectSocket(settings) {
    return new Promise((resolve, reject) => {
        const socket = settings.secure
            ? tls.connect({ host: settings.host, port: settings.port, servername: settings.host, rejectUnauthorized: true })
            : net.connect({ host: settings.host, port: settings.port });
        const timer = setTimeout(() => {
            socket.destroy();
            reject(new Error('SMTP timeout'));
        }, MAIL_TIMEOUT_MS);
        socket.setTimeout(MAIL_TIMEOUT_MS, () => socket.destroy(new Error('SMTP timeout')));
        const event = settings.secure ? 'secureConnect' : 'connect';
        socket.once(event, () => {
            clearTimeout(timer);
            resolve(socket);
        });
        socket.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
    });
}

async function startTls(socket, channel, host) {
    channel.detach();
    socket.pause();
    const secureSocket = await new Promise((resolve, reject) => {
        const wrapped = tls.connect({ socket, servername: host, rejectUnauthorized: true });
        const timer = setTimeout(() => {
            wrapped.destroy();
            reject(new Error('SMTP TLS timeout'));
        }, MAIL_TIMEOUT_MS);
        wrapped.once('secureConnect', () => {
            clearTimeout(timer);
            wrapped.resume();
            resolve(wrapped);
        });
        wrapped.once('error', error => {
            clearTimeout(timer);
            reject(error);
        });
    });
    return { socket: secureSocket, channel: new SmtpReplies(secureSocket) };
}

async function command(channel, socket, value, accepted) {
    socket.write(value + '\r\n');
    const reply = await channel.read();
    if (!accepted.includes(reply.code)) throw new Error('SMTP rejected command');
    return reply;
}

function encodeHeader(value) {
    return '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
}

function buildMessage(settings, address, code, purpose) {
    const safePurpose = purpose === 'login' ? 'Inicio de sesión' : 'Verificación de correo';
    const subject = 'Código de seguridad de MC Viewer';
    const body = [
        'Tu código para ' + safePurpose.toLowerCase() + ' es: ' + code,
        '',
        'El código vence en cinco minutos y solo puede utilizarse una vez.',
        'Si no solicitaste este código, puedes ignorar este mensaje.'
    ].join('\r\n');
    return [
        'From: <' + settings.from + '>',
        'To: <' + address + '>',
        'Subject: ' + encodeHeader(subject),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'Date: ' + new Date().toUTCString(),
        '',
        body
    ].join('\r\n').replace(/(^|\r\n)\./gu, '$1..');
}

async function sendSecurityCode(address, code, purpose) {
    const settings = configuredSettings();
    const recipient = normalizeEmail(address);
    if (!recipient) throw smtpError();
    let socket;
    let channel;
    try {
        socket = await connectSocket(settings);
        channel = new SmtpReplies(socket);
        const greeting = await channel.read();
        if (greeting.code !== 220) throw new Error('SMTP greeting failed');
        await command(channel, socket, 'EHLO mc-structure-viewer.local', [250]);

        if (!settings.secure) {
            await command(channel, socket, 'STARTTLS', [220]);
            const upgraded = await startTls(socket, channel, settings.host);
            socket = upgraded.socket;
            channel = upgraded.channel;
            await command(channel, socket, 'EHLO mc-structure-viewer.local', [250]);
        }

        const auth = Buffer.from('\0' + settings.user + '\0' + settings.pass, 'utf8').toString('base64');
        try {
            await command(channel, socket, 'AUTH PLAIN ' + auth, [235]);
        } catch {
            await command(channel, socket, 'AUTH LOGIN', [334]);
            await command(channel, socket, Buffer.from(settings.user, 'utf8').toString('base64'), [334]);
            await command(channel, socket, Buffer.from(settings.pass, 'utf8').toString('base64'), [235]);
        }
        await command(channel, socket, 'MAIL FROM:<' + settings.from + '>', [250]);
        await command(channel, socket, 'RCPT TO:<' + recipient + '>', [250, 251]);
        await command(channel, socket, 'DATA', [354]);
        socket.write(buildMessage(settings, recipient, code, purpose) + '\r\n.\r\n');
        const sent = await channel.read();
        if (sent.code !== 250) throw new Error('SMTP message rejected');
        try { await command(channel, socket, 'QUIT', [221]); } catch {}
        socket.end();
    } catch {
        if (socket && !socket.destroyed) socket.destroy();
        throw smtpError();
    }
}

module.exports = { sendSecurityCode };