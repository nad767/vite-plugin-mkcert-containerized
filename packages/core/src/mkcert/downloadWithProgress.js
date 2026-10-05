import { writeFile } from 'node:fs/promises';

import { debugLog } from '../utils/debug.js';
import { formatBytes } from '../utils/formatBytes.js';
import { writeToTty } from '../utils/writeToTty.js';

/**
 * Download binary file from URL while displaying progress in the CLI.
 *
 * @param {string} url Binary URL to download.
 * @param {string} filePath Disk location to save binary.
 * @param {string} fileName Name of binary file for display.
 * @returns {Promise<Buffer>} Downloaded binary buffer.
 */
export async function downloadWithProgress(url, filePath, fileName) {
    debugLog(`Downloading \`mkcert\` binary for "${fileName}" from ${url}...`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download binary for ${fileName} (${response.status}).`);

    // Fallback to `arrayBuffer` if response body reader stream is unavailable.
    if (!response.body || (typeof response.body.getReader !== 'function')) {
        console.log(`[vite-plugin-mkcert-containerized] Downloading mkcert binary "${fileName}"...`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(filePath, buffer);
        console.log(`[vite-plugin-mkcert-containerized] Downloaded "${fileName}".`);
        debugLog(`Saved downloaded binary "${fileName}" to cache.`);
        return buffer;
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const isTty = Boolean(process.stdout && process.stdout.isTTY);

    if (!isTty) console.log(`[vite-plugin-mkcert-containerized] Downloading mkcert binary "${fileName}"...`);

    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;
    let lastReportedPercent = -1;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        // Handle chunked or unknown total size (`totalBytes <= 0`) to prevent `Infinity`/`NaN` progress percentages.
        if (totalBytes <= 0) {
            if (writeToTty(`[vite-plugin-mkcert-containerized] Downloading "${fileName}": ${formatBytes(receivedBytes)}`)) continue;

            // In non-TTY mode without known total size, report progress in periodic MB increments.
            const receivedMb = Math.floor(receivedBytes / (1024 * 1024));
            if (receivedMb > lastReportedPercent) {
                lastReportedPercent = receivedMb;
                console.log(`[vite-plugin-mkcert-containerized] Downloading "${fileName}": ${formatBytes(receivedBytes)}`);
            }
            continue;
        }

        const percent = Math.floor((receivedBytes / totalBytes) * 100);
        if (writeToTty(`[vite-plugin-mkcert-containerized] Downloading "${fileName}": ${percent}% (${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)})`)) continue;

        if ((percent >= (lastReportedPercent + 25)) && (percent < 100)) {
            lastReportedPercent = percent;
            console.log(`[vite-plugin-mkcert-containerized] Downloading "${fileName}": ${percent}% (${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)})`);
        }
    }

    const totalFormatted = totalBytes > 0 ? formatBytes(totalBytes) : formatBytes(receivedBytes);
    if (!writeToTty(`[vite-plugin-mkcert-containerized] Downloaded "${fileName}" (${totalFormatted}).\n`)) {
        console.log(`[vite-plugin-mkcert-containerized] Downloaded "${fileName}" (${totalFormatted}).`);
    }

    const buffer = Buffer.concat(chunks);
    await writeFile(filePath, buffer);
    debugLog(`Saved downloaded binary "${fileName}" to cache.`);
    return buffer;
}
