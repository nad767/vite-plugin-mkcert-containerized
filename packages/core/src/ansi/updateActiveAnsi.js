/**
 * Update the stack of active ANSI style/color codes based on an incoming SGR escape sequence.
 * Handles reset codes (e.g., reset all, default foreground/background color, bold/dim, underline).
 * Removes matching active styles from the array, or pushes new active style codes onto it.
 *
 * @param {string[]} activeAnsi Array of active ANSI escape code strings.
 * @param {string} code The ANSI escape sequence to process.
 * @returns {void}
 */
export function updateActiveAnsi(activeAnsi, code) {
    switch (code) {
        // Reset all active ANSI attributes/styles.
        case '\u{1B}[0m':
        case '\u{1B}[m': {
            activeAnsi.length = 0;
            break;
        }

        // Reset default foreground color (30-37, 90-97).
        case '\u{1B}[39m': {
            for (let i = activeAnsi.length - 1; i >= 0; i--) {
                // eslint-disable-next-line no-control-regex
                if (/^\u{1B}\[(?:3[0-9]|9[0-9])m$/u.test(activeAnsi[i])) {
                    activeAnsi.splice(i, 1);
                }
            }
            break;
        }

        // Reset default background color (40-47, 100-107).
        case '\u{1B}[49m': {
            for (let i = activeAnsi.length - 1; i >= 0; i--) {
                // eslint-disable-next-line no-control-regex
                if (/^\u{1B}\[(?:4[0-9]|10[0-9])m$/u.test(activeAnsi[i])) {
                    activeAnsi.splice(i, 1);
                }
            }
            break;
        }

        // Reset bold (1m) and dim (2m) text styles.
        case '\u{1B}[22m': {
            for (let i = activeAnsi.length - 1; i >= 0; i--) {
                if ((activeAnsi[i] === '\u{1B}[1m') || (activeAnsi[i] === '\u{1B}[2m')) {
                    activeAnsi.splice(i, 1);
                }
            }
            break;
        }

        // Reset underline (4m) text style.
        case '\u{1B}[24m': {
            for (let i = activeAnsi.length - 1; i >= 0; i--) {
                if (activeAnsi[i] === '\u{1B}[4m') {
                    activeAnsi.splice(i, 1);
                }
            }
            break;
        }

        // Track newly activated ANSI attribute sequence.
        default: {
            activeAnsi.push(code);
            break;
        }
    }
}
