/**
 * Write formatted text to process stdout when running in TTY mode, clearing line first.
 *
 * @param {string} text Line content to write to stdout.
 * @returns {boolean} True if text was written in TTY mode, false otherwise.
 */
export function writeToTty(text) {
    const isTty = Boolean(process.stdout && process.stdout.isTTY);
    if (!isTty) return false;

    // Use `\u{1B}[K` (=== `\x1b[K`) ANSI escape sequence to clear the line to avoid leftover characters when overwriting output.
    process.stdout.write(`\r\u{1B}[K${text}`);
    return true;
}
