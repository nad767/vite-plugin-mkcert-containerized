import { prefixRegex } from '../ansi/regexes.js';
import { stripAnsi } from '../ansi/stripAnsi.js';
import { isDividerSignal } from './isDividerSignal.js';

/**
 * Calculate the minimum content width required to display a line without splitting any of its words across lines.
 * Takes into account leading indentation and hanging indent for wrapped words.
 *
 * @param {string} line The line of text.
 * @returns {number} The minimum content character width required for this line.
 */
export function getRequiredLineContentW(line) {
    if (isDividerSignal(line)) return 0;
    const visibleStr = stripAnsi(line);
    if (!visibleStr.trim()) return 0;

    // Calculate hanging indent width based on leading spaces and list/bullet prefixes.
    const prefixMatch = visibleStr.match(prefixRegex);
    const indentW = prefixMatch ? prefixMatch[0].length : 0;

    const words = visibleStr.trim().split(/\s+/);
    if (words.length === 0) return 0;

    // First word includes leading spaces/prefix; subsequent words inherit hanging indent when wrapped.
    const leadingSpacesW = visibleStr.length - visibleStr.trimStart().length;
    const firstWordW = leadingSpacesW + words[0].length;
    const subsequentWordsW = words.slice(1).map(w => indentW + w.length);

    return Math.max(firstWordW, ...subsequentWordsW);
}
