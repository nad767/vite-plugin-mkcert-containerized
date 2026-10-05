import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { fetchAndCacheMkcertBinaries } from '../src/mkcert/fetchAndCacheMkcertBinaries.js';

describe('fetchAndCacheMkcertBinaries', () => {
    it('downloads platform binaries and logs progress output', async () => {
        // Create an isolated temporary cache directory for this test.
        const tempCacheDir = await mkdtemp(path.join(tmpdir(), 'test-bin-cache-'));

        const loggedLines = [];
        const originalLog = console.log;
        console.log = (...args) => {
            loggedLines.push(args.join(' '));
        };

        try {
            const binaries = await fetchAndCacheMkcertBinaries({ cacheDir: tempCacheDir });

            // Verify binaries array is returned with platform files.
            assert.ok(binaries.length > 0);
            assert.ok(binaries.some(b => b.name.startsWith('mkcert-')));

            // Verify `CLI` download progress messages were logged.
            assert.ok(loggedLines.some(line => line.includes('[vite-plugin-mkcert-containerized] Downloading mkcert binary')));
            assert.ok(loggedLines.some(line => line.includes('[vite-plugin-mkcert-containerized] Downloaded')));

            // Verify subsequent call uses cached binaries without re-downloading.
            loggedLines.length = 0;
            const cachedBinaries = await fetchAndCacheMkcertBinaries({ cacheDir: tempCacheDir });
            assert.equal(cachedBinaries.length, binaries.length);
            assert.equal(loggedLines.length, 0);
        }
        finally {
            console.log = originalLog;
            await rm(tempCacheDir, { force: true, recursive: true });
        }
    });
});
