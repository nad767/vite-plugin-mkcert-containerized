import {
    mkdir,
    readFile,
    stat,
} from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_BIN_CACHE_DIR, MKCERT_TARGETS } from '../consts.js';
import { debugLog } from '../utils/debug.js';
import { downloadWithProgress } from './downloadWithProgress.js';
import { fetchLatestMkcertReleaseAssets } from './fetchLatestMkcertReleaseAssets.js';

/**
 * Fetch and disk-cache all platform `mkcert` binaries so they can be bundled into the offline host-trust archive.
 *
 * Note that `vite-plugin-mkcert` downloads just one binary, suitable for the container. We download all binaries.
 *
 * @param {Object} [options]
 * @param {string} [options.cacheDir] Directory path for caching downloaded binaries on disk.
 * @returns {Promise<Array<{ content: Buffer, name: string }>>} Array of binary file objects containing filename and buffer.
 */
export async function fetchAndCacheMkcertBinaries(options = {}) {
    const cacheDir = options.cacheDir ?? DEFAULT_BIN_CACHE_DIR;
    debugLog(`Ensuring binary cache directory "${cacheDir}".`);
    await mkdir(cacheDir, { recursive: true });

    const { downloadUrls } = await fetchLatestMkcertReleaseAssets();
    const availableTargets = MKCERT_TARGETS.filter(target => downloadUrls[target.binaryKey]);
    debugLog(`Found ${availableTargets.length} platform binaries to process for caching.`);

    const bundledFiles = [];
    for (const { binaryKey, binaryFilename } of availableTargets) {
        const url = downloadUrls[binaryKey];
        const filePath = path.join(cacheDir, binaryFilename);

        // Check if valid cached binary already exists on disk.
        const fileStats = await stat(filePath).catch(() => null);
        if (fileStats && (fileStats.size > 0)) {
            debugLog(`Using cached mkcert binary "${binaryFilename}" from disk.`);
            const content = await readFile(filePath);
            bundledFiles.push({ content, name: binaryFilename });
            continue;
        }

        // Download fresh binary if not cached.
        try {
            const buffer = await downloadWithProgress(url, filePath, binaryFilename);
            bundledFiles.push({ content: buffer, name: binaryFilename });
        }
        catch (err) {
            console.error(`[vite-plugin-mkcert-containerized] Failed to cache binary for ${binaryKey}:`, err);
        }
    }

    return bundledFiles;
}
