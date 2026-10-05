import {
    DEFAULT_PORT_COLLISION_OFFSET,
    DEFAULT_VITE_PORT,
    VITE_PORT_MODULO,
    VITE_PORT_OFFSET,
} from '../consts.js';

/**
 * Derive the default port for the ephemeral HTTP server based on `Vite`'s active server/preview port.
 *
 * Maps `vitePort` to `(vitePort % 10000) + VITE_PORT_OFFSET`, adding `DEFAULT_PORT_COLLISION_OFFSET` if they collide (i.e. `20000 <= vitePort < 30000`).
 *
 * @param {number | string} [vitePort=DEFAULT_VITE_PORT] Active `Vite` port (defaults to `DEFAULT_VITE_PORT`).
 * @returns {number} Derived default port within safe registered port range.
 */
export function derivePortFromVite(vitePort = DEFAULT_VITE_PORT) {
    let normVitePort = Number(vitePort);
    if (!Number.isSafeInteger(normVitePort) || (normVitePort < 1) || (normVitePort > 65_535)) {
        normVitePort = DEFAULT_VITE_PORT;
    }

    const pluginPort = (normVitePort % VITE_PORT_MODULO) + VITE_PORT_OFFSET;
    return (normVitePort === pluginPort)
        ? (pluginPort + DEFAULT_PORT_COLLISION_OFFSET)
        : pluginPort;
}
