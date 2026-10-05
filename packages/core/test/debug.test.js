import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    debugLog,
    isDebugEnabled,
    setDebugOption,
} from '../src/utils/debug.js';

describe('debug utility', () => {
    it('returns false by default when no debug flag or env var is set', () => {
        // Save and clear environment variable.
        const originalEnv = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
        try {
            delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            setDebugOption(undefined);
            assert.equal(isDebugEnabled(), false);
        }
        finally {
            if (originalEnv === undefined) delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            else process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = originalEnv;
        }
    });

    it('returns true when explicit debug option argument is true', () => {
        // Test explicit option argument override.
        const originalEnv = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
        try {
            delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            setDebugOption(undefined);
            assert.equal(isDebugEnabled(true), true);
        }
        finally {
            if (originalEnv === undefined) delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            else process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = originalEnv;
        }
    });

    it('returns false when explicit debug option is false, ignoring environment variable', () => {
        // Explicit option takes precedence over environment variable.
        const originalEnv = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
        try {
            process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = 'true';
            setDebugOption(false);
            assert.equal(isDebugEnabled(), false);
            assert.equal(isDebugEnabled(false), false);
        }
        finally {
            setDebugOption(undefined);
            if (originalEnv === undefined) delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            else process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = originalEnv;
        }
    });

    it('only considers environment variable when option is undefined', () => {
        // Environment variable is evaluated only if option is undefined.
        const originalEnv = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
        try {
            setDebugOption(undefined);

            process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = 'true';
            assert.equal(isDebugEnabled(), true);

            process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = '1';
            assert.equal(isDebugEnabled(), true);

            process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = 'false';
            assert.equal(isDebugEnabled(), false);
        }
        finally {
            setDebugOption(undefined);
            if (originalEnv === undefined) delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            else process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = originalEnv;
        }
    });

    it('logs message via console.log when debug mode is enabled', () => {
        // Intercept console.log to verify debug message output format.
        const originalLog = console.log;
        const loggedMessages = [];
        console.log = (...args) => { loggedMessages.push(args); };

        try {
            setDebugOption(true);
            debugLog('Test debug message', { detail: 123 });

            assert.equal(loggedMessages.length, 1);
            assert.equal(loggedMessages[0][0], '[vite-plugin-mkcert-containerized:debug] Test debug message');
            assert.deepEqual(loggedMessages[0][1], { detail: 123 });
        }
        finally {
            console.log = originalLog;
            setDebugOption(undefined);
        }
    });
});
