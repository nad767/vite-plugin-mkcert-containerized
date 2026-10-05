import { debugLog } from '../utils/debug.js';
import { activeServers } from './activeServers.js';

/**
 * Close and evict active ephemeral servers matching the specified filter criteria, or all active servers if no filter is provided.
 *
 * @param {Object} [filter] Optional filter criteria.
 * @param {string} [filter.projectName] Project name to match against server keys.
 * @param {string} [filter.savePath] CA certificate save directory to match against server keys.
 * @param {import('node:http').Server} [filter.server] Specific HTTP server instance to close.
 * @returns {Promise<number>} Number of servers closed.
 */
export async function closeActiveEphemeralServers({ projectName, savePath, server } = {}) {
    const closePromises = [];

    for (const [key, serverState] of activeServers.entries()) {
        const matchesServer = !server || (serverState.server === server);
        const matchesProject = !projectName || key.startsWith(`${projectName}::`);
        const matchesSavePath = !savePath || key.includes(`::${savePath}::`);

        if (matchesServer && matchesProject && matchesSavePath) {
            debugLog(`Closing and evicting active ephemeral server for key "${key}".`);
            activeServers.delete(key);
            clearTimeout(serverState.closeTimer);
            serverState.server.closeAllConnections?.();
            if (serverState.server.listening) {
                const closePromise = new Promise(resolve => {
                    serverState.server.once('close', resolve);
                    serverState.server.close();
                });
                closePromises.push(closePromise);
            }
            else {
                serverState.server.close();
            }
        }
    }

    await Promise.all(closePromises);
    return closePromises.length;
}
