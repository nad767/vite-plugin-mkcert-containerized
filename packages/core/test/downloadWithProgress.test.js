import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { downloadWithProgress } from '../src/mkcert/downloadWithProgress.js';

describe('downloadWithProgress', () => {
    it('clears TTY lines with ANSI erase escape sequence during and after download', async () => {
        const tempDir = await mkdtemp(path.join(tmpdir(), 'test-download-'));
        const targetPath = path.join(tempDir, 'test-bin');
        const writtenChunks = [];

        // Save original stdout.isTTY and stdout.write methods.
        const originalIsTTY = process.stdout.isTTY;
        const originalWrite = process.stdout.write;

        // Mock stdout TTY state and capture write output.
        process.stdout.isTTY = true;
        process.stdout.write = chunk => {
            writtenChunks.push(String(chunk));
            return true;
        };

        // Mock global fetch for testing.
        // eslint-disable-next-line unicorn/no-unnecessary-global-this
        const originalFetch = globalThis.fetch;
        const sampleData = new Uint8Array([1, 2, 3, 4, 5]);

        // eslint-disable-next-line unicorn/no-global-object-property-assignment
        globalThis.fetch = async () => {
            return {
                ok:      true,
                headers: new Map([['content-length', String(sampleData.length)]]),
                body:    {
                    getReader() {
                        let readDone = false;
                        return {
                            async read() {
                                if (readDone) return { done: true, value: undefined };
                                readDone = true;
                                return { done: false, value: sampleData };
                            },
                        };
                    },
                },
            };
        };

        try {
            await downloadWithProgress('https://example.com/bin', targetPath, 'mkcert-darwin-amd64');

            // Verify stdout write calls start with `\r\x1b[K` to clear previous line content.
            assert.ok(writtenChunks.length >= 2);
            for (const chunk of writtenChunks) {
                assert.ok(chunk.startsWith('\r\u{1B}[K'));
            }

            // Verify final message ends line with newline.
            const lastChunk = writtenChunks.at(-1);
            assert.ok(lastChunk.includes('[vite-plugin-mkcert-containerized] Downloaded "mkcert-darwin-amd64"'));
            assert.ok(lastChunk.endsWith('\n'));
        }
        finally {
            process.stdout.isTTY = originalIsTTY;
            process.stdout.write = originalWrite;
            // eslint-disable-next-line unicorn/no-global-object-property-assignment
            globalThis.fetch = originalFetch;
            await rm(tempDir, { force: true, recursive: true });
        }
    });
});
