import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_CACHE_FILE_PATH, DEFAULT_CACHE_TTL_MS } from '../consts.js';

/**
 * Known stable `mkcert` release metadata used as fallback when unauthenticated `GitHub` API requests are rate-limited (60 req/hr) or offline.
 */
const FALLBACK_MKCERT_VERSION = 'v1.4.4';
const FALLBACK_DOWNLOAD_URLS = Object.freeze({
    'darwin-amd64':  'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-amd64',
    'darwin-arm64':  'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-arm64',
    'linux-amd64':   'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64',
    'linux-arm':     'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-arm',
    'linux-arm64':   'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-arm64',
    'windows-amd64': 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe',
    'windows-arm64': 'https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-arm64.exe',
});

/**
 * Using a `const` object instead of rewriting a `let` variable to clear linting warnings about reassigning a top-level variable.
 *
 * @type {{ current: { timestamp: number, data: { downloadUrls: Record<string, string | undefined>, version: string | undefined } } | null }}
 */
const memoryCacheHolder = { current: null };

/**
 * Read cached release data from disk if it exists and is valid.
 *
 * @param {string} cacheFilePath Path to cache file.
 * @returns {Promise<{ timestamp: number, data: { downloadUrls: Record<string, string | undefined>, version: string | undefined } } | null>}
 */
async function readCache(cacheFilePath) {
    try {
        const rawData = await readFile(cacheFilePath, 'utf8');
        const parsed = JSON.parse(rawData);
        if ((typeof parsed?.timestamp === 'number') && parsed?.data?.downloadUrls) {
            return parsed;
        }
    }
    catch { /* Cache read or parse error ignored. */ }
    return null;
}

/**
 * Write release data to disk cache.
 *
 * @param {string} cacheFilePath Path to cache file.
 * @param {{ timestamp: number, data: { downloadUrls: Record<string, string | undefined>, version: string | undefined } }} cacheEntry Cache entry to store.
 * @returns {Promise<void>}
 */
async function writeCache(cacheFilePath, cacheEntry) {
    try {
        await mkdir(path.dirname(cacheFilePath), { recursive: true });
        await writeFile(cacheFilePath, JSON.stringify(cacheEntry), 'utf8');
    }
    catch { /* Cache read or parse error ignored. */ }
}

/**
 * Fetch the latest `mkcert` `GitHub` release and map its assets by `<platform>-<arch>` so generated host scripts can use direct URLs.
 * Results are cached in memory and on disk to prevent hitting `GitHub` API rate limits.
 *
 * @param {Object} [options] Options for fetching release assets.
 * @param {number} [options.ttlMs] Cache time-to-live in milliseconds. Defaults to 24 hours.
 * @param {string} [options.cacheFilePath] Custom file path for disk cache.
 * @returns {Promise<{ downloadUrls: Record<string, string | undefined>, version: string | undefined }>}
 */
export async function fetchLatestMkcertReleaseAssets(options = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
    const cacheFilePath = options.cacheFilePath ?? DEFAULT_CACHE_FILE_PATH;

    const now = Date.now();

    // Return in-memory cache if fresh.
    if (memoryCacheHolder.current && ((now - memoryCacheHolder.current.timestamp) < ttlMs)) {
        return memoryCacheHolder.current.data;
    }

    // Try reading disk cache.
    const cache = await readCache(cacheFilePath);
    if (cache && ((now - cache.timestamp) < ttlMs)) {
        memoryCacheHolder.current = cache;
        return cache.data;
    }

    // Fetch fresh release data from `GitHub` API.
    try {
        const response = await fetch(
            'https://api.github.com/repos/FiloSottile/mkcert/releases/latest',
            {
                headers: {
                    Accept:       'application/vnd.github+json',
                    'User-Agent': 'vite-plugin-mkcert-containerized',
                },
            },
        );

        if (!response.ok) throw new Error(`Failed to fetch \`mkcert\` release metadata (${response.status} ${response.statusText}).`);

        const release = await response.json();
        const downloadUrls = {};

        const assets = release.assets ?? [];
        for (const asset of assets) {
            if (typeof asset?.name !== 'string') continue;
            if (typeof asset?.browser_download_url !== 'string') continue;
            if (!asset.name.startsWith('mkcert-')) continue;

            const binaryKey = asset.name.replace(/^mkcert-v[^-]+-/, '').replace(/\.exe$/, '');
            downloadUrls[binaryKey] = asset.browser_download_url;
        }

        const data = {
            downloadUrls,
            version: (typeof release.tag_name === 'string') ? release.tag_name : undefined,
        };

        const cacheEntry = { timestamp: now, data };
        memoryCacheHolder.current = cacheEntry;
        await writeCache(cacheFilePath, cacheEntry);

        return data;
    }
    // Fall back to cache if available (even if expired), or stable hardcoded defaults.
    catch {
        if (memoryCacheHolder.current?.data) return memoryCacheHolder.current.data;
        if (cache?.data) return cache.data;

        // If `GitHub` API is rate-limited or unreachable and no disk cache exists, provide known stable fallback.
        return {
            downloadUrls: { ...FALLBACK_DOWNLOAD_URLS },
            version:      FALLBACK_MKCERT_VERSION,
        };
    }
}
