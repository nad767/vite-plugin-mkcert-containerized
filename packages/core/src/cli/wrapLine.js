import { ansiRegex, prefixRegex } from '../ansi/regexes.js';
import { stripAnsi } from '../ansi/stripAnsi.js';
import { updateActiveAnsi } from '../ansi/updateActiveAnsi.js';

/**
 * Wrap a single line of text (which may contain ANSI escape sequences) so that its visible width does not exceed `maxW`.
 * Preserves ANSI formatting across line breaks and aligns wrapped text with the first letter of bulleted or numbered list items.
 *
 * @param {string} line The line of text (potentially with ANSI codes) to wrap.
 * @param {number} maxW Maximum visible character width allowed per line.
 * @returns {string[]} An array of wrapped line strings.
 */
export function wrapLine(line, maxW) {
    const visibleStr = stripAnsi(line);

    // Return early if the line fits within maxW.
    if (visibleStr.length <= maxW) return [line];

    // Calculate hanging indent width based on leading spaces and list/bullet prefixes.
    const prefixMatch = visibleStr.match(prefixRegex);
    const indentW = prefixMatch ? prefixMatch[0].length : 0;

    // Tokenize the line into individual characters and ANSI escape sequences.
    const tokens = [];
    let lastIndex = 0;
    let match;
    const re = new RegExp(ansiRegex.source, 'g');

    while ((match = re.exec(line)) !== null) {
        if (match.index > lastIndex) {
            const text = line.slice(lastIndex, match.index);
            for (const char of text) {
                tokens.push({ type: 'char', value: char });
            }
        }
        tokens.push({ type: 'ansi', value: match[0] });
        lastIndex = re.lastIndex;
    }
    if (lastIndex < line.length) {
        const text = line.slice(lastIndex);
        for (const char of text) {
            tokens.push({ type: 'char', value: char });
        }
    }

    const resultLines = [];
    let tokenIndex = 0;
    let isFirstLine = true;
    const activeAnsi = [];

    // Loop through tokens to construct lines within maxW.
    while (tokenIndex < tokens.length) {
        // First line uses original layout; wrapped lines inherit hanging indent.
        const currentIndentW = isFirstLine ? 0 : Math.min(indentW, Math.max(0, maxW - 1));
        const currentIndentStr = isFirstLine ? '' : ' '.repeat(currentIndentW);
        const availW = Math.max(1, maxW - currentIndentW);

        let visibleCount = 0;
        let scanIndex = tokenIndex;
        let lastSpaceTokenIndex = -1;

        const scanActiveAnsi = [...activeAnsi];

        // Scan tokens up to availW, keeping track of space characters for word wrapping.
        while ((scanIndex < tokens.length) && (visibleCount <= availW)) {
            const token = tokens[scanIndex];
            if (token.type === 'ansi') {
                updateActiveAnsi(scanActiveAnsi, token.value);
            }
            else {
                if ((visibleCount < availW) && (token.value === ' ')) {
                    lastSpaceTokenIndex = scanIndex;
                }
                visibleCount++;
            }
            if (visibleCount <= availW) {
                scanIndex++;
            }
        }

        // Determine break index. We only break on word boundaries (spaces), never split words/tokens.
        let breakTokenIndex;
        if ((scanIndex >= tokens.length) && (visibleCount <= availW)) {
            breakTokenIndex = tokens.length;
        }
        else if ((lastSpaceTokenIndex !== -1) && (lastSpaceTokenIndex >= tokenIndex)) {
            breakTokenIndex = lastSpaceTokenIndex;
        }
        else {
            // No space was found in the current line window. Scan forward to include the remainder of the unbroken token to avoid word splitting.
            const charsToNextBoundary = tokens.slice(tokenIndex).findIndex(tok => (tok.type === 'char') && (tok.value === ' '));
            breakTokenIndex = (charsToNextBoundary === -1) ? tokens.length : (tokenIndex + charsToNextBoundary);
        }

        if (breakTokenIndex <= tokenIndex) {
            breakTokenIndex = Math.min(tokens.length, tokenIndex + 1);
        }

        // Assemble line with leading indentation and carryover ANSI styles.
        let lineStr = currentIndentStr;
        if (!isFirstLine && (activeAnsi.length > 0)) {
            lineStr += activeAnsi.join('');
        }

        for (let i = tokenIndex; i < breakTokenIndex; i++) {
            const token = tokens[i];
            if (token.type === 'ansi') {
                updateActiveAnsi(activeAnsi, token.value);
            }
            lineStr += token.value;
        }

        // Ensure active ANSI styles are reset at the end of each line string.
        if (activeAnsi.length > 0) {
            lineStr += '\u{1B}[0m';
        }

        resultLines.push(lineStr);

        // Move to next tokens and skip trailing space at break point.
        tokenIndex = breakTokenIndex;
        if ((breakTokenIndex === lastSpaceTokenIndex)
            && (tokenIndex < tokens.length)
            && (tokens[tokenIndex].type === 'char')
            && (tokens[tokenIndex].value === ' ')) tokenIndex++;

        isFirstLine = false;
    }

    return resultLines;
}
