import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isHostAllowed } from '../src/server/isHostAllowed.js';

describe('isHostAllowed', () => {
    it('returns false when request host header is missing or empty', () => {
        assert.strictEqual(isHostAllowed(undefined, undefined), false);
        assert.strictEqual(isHostAllowed('', undefined), false);
    });

    it('allows default localhost addresses when allowedHosts is undefined', () => {
        assert.strictEqual(isHostAllowed('localhost', undefined), true);
        assert.strictEqual(isHostAllowed('localhost:25173', undefined), true);
        assert.strictEqual(isHostAllowed('127.0.0.1:25173', undefined), true);
        assert.strictEqual(isHostAllowed('[::1]:25173', undefined), true);
        assert.strictEqual(isHostAllowed('::1', undefined), true);
    });

    it('allows all raw IPv4 and IPv6 addresses by default', () => {
        assert.strictEqual(isHostAllowed('192.168.1.100:25173', undefined), true);
        assert.strictEqual(isHostAllowed('10.0.0.5', undefined), true);
        assert.strictEqual(isHostAllowed('172.17.0.2:8080', undefined), true);
        assert.strictEqual(isHostAllowed('[2001:db8::1]:25173', undefined), true);
    });

    it('rejects unauthorized external domain host headers by default', () => {
        assert.strictEqual(isHostAllowed('attacker.com', undefined), false);
        assert.strictEqual(isHostAllowed('attacker.com:25173', undefined), false);
        assert.strictEqual(isHostAllowed('example.org', undefined), false);
    });

    it('allows all host headers when allowedHosts is true', () => {
        assert.strictEqual(isHostAllowed('attacker.com', true), true);
        assert.strictEqual(isHostAllowed('custom.local:1234', true), true);
    });

    it('allows specific host string or array of host strings', () => {
        assert.strictEqual(isHostAllowed('custom.local:25173', 'custom.local'), true);
        assert.strictEqual(isHostAllowed('other.local:25173', 'custom.local'), false);

        const allowedList = ['app.local', '.example.com'];
        assert.strictEqual(isHostAllowed('app.local:25173', allowedList), true);
        assert.strictEqual(isHostAllowed('sub.example.com:80', allowedList), true);
        assert.strictEqual(isHostAllowed('example.com', allowedList), true);
        assert.strictEqual(isHostAllowed('unauthorized.org', allowedList), false);
    });

    it('allows matching against bound serverHost when provided', () => {
        assert.strictEqual(isHostAllowed('my-custom-host:25173', undefined, 'my-custom-host'), true);
    });

    it('handles wildcard host patterns correctly', () => {
        assert.strictEqual(isHostAllowed('anyhost.com', '*'), true);
        assert.strictEqual(isHostAllowed('test.dev.local', '*.dev.local'), true);
    });
});
