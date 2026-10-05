import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { derivePortFromVite } from '../src/server/derivePortFromVite.js';

describe('derivePortFromVite', () => {
    it('calculates (basePort % 10000) + 20000 when basePort is < 20000 or >= 30000', () => {
        // Standard `Vite` dev port.
        assert.equal(derivePortFromVite(5173), 25_173);
        // Common web server ports.
        assert.equal(derivePortFromVite(3000), 23_000);
        assert.equal(derivePortFromVite(8080), 28_080);
        assert.equal(derivePortFromVite('5173'), 25_173);
        assert.equal(derivePortFromVite(14_173), 24_173);
        // Ports >= 30000 without collision.
        assert.equal(derivePortFromVite(30_000), 20_000);
        assert.equal(derivePortFromVite(35_173), 25_173);
        assert.equal(derivePortFromVite(40_000), 20_000);
    });

    it('adds 1000 when 20000 <= basePort < 30000 to prevent collision', () => {
        // 20000 -> (0 + 20000) + 1000 = 21000.
        assert.equal(derivePortFromVite(20_000), 21_000);
        // 25173 -> (5173 + 20000) + 1000 = 26173.
        assert.equal(derivePortFromVite(25_173), 26_173);
        // 29999 -> (9999 + 20000) + 1000 = 30999.
        assert.equal(derivePortFromVite(29_999), 30_999);
    });

    it('falls back to 25173 for invalid, non-numeric, or out-of-range inputs', () => {
        assert.equal(derivePortFromVite(), 25_173);
        assert.equal(derivePortFromVite(undefined), 25_173);
        assert.equal(derivePortFromVite(null), 25_173);
        assert.equal(derivePortFromVite('not-a-number'), 25_173);
        assert.equal(derivePortFromVite(-5), 25_173);
        assert.equal(derivePortFromVite(0), 25_173);
        assert.equal(derivePortFromVite(70_000), 25_173);
    });
});
