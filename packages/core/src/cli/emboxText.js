import { styleText } from 'node:util';

import { stripAnsi } from '../ansi/stripAnsi.js';
import {
    safeClamp,
    safeMax,
    safeMin,
} from '../utils/safeMath.js';
import { getRequiredLineContentW } from './getRequiredLineContentW.js';
import { isDividerSignal } from './isDividerSignal.js';
import { wrapLine } from './wrapLine.js';

/**
 * Format lines of text inside an ASCII box layout.
 *
 * @param {string | string[]} input The text string or array of line strings to box.
 * @param {Object} [options] Optional layout and styling configurations.
 * @param {string | string[] | ((str: string) => string)} [options.boxColor] Color name, array of styles, or formatting function applied to the box border.
 * @param {number} [options.paddingX=1] Horizontal padding (number of spaces) inside the box.
 * @param {number} [options.paddingY=0] Vertical padding (number of blank lines) inside the box.
 * @param {number} [options.minWidth=44] Minimum inner content width or box width.
 * @param {number} [options.maxWidth=88] Maximum total box width (including borders and padding). Bounded by the console's width if available.
 * @param {any} [options.stream] Output stream used to infer terminal width and color capabilities.
 * @returns {string} Boxed text layout string.
 */
export function emboxText(
    input,
    {
        boxColor,
        paddingX: px = 1,
        paddingY: py = 0,
        minWidth: minW = 44,
        maxWidth: maxW = 88,
        stream,
    } = {},
) {
    // Normalize input into line strings and trim trailing whitespace.
    const lines = Array.isArray(input) ? input : String(input).split('\n');
    const linesUntrailed = lines.map(line => line.trimEnd());

    // Calculate total overhead for side borders and horizontal padding.
    const overheadW = (2 * px) + 2;

    // Determine effective min "border box" width as greater of (longest token + overhead) and user's `minW`.
    const maxTokenContentW = Math.max(0, ...linesUntrailed.map(element => getRequiredLineContentW(element)));
    const maxTokenBorderW = maxTokenContentW + overheadW;
    const minBorderW = safeMax(minW, maxTokenBorderW);

    // Determine effective max "border box" width smaller of terminal width and user's `maxW`.
    const terminalW = stream?.columns ?? process.stdout?.columns ?? process.stderr?.columns;
    const maxBorderW = safeMin(maxW, terminalW);

    // Calculate native (unclamped) "border box" width.
    const nativeContentW = Math.max(0, ...linesUntrailed.map(line => isDividerSignal(line) ? 0 : stripAnsi(line).length));
    const nativeBorderW = nativeContentW + overheadW;

    // Determine target "border box" width. If min > max, prefer min.
    const boxW = (minBorderW >= maxBorderW)
        ? minBorderW
        : safeClamp({ num: nativeBorderW, min: minBorderW, max: maxBorderW });

    // Derive inner "content box" width and wrap width.
    const contentW = Math.max(1, boxW - overheadW);
    const paddingW = contentW + (2 * px);

    // Wrap any lines exceeding `contentW` (skipping section divider lines).
    const wrappedLines = linesUntrailed.flatMap(line => isDividerSignal(line) ? [line] : wrapLine(line, contentW));

    /**
     * Colorize a string using `styleText` or a custom color formatting function.
     *
     * @param {string} str The string to colorize.
     * @returns {string} Colorized string.
     */
    const colorize = str => {
        if (!boxColor) return str;
        if (typeof boxColor === 'function') return boxColor(str);
        return styleText(boxColor, str, ((stream !== undefined) && (stream !== null)) ? { stream } : undefined);
    };

    // Render top, bottom, middle divider, and side border elements.
    const yBorder = colorize('│');
    const tBorder = colorize(`┌${'─'.repeat(paddingW)}┐`);
    const bBorder = colorize(`└${'─'.repeat(paddingW)}┘`);
    const divider = colorize(`├${'─'.repeat(paddingW)}┤`);

    // Pad and box each line of content, preserving section divider lines.
    const xPaddingStr = ' '.repeat(px);
    const boxedLines = wrappedLines.map(line => {
        if (isDividerSignal(line)) return divider;
        const visibleW = stripAnsi(line).length;
        const linePadding = ' '.repeat(contentW - visibleW);
        return `${yBorder}${xPaddingStr}${line}${linePadding}${xPaddingStr}${yBorder}`;
    });

    // Add vertical padding lines above and below the boxed content (noop if `py` is 0).
    const emptyLine = `${yBorder}${' '.repeat(paddingW)}${yBorder}`;
    const paddingYLines = Array.from({ length: py }, () => emptyLine);

    // Bring everything together: top border, vertical padding, boxed content, vertical padding, bottom border.
    return [
        tBorder,
        ...paddingYLines,
        ...boxedLines,
        ...paddingYLines,
        bBorder,
    ].join('\n');
}
