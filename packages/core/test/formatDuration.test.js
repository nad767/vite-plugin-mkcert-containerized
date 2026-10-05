import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDuration } from '../src/time/formatDuration.js';

describe('formatDuration', () => {
    it('returns 0 seconds for non-positive or invalid duration inputs', () => {
        // Test non-positive or invalid inputs return 0 seconds.
        assert.equal(formatDuration(0), 'in 0 seconds');
        assert.equal(formatDuration(-5000), 'in 0 seconds');
        assert.equal(formatDuration(null), 'in 0 seconds');
        assert.equal(formatDuration(NaN), 'in 0 seconds');
    });

    it('formats seconds duration correctly', () => {
        // Test durations under a minute format as seconds.
        assert.equal(formatDuration(30_000), 'in 30 seconds');
        assert.equal(formatDuration(59_000), 'in 59 seconds');
    });

    it('formats minutes duration correctly', () => {
        // Test durations between 1 minute and 59 minutes format as minutes.
        assert.equal(formatDuration(120_000), 'in 2 minutes');
        assert.equal(formatDuration(1_800_000), 'in 30 minutes');
    });

    it('formats hours duration correctly', () => {
        // Test durations between 1 hour and 23 hours format as hours.
        assert.equal(formatDuration(3_600_000), 'in 1 hour');
        assert.equal(formatDuration(18_000_000), 'in 5 hours');
    });

    it('formats days duration correctly', () => {
        // Test durations of 24 hours or more format as days.
        assert.equal(formatDuration(86_400_000), 'in 1 day');
        assert.equal(formatDuration(172_800_000), 'in 2 days');
    });
});
