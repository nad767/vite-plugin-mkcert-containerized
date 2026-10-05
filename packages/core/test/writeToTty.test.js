import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { writeToTty } from '../src/utils/writeToTty.js';

describe('writeToTty', () => {
    it('returns false when process stdout is not TTY', () => {
        const originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = false;

        try {
            const result = writeToTty('test line');
            assert.equal(result, false);
        }
        finally {
            process.stdout.isTTY = originalIsTTY;
        }
    });

    it('writes formatted string with carriage return and line erase sequence when TTY is true', () => {
        const originalIsTTY = process.stdout.isTTY;
        const originalWrite = process.stdout.write;
        const writtenChunks = [];

        process.stdout.isTTY = true;
        process.stdout.write = chunk => {
            writtenChunks.push(String(chunk));
            return true;
        };

        try {
            const result = writeToTty('hello world');
            assert.equal(result, true);
            assert.equal(writtenChunks.length, 1);
            assert.equal(writtenChunks[0], '\r\u{1B}[Khello world');
        }
        finally {
            process.stdout.isTTY = originalIsTTY;
            process.stdout.write = originalWrite;
        }
    });
});
