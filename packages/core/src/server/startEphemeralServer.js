import { createServer } from 'node:http';

import { createHostTrustArchive } from '../archive/createHostTrustArchive.js';
import { debugLog } from '../utils/debug.js';
import { isHostAllowed } from './isHostAllowed.js';
import { listenOnIncrementingPort } from './listenOnIncrementingPort.js';
import { resolveHost } from './resolveHost.js';

/**
 * Start a short-lived HTTP server that directly serves the host trust CA zip archive.
 *
 * @param {Object} params
 * @param {number} [params.timeoutMs] Server auto-shutdown timeout in milliseconds.
 * @param {boolean} [params.bundleBinaries] Whether to pre-download and bundle platform-specific `mkcert` binaries into the archive.
 * @param {string | boolean} [params.host] Host IP or hostname string or boolean for binding the HTTP server.
 * @param {string[] | boolean | string} [params.allowedHosts] Allowed host headers for the ephemeral HTTP server.
 * @param {number} params.port Preferred starting port for the HTTP server.
 * @param {boolean} [params.strictPort] Whether to fail if preferred port is in use rather than trying subsequent ports.
 * @param {string} params.projectName Name of the project used in generated archive filename.
 * @param {string} params.savePath Path to directory containing root CA certificates.
 * @returns {Promise<{ archiveDownloadUrl: string, archiveContents: string[], archiveFileName: string, expiresAt: number, port: number, server: import('node:http').Server }>} Ephemeral server details.
 */
export async function startEphemeralServer({
    timeoutMs,
    bundleBinaries,
    host,
    allowedHosts,
    port,
    strictPort,
    projectName,
    savePath,
}) {
    // Resolve host option into normalized binding host string and display host string for URLs.
    const { boundHost, displayHost } = resolveHost(host);
    debugLog(`Starting ephemeral server setup for project "${projectName}".`);
    const isTimeoutEnabled = (typeof timeoutMs === 'number') && (timeoutMs > 0);
    const expiresAt = isTimeoutEnabled ? (Date.now() + timeoutMs) : undefined;
    const bundle = await createHostTrustArchive({ bundleBinaries, projectName, savePath });
    const downloadPathname = `/downloads/${encodeURIComponent(bundle.archiveFileName)}`;

    const server = createServer((request, response) => {
        debugLog(`Incoming HTTP request: ${request.method} ${request.url}`);
        if (!isHostAllowed(request.headers.host, allowedHosts, boundHost)) {
            debugLog(`Host header "${request.headers.host}" rejected by allowedHosts rule.`);
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Forbidden: Host header not allowed.');
            return;
        }

        // Support `GET` and `HEAD` so download clients (e.g. `curl -I`) can inspect `Content-Length` before downloading.
        if ((request.method !== 'GET') && (request.method !== 'HEAD')) {
            debugLog('Method not allowed for non-GET/HEAD request.');
            response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Method not allowed.');
            return;
        }

        let requestUrl;
        try {
            requestUrl = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
        }
        catch {
            debugLog(`Failed to parse request URL "${request.url}".`);
            response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Bad Request.');
            return;
        }

        if (requestUrl.pathname !== downloadPathname) {
            debugLog(`Path mismatch: expected "${downloadPathname}", got "${requestUrl.pathname}".`);
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Not found.');
            return;
        }

        debugLog('Serving CA trust archive ZIP download...');
        response.writeHead(200, {
            'Cache-Control':       'no-store',
            'Content-Disposition': `attachment; filename="${bundle.archiveFileName}"`,
            'Content-Length':      bundle.archiveBuffer.length,
            'Content-Type':        'application/zip',
        });

        if (request.method === 'HEAD') {
            response.end();
            return;
        }

        response.end(bundle.archiveBuffer);
    });

    const boundPort = await listenOnIncrementingPort({
        host: boundHost,
        port,
        server,
        strictPort,
    });
    debugLog(`Ephemeral server successfully bound to host "${boundHost}" on port ${boundPort}.`);

    let shutdownTimer;
    if (isTimeoutEnabled) {
        debugLog(`Setting shutdown timer for ${timeoutMs}ms.`);
        shutdownTimer = setTimeout(() => {
            debugLog('Auto-shutdown timeout reached; closing ephemeral server.');
            // Force-close active keep-alive connections so `Node.js` immediately releases the bound port.
            server.closeAllConnections?.();
            server.close();
        }, timeoutMs);
        shutdownTimer.unref?.();

        server.once('close', () => { clearTimeout(shutdownTimer); });
    }

    return {
        archiveContents:    bundle.archiveContents,
        archiveDownloadUrl: `http://${displayHost}:${boundPort}${downloadPathname}`,
        archiveFileName:    bundle.archiveFileName,
        closeTimer:         shutdownTimer,
        expiresAt,
        port:               boundPort,
        server,
    };
}
