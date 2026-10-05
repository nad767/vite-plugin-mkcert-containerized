import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_HOST } from '../src/consts.js';
import { resolveHost } from '../src/server/resolveHost.js';

describe('resolveHost', () => {
    it('returns DEFAULT_HOST boundHost and localhost displayHost when host input is undefined', () => {
        // Test undefined host input returns DEFAULT_HOST boundHost and localhost displayHost.
        assert.deepEqual(resolveHost(undefined), { boundHost: DEFAULT_HOST, displayHost: 'localhost' });
    });

    it('returns "0.0.0.0" boundHost and "localhost" displayHost when host input is true', () => {
        // Test boolean true host resolves to '0.0.0.0' boundHost and 'localhost' displayHost.
        assert.deepEqual(resolveHost(true), { boundHost: '0.0.0.0', displayHost: 'localhost' });
    });

    it('returns "127.0.0.1" for both boundHost and displayHost when host input is false', () => {
        // Test boolean false host resolves to '127.0.0.1'.
        assert.deepEqual(resolveHost(false), { boundHost: '127.0.0.1', displayHost: '127.0.0.1' });
    });

    it('returns trimmed host string when host is a valid non-empty string', () => {
        // Test string host values are preserved and trimmed.
        assert.deepEqual(resolveHost('192.168.1.10'), { boundHost: '192.168.1.10', displayHost: '192.168.1.10' });
        assert.deepEqual(resolveHost('  localhost  '), { boundHost: 'localhost', displayHost: 'localhost' });
    });

    it('formats unbracketed IPv6 addresses with brackets for displayHost', () => {
        // Test IPv6 address formatting.
        assert.deepEqual(resolveHost('::1'), { boundHost: '::1', displayHost: '[::1]' });
        assert.deepEqual(resolveHost('[::1]'), { boundHost: '::1', displayHost: '[::1]' });
    });

    it('returns DEFAULT_HOST boundHost and localhost displayHost when host string is empty or whitespace only', () => {
        // Test empty string fallback to DEFAULT_HOST.
        assert.deepEqual(resolveHost(''), { boundHost: DEFAULT_HOST, displayHost: 'localhost' });
        assert.deepEqual(resolveHost(' '.repeat(3)), { boundHost: DEFAULT_HOST, displayHost: 'localhost' });
    });
});
