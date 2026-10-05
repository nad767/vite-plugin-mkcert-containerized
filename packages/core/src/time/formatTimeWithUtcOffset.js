/**
 * Format Date object as a timestamp with UTC offset of current timezone.
 *
 * Offset is calculated manually instead of using `toLocaleTimeString`'s `timeZoneName` option (`shortOffset`/`longOffset`).
 * This is to enforce an explicit `UTC±HH:MM` format, rather than `GMT` prefixes or locale-dependent strings.
 *
 * @param {Date} date Date instance to format.
 * @returns {string} Formatted local time with explicit UTC offset suffix.
 */
export function formatTimeWithUtcOffset(date) {
    const offsetMinutes = -date.getTimezoneOffset();
    const offsetSign = offsetMinutes >= 0 ? '+' : '-';
    const absoluteOffsetMinutes = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(2, '0');
    const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(2, '0');
    return `${date.toLocaleTimeString()} UTC${offsetSign}${offsetHours}:${offsetRemainderMinutes}`;
}
