import { DEFAULT_MIN_REUSE_TTL_MS } from '../consts.js';
import { debugLog } from '../utils/debug.js';
import { activeServers, pendingServers } from './activeServers.js';
import { closeActiveEphemeralServers } from './closeActiveEphemeralServers.js';
import { deriveServerKey } from './deriveServerKey.js';
import { startEphemeralServer } from './startEphemeralServer.js';

/**
 * Reuse a still-live host trust download server for the same CAROOT, hosts, and configuration, or start a fresh one if none is active or nearing expiration.
 *
 * This keyed server reuse ensures that when a single `Node.js` process orchestrates multiple `Vite` servers with identical
 * configuration (e.g. localized reverse proxies or micro-frontends), they share a single active ephemeral HTTP server instance
 * rather than attempting to bind competing servers to the same port.
 *
 * Inadvertently, flagging reused instances via `isNew: false` also prevents terminal message flooding by allowing
 * callers to suppress duplicate instruction banners for already-active servers.
 *
 * If an active server is nearing expiration (remaining TTL below the renewal threshold), it is proactively evicted and refreshed
 * with a full timeout window and a renewed instruction banner.
 *
 * @param {Object} params
 * @param {number} params.timeoutMs Server auto-shutdown timeout in milliseconds.
 * @param {boolean} [params.bundleBinaries] Whether to pre-download and bundle platform-specific `mkcert` binaries into the archive.
 * @param {string} [params.host] Host IP or hostname string for binding the HTTP server.
 * @param {string[] | boolean | string} [params.allowedHosts] Allowed host headers for the ephemeral HTTP server.
 * @param {string[] | string} [params.hosts] Target domain hostnames passed to the base `vite-plugin-mkcert` plugin.
 * @param {number} [params.port] Preferred port number for the HTTP server.
 * @param {boolean} [params.strictPort] Whether to fail if preferred port is in use rather than trying subsequent ports.
 * @param {string} params.projectName Name of the project used when creating download archive filenames.
 * @param {string} params.savePath Path to directory containing root CA certificates to serve.
 * @returns {Promise<{ archiveDownloadUrl: string, archiveContents: string[], archiveFileName: string, expiresAt: number, isNew: boolean, port: number, server: import('node:http').Server }>} Ephemeral server details.
 */
export async function getOrStartEphemeralServer({
    timeoutMs,
    bundleBinaries,
    host,
    allowedHosts,
    hosts,
    port,
    strictPort,
    projectName,
    savePath,
}) {
    const serverKey = deriveServerKey({
        allowedHosts,
        bundleBinaries,
        host,
        hosts,
        port,
        projectName,
        savePath,
        strictPort,
        timeoutMs,
    });

    debugLog(`Looking up ephemeral server for key "${serverKey}".`);

    const activeServer = activeServers.get(serverKey);
    if (activeServer) {
        const remainingMs = activeServer.expiresAt ? (activeServer.expiresAt - Date.now()) : Infinity;
        const minReuseTtl = ((typeof timeoutMs === 'number') && (timeoutMs > 0))
            ? Math.min(DEFAULT_MIN_REUSE_TTL_MS, timeoutMs / 2)
            : 0;

        if (remainingMs > minReuseTtl) {
            debugLog(`Reusing active ephemeral server instance (${Math.round(remainingMs / 1000)}s remaining).`);
            return {
                ...activeServer,
                isNew: false,
            };
        }

        debugLog(`Active ephemeral server has only ${Math.round(remainingMs / 1000)}s remaining (below ${Math.round(minReuseTtl / 1000)}s threshold); renewing with fresh server.`);
        // Terminate lingering connections and close expired or nearly-expired servers immediately to prevent port collisions when starting the replacement.
        activeServer.server.closeAllConnections?.();
        activeServer.server.close();
        activeServers.delete(serverKey);
    }

    // Close any previous servers running for the same project and CAROOT with differing configuration parameters.
    await closeActiveEphemeralServers({ projectName, savePath });

    const pendingServer = pendingServers.get(serverKey);
    if (pendingServer) {
        debugLog('Awaiting existing in-flight ephemeral server creation promise.');
        const serverState = await pendingServer;
        return {
            ...serverState,
            isNew: false,
        };
    }

    debugLog('No active or pending ephemeral server found; starting a new server...');

    const startServerPromise = startEphemeralServer({ timeoutMs, bundleBinaries, host, allowedHosts, port, strictPort, projectName, savePath })
        .then(serverState => {
            activeServers.set(serverKey, serverState);
            serverState.server.once('close', () => {
                debugLog(`Ephemeral server for key "${serverKey}" closed; removing from active servers.`);
                if (activeServers.get(serverKey) === serverState) {
                    activeServers.delete(serverKey);
                }
            });

            return serverState;
        });

    pendingServers.set(serverKey, startServerPromise);

    const newServerState = await startServerPromise.finally(() => pendingServers.delete(serverKey));
    return {
        ...newServerState,
        isNew: true,
    };
}
