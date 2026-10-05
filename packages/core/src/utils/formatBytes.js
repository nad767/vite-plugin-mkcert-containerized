/**
 * Format byte count into human readable size string.
 *
 * @param {number} bytes Number of bytes.
 * @returns {string} Formatted byte string.
 */
export function formatBytes(bytes) {
    const KB = 1024;
    if (bytes < KB) return `${bytes} B`;

    const MB = KB * 1024;
    if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;

    return `${(bytes / MB).toFixed(2)} MB`;
}
