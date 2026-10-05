import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatTimeWithUtcOffset } from '../src/time/formatTimeWithUtcOffset.js';

describe('formatTimeWithUtcOffset', () => {
    it('appends an explicit UTC offset suffix to formatted time string', () => {
        // Test date instance offset formatting.
        const testDate = new Date('2026-07-30T12:00:00Z');
        const formatted = formatTimeWithUtcOffset(testDate);

        // Verify the formatted string contains UTC offset format matching UTC[+-]\d{2}:\d{2}.
        assert.match(formatted, /UTC[+-]\d{2}:\d{2}$/);
    });
});
