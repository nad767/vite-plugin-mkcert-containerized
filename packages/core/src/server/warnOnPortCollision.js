import { DEFAULT_VITE_PORT } from '../consts.js';

/**
 * Check for port collisions between `Vite` and the ephemeral server, and emit an appropriate warning when detected.
 *
 * @param {Object} [params] Configuration parameters.
 * @param {number | string} [params.pluginPort] Resolved port for `vite-plugin-mkcert-containerized`.
 * @param {boolean} [params.pluginStrictPort=false] Whether `strictPort` is enabled on the plugin's ephemeral server.
 * @param {number | string} [params.vitePort=DEFAULT_VITE_PORT] Configured port for `Vite` server/preview.
 * @param {boolean} [params.viteStrictPort=false] Whether `strictPort` is enabled on `Vite`.
 * @returns {string | null} The warning message that was emitted, or `null` if no collision occurred.
 */
export function warnOnPortCollision({
    pluginPort,
    pluginStrictPort = false,
    vitePort = DEFAULT_VITE_PORT,
    viteStrictPort = false,
} = {}) {
    // Return early if no plugin port is provided.
    if ((pluginPort === undefined) || (pluginPort === null)) return null;

    const normPluginPort = Number(pluginPort);
    // Ignore invalid or out-of-range port numbers.
    if (
        !Number.isSafeInteger(normPluginPort)
        || (normPluginPort < 1)
        || (normPluginPort > 65_535)
    ) return null;

    let normVitePort = Number(vitePort);
    // Fall back to `Vite`'s default port if `Vite`'s port setting is omitted or invalid.
    if (
        !Number.isSafeInteger(normVitePort)
        || (normVitePort < 1)
        || (normVitePort > 65_535)
    ) normVitePort = DEFAULT_VITE_PORT;

    // No collision when ports differ.
    if (normPluginPort !== normVitePort) return null;

    const isPluginStrict = Boolean(pluginStrictPort);
    const isViteStrict = Boolean(viteStrictPort);

    let message;

    // Both `Vite` and the plugin enforce `strictPort`.
    if (isPluginStrict && isViteStrict) {
        message = `[vite-plugin-mkcert-containerized] Critical port collision: Both Vite and the plugin are configured to use port ${normPluginPort} with "strictPort: true". Whichever server initializes later is guaranteed to fail startup.`;
    }
    // Exactly one entity enforces `strictPort`.
    else if (isPluginStrict || isViteStrict) {
        const strictTarget = isPluginStrict ? 'the plugin' : 'Vite';
        const otherTarget = isPluginStrict ? 'Vite' : 'the plugin';
        message = `[vite-plugin-mkcert-containerized] Potential startup failure: Both Vite and the plugin are configured to use port ${normPluginPort}, with "strictPort: true" enabled on ${strictTarget}. If ${strictTarget} initializes after ${otherTarget}, ${strictTarget} will fail to start.`;
    }
    // Neither entity enforces `strictPort`.
    else {
        message = `[vite-plugin-mkcert-containerized] Port collision detected: The plugin's configured port (${normPluginPort}) matches Vite's server port. Whichever server initializes later will be forced to increment to the next available port.`;
    }

    console.warn(message);
    return message;
}
