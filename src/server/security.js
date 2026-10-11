'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { domainToASCII } = require('node:url');

const scrypt = promisify(crypto.scrypt);
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function normalizeEmail(value) {
    const input = String(value || '').trim();
    if (input.length > 254 || /[\r\n\t\s]/u.test(input)) return null;
    const at = input.lastIndexOf('@');
    if (at < 1 || at !== input.indexOf('@')) return null;
    const local = input.slice(0, at);
    const rawDomain = input.slice(at + 1);
    if (local.length > 64 || rawDomain.length > 253 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_\x60{|}~-]+$/u.test(local)) return null;

    const domain = domainToASCII(rawDomain.toLowerCase());
    if (!domain || domain.length > 253) return null;
    const labels = domain.split('.');
    if (labels.some(label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label))) return null;
    return local + '@' + domain;
}

function validateNewPassword(value) {
    const password = String(value || '');
    if (password.length < 12 || password.length > 128) {
        return { error: 'La contraseña nueva debe tener entre 12 y 128 caracteres.' };
    }
    if (!/[A-Za-z]/u.test(password) || !/[0-9]/u.test(password)) {
        return { error: 'La contraseña nueva debe incluir al menos una letra y un número.' };
    }
    return { password };
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derived = await scrypt(String(password), salt, 64, SCRYPT_OPTIONS);
    return { salt: salt.toString('hex'), hash: Buffer.from(derived).toString('hex') };
}

async function verifyPassword(password, saltHex, hashHex) {
    if (!/^[0-9a-f]{32}$/iu.test(String(saltHex)) || !/^[0-9a-f]{128}$/iu.test(String(hashHex))) return false;
    const candidate = Buffer.from(await scrypt(String(password || ''), Buffer.from(saltHex, 'hex'), 64, SCRYPT_OPTIONS));
    const expected = Buffer.from(hashHex, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function generateCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

async function hashCode(code) {
    const salt = crypto.randomBytes(16);
    const derived = await scrypt(String(code), salt, 32, SCRYPT_OPTIONS);
    return { salt: salt.toString('hex'), hash: Buffer.from(derived).toString('hex') };
}

async function verifyCode(code, saltHex, hashHex) {
    if (!/^\d{6}$/u.test(String(code || '')) || !/^[0-9a-f]{32}$/iu.test(String(saltHex)) || !/^[0-9a-f]{64}$/iu.test(String(hashHex))) return false;
    const candidate = Buffer.from(await scrypt(String(code), Buffer.from(saltHex, 'hex'), 32, SCRYPT_OPTIONS));
    const expected = Buffer.from(hashHex, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

module.exports = { normalizeEmail, validateNewPassword, hashPassword, verifyPassword, generateCode, hashCode, verifyCode };