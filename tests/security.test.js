'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, validateNewPassword, hashCode, verifyCode } = require('../src/server/security');

test('accepts common, institutional, and arbitrary email domains without an allowlist', () => {
    assert.equal(normalizeEmail('person@gmail.com'), 'person@gmail.com');
    assert.equal(normalizeEmail('person@outlook.com'), 'person@outlook.com');
    assert.equal(normalizeEmail('person@school.example'), 'person@school.example');
    assert.equal(normalizeEmail('person@arbitrary-company.test'), 'person@arbitrary-company.test');
    assert.equal(normalizeEmail('person@sub.department.example'), 'person@sub.department.example');
});
test('rejects malformed email addresses without relying on provider domains', () => {
    for (const value of ['', 'person', 'person@@domain.test', 'person@bad domain.test', '.person@domain.test', 'person@-bad.test']) assert.equal(normalizeEmail(value), null, value);
});
test('requires a reasonable new password and salted one-time-code hashes', async () => {
    assert.ok(validateNewPassword('long-password-9').password);
    assert.ok(validateNewPassword('short9').error);
    const first = await hashCode('123456');
    const second = await hashCode('123456');
    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.hash, '123456');
    assert.equal(await verifyCode('123456', first.salt, first.hash), true);
    assert.equal(await verifyCode('000000', first.salt, first.hash), false);
});