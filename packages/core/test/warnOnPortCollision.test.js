import assert from 'node:assert/strict';
import {
    afterEach,
    beforeEach,
    describe,
    it,
} from 'node:test';

import { DEFAULT_VITE_PORT } from '../src/consts.js';
import { warnOnPortCollision } from '../src/server/warnOnPortCollision.js';

describe('warnOnPortCollision', () => {
    let warnings;
    let originalWarn;

    beforeEach(() => {
        warnings = [];
        originalWarn = console.warn;
        console.warn = msg => { warnings.push(msg); };
    });

    afterEach(() => {
        console.warn = originalWarn;
    });

    it('returns null and emits no warning when pluginPort is omitted or null', () => {
        assert.equal(warnOnPortCollision({ pluginPort: undefined, vitePort: 5173 }), null);
        assert.equal(warnOnPortCollision({ pluginPort: null, vitePort: 5173 }), null);
        assert.equal(warnOnPortCollision({}), null);
        assert.equal(warnings.length, 0);
    });

    it('returns null and emits no warning when pluginPort is invalid or out-of-range', () => {
        assert.equal(warnOnPortCollision({ pluginPort: 'invalid', vitePort: 5173 }), null);
        assert.equal(warnOnPortCollision({ pluginPort: -1, vitePort: 5173 }), null);
        assert.equal(warnOnPortCollision({ pluginPort: 70_000, vitePort: 5173 }), null);
        assert.equal(warnings.length, 0);
    });

    it('returns null and emits no warning when pluginPort differs from vitePort', () => {
        const result = warnOnPortCollision({
            pluginPort: 25_173,
            vitePort:   5173,
        });

        assert.equal(result, null);
        assert.equal(warnings.length, 0);
    });

    it('emits mild port collision warning when pluginPort matches vitePort and neither has strictPort', () => {
        const result = warnOnPortCollision({
            pluginPort:       5173,
            pluginStrictPort: false,
            vitePort:         5173,
            viteStrictPort:   false,
        });

        assert.match(result, /Port collision detected/);
        assert.match(result, /Whichever server initializes later will be forced to increment/);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0], result);
    });

    it('emits stronger warning when pluginPort matches vitePort and only the plugin has strictPort', () => {
        const result = warnOnPortCollision({
            pluginPort:       3000,
            pluginStrictPort: true,
            vitePort:         3000,
            viteStrictPort:   false,
        });

        assert.match(result, /Potential startup failure/);
        assert.match(result, /enabled on the plugin/);
        assert.match(result, /If the plugin initializes after Vite, the plugin will fail to start/);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0], result);
    });

    it('emits stronger warning when pluginPort matches vitePort and only Vite has strictPort', () => {
        const result = warnOnPortCollision({
            pluginPort:       8080,
            pluginStrictPort: false,
            vitePort:         8080,
            viteStrictPort:   true,
        });

        assert.match(result, /Potential startup failure/);
        assert.match(result, /enabled on Vite/);
        assert.match(result, /If Vite initializes after the plugin, Vite will fail to start/);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0], result);
    });

    it('emits strongest critical warning when pluginPort matches vitePort and both have strictPort', () => {
        const result = warnOnPortCollision({
            pluginPort:       5173,
            pluginStrictPort: true,
            vitePort:         5173,
            viteStrictPort:   true,
        });

        assert.match(result, /Critical port collision/);
        assert.match(result, /Both Vite and the plugin are configured to use port 5173 with "strictPort: true"/);
        assert.match(result, /Whichever server initializes later is guaranteed to fail startup/);
        assert.equal(warnings.length, 1);
        assert.equal(warnings[0], result);
    });

    it('falls back to DEFAULT_VITE_PORT when vitePort is omitted or invalid', () => {
        const result = warnOnPortCollision({
            pluginPort: DEFAULT_VITE_PORT,
            vitePort:   undefined,
        });

        assert.match(result, /Port collision detected/);
        assert.match(result, new RegExp(String(DEFAULT_VITE_PORT)));
        assert.equal(warnings.length, 1);
    });

    it('handles numeric strings for pluginPort and vitePort correctly', () => {
        const result = warnOnPortCollision({
            pluginPort: '4000',
            vitePort:   '4000',
        });

        assert.match(result, /Port collision detected/);
        assert.match(result, /4000/);
        assert.equal(warnings.length, 1);
    });
});
