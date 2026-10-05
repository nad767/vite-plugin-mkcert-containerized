import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deriveServerKey } from '../src/server/deriveServerKey.js';

describe('deriveServerKey', () => {
    it('generates deterministic server keys from identical inputs', () => {
        const key1 = deriveServerKey({
            allowedHosts:   ['localhost', '127.0.0.1'],
            bundleBinaries: true,
            host:           '0.0.0.0',
            hosts:          ['app.local', 'api.local'],
            port:           25_173,
            projectName:    'my-project',
            savePath:       '/tmp/ca',
            strictPort:     true,
            timeoutMs:      60_000,
        });

        const key2 = deriveServerKey({
            allowedHosts:   ['localhost', '127.0.0.1'],
            bundleBinaries: true,
            host:           '0.0.0.0',
            hosts:          ['app.local', 'api.local'],
            port:           25_173,
            projectName:    'my-project',
            savePath:       '/tmp/ca',
            strictPort:     true,
            timeoutMs:      60_000,
        });

        assert.equal(key1, key2);
    });

    it('produces identical keys when hosts array elements are in different order', () => {
        const key1 = deriveServerKey({
            hosts:       ['zeta.local', 'alpha.local', 'beta.local'],
            projectName: 'my-project',
        });

        const key2 = deriveServerKey({
            hosts:       ['alpha.local', 'beta.local', 'zeta.local'],
            projectName: 'my-project',
        });

        assert.equal(key1, key2);
    });

    it('produces different keys when any configuration option differs', () => {
        const baseOptions = {
            allowedHosts:   ['localhost'],
            bundleBinaries: false,
            host:           '0.0.0.0',
            hosts:          ['app.local'],
            port:           25_173,
            projectName:    'my-project',
            savePath:       '/tmp/ca',
            strictPort:     false,
            timeoutMs:      60_000,
        };

        const baseKey = deriveServerKey(baseOptions);

        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, hosts: ['diff.local'] }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, bundleBinaries: true }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, port: 25_174 }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, timeoutMs: 120_000 }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, host: '127.0.0.1' }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, projectName: 'other-project' }));
        assert.notEqual(baseKey, deriveServerKey({ ...baseOptions, savePath: '/tmp/other-ca' }));
    });

    it('handles empty / undefined arguments with default values', () => {
        const key = deriveServerKey();
        assert.equal(typeof key, 'string');
        assert.ok(key.length > 0);
    });
});
