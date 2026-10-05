import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    safeClamp,
    safeMax,
    safeMin,
} from '../src/utils/safeMath.js';

describe('safeMath', () => {
    describe('safeMax', () => {
        it('returns maximum valid positive numeric value', () => {
            // Test finding maximum positive number.
            assert.strictEqual(safeMax(10, 20, 5), 20);
        });

        it('handles 0 and negative numbers as valid numeric values', () => {
            // Test that 0 and negative values are preserved and compared.
            assert.strictEqual(safeMax(0, -5, null, undefined), 0);
            assert.strictEqual(safeMax(-20, -5, null, undefined), -5);
        });
    });

    describe('safeMin', () => {
        it('returns minimum valid positive numeric value', () => {
            // Test finding minimum positive number.
            assert.strictEqual(safeMin(10, 20, 5), 5);
        });

        it('handles 0 and negative numbers as valid numeric values', () => {
            // Test that 0 and negative values are preserved and compared.
            assert.strictEqual(safeMin(10, 0, 50), 0);
            assert.strictEqual(safeMin(-10, 5, null, undefined), -10);
            assert.strictEqual(safeMin(-20, -5), -20);
        });
    });

    describe('safeClamp', () => {
        it('clamps values within minimum and maximum bounds', () => {
            // Test clamping value below min.
            assert.strictEqual(safeClamp({ num: 10, min: 20, max: 50 }), 20);
            // Test clamping value above max.
            assert.strictEqual(safeClamp({ num: 60, min: 20, max: 50 }), 50);
            // Test clamping value within bounds.
            assert.strictEqual(safeClamp({ num: 35, min: 20, max: 50 }), 35);
            // Test clamping with 0 as minimum.
            assert.strictEqual(safeClamp({ num: -5, min: 0, max: 50 }), 0);
        });
    });
});
