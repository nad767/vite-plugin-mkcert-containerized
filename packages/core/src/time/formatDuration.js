/**
 * Format a duration given in milliseconds relative to now, rounded to most significant time unit (day, hour, etc.).
 *
 * @param {number} ms Duration in milliseconds.
 * @returns {string} Relative time string rounded to most significant time unit (e.g. "in 5 hours", "in 2 minutes").
 */
export function formatDuration(ms) {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

    if ((typeof ms !== 'number') || Number.isNaN(ms) || (ms <= 0)) {
        return rtf.format(0, 'second');
    }

    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
        return rtf.format(seconds, 'second');
    }

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return rtf.format(minutes, 'minute');
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return rtf.format(hours, 'hour');
    }

    const days = Math.round(hours / 24);
    return rtf.format(days, 'day');
}
