import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emboxText } from '../src/cli/emboxText.js';

describe('emboxText', () => {
    it('wraps text inside top, bottom, and side ASCII border lines', () => {
        // Test single line boxed rendering.
        const output = emboxText('Hello World', { minWidth: 20 });
        const lines = output.split('\n');

        // Verify top border line starts with top-left corner character.
        assert.ok(lines[0].startsWith('┌'));
        // Verify bottom border line starts with bottom-left corner character.
        assert.ok(lines.at(-1).startsWith('└'));
        // Verify content line is enclosed in side border characters.
        assert.ok(lines[1].startsWith('│'));
        assert.ok(lines[1].endsWith('│'));
        assert.ok(lines[1].includes('Hello World'));
    });

    it('renders middle section dividers when line matches --- signal', () => {
        // Test divider line rendering.
        const input = ['Header Section', '---', 'Content Section'];
        const output = emboxText(input, { minWidth: 20 });
        const lines = output.split('\n');

        // Verify divider line uses middle border intersection characters.
        assert.ok(lines[2].startsWith('├'));
        assert.ok(lines[2].endsWith('┤'));
    });

    it('wraps long lines exceeding maximum content width', () => {
        // Test word wrapping on long text.
        const longText = 'This is a long sentence that should be wrapped into multiple lines when it exceeds the maximum content width.';
        const output = emboxText(longText, { maxWidth: 40 });
        const lines = output.split('\n');

        // Verify wrapped output contains multiple content lines.
        assert.ok(lines.length > 3);
    });

    it('preserves unbroken tokens (URLs/paths) intact and expands box width', () => {
        // Test unbroken token preservation (URLs, file paths, base64 strings) and box expansion.
        const longToken = 'http://localhost:25173/downloads/vite-plugin-mkcert-containerized-CA-2026-07-30T17-20-55Z.zip';
        const input = [
            '1. Download CA certificate & installation helpers:',
            '',
            `   ${longToken}`,
        ];

        const output = emboxText(input, { maxWidth: 50 });
        const lines = output.split('\n');

        // Verify line containing unbroken token is not chopped across lines.
        const tokenLine = lines.find(line => line.includes('http://localhost:25173'));
        assert.ok(tokenLine);
        assert.ok(tokenLine.includes(longToken));
    });

    it('trims trailing whitespace from content lines', () => {
        // Test trailing whitespace removal on input lines.
        const output = emboxText('Line with trailing space   \nAnother line longer text', { minWidth: 0 });
        const lines = output.split('\n');

        // Verify line content inside borders was trimmed of trailing whitespace.
        assert.ok(lines[1].endsWith('Line with trailing space │'));
    });

    it('uses native length when native length is between minWidth and maxWidth', () => {
        // Test native length selection when text fits within minWidth and maxWidth bounds.
        const input = 'This line native content length is exactly 48 chars.';
        const output = emboxText(input, { minWidth: 30, maxWidth: 80 });
        const lines = output.split('\n');

        // Verify box width adapts to native length rather than expanding to maxWidth or shrinking to minWidth.
        assert.strictEqual(lines[0].length, input.length + 4);
    });
});
