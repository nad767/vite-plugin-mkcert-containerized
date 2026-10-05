import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ansiRegex, prefixRegex } from '../src/ansi/regexes.js';

describe('regexes', () => {
    describe('ansiRegex', () => {
        it('matches ANSI escape sequences', () => {
            // Test matching SGR color escape codes.
            const colorString = '\u{1B}[31mRed Text\u{1B}[0m';
            const matches = colorString.match(ansiRegex);
            assert.ok(matches);
            assert.strictEqual(matches.length, 2);
            assert.strictEqual(matches[0], '\u{1B}[31m');
            assert.strictEqual(matches[1], '\u{1B}[0m');
        });
    });

    describe('prefixRegex', () => {
        it('matches leading list and bullet prefixes', () => {
            // Test matching bullet point list item prefix.
            const bulletMatch = '  • Item text'.match(prefixRegex);
            assert.ok(bulletMatch);
            assert.strictEqual(bulletMatch[0], '  • ');

            // Test matching numbered list item prefix.
            const numberMatch = ' 1. First step'.match(prefixRegex);
            assert.ok(numberMatch);
            assert.strictEqual(numberMatch[0], ' 1. ');

            // Test matching checkbox list item prefix.
            const checkboxMatch = '   [x] Task completed'.match(prefixRegex);
            assert.ok(checkboxMatch);
            assert.strictEqual(checkboxMatch[0], '   [x] ');
        });
    });
});
