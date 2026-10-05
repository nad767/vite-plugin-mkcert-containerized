import { isIP } from 'node:net';

import { DEFAULT_HOST, WILDCARD_SERVER_HOSTS } from '../consts.js';

/**
 * Resolve a host option value into a bound host string for server listening and a display host string for URLs.
 *
 * @param {string | boolean} [host] Host option value from plugin options or `Vite` configuration.
 * @returns {{ boundHost: string, displayHost: string }} Resolved binding host and display host.
 */
export function resolveHost(host) {
    let rawHost;
    if (host === true) rawHost = '0.0.0.0';
    else if (host === false) rawHost = '127.0.0.1';
    else if ((typeof host === 'string') && (host.trim().length > 0)) rawHost = host.trim();
    else rawHost = DEFAULT_HOST;

    // Strip outer brackets if present (e.g. "[::1]" -> "::1") to obtain a clean IP string for server binding.
    const boundHost = (rawHost.startsWith('[') && rawHost.endsWith(']')) ? rawHost.slice(1, -1) : rawHost;

    let displayHost;
    // Wildcard addresses bind to all interfaces.
    // We can't use them directly in URLs, so we map them to `localhost`, and hope the host machine resolves that to a reachable interface.
    if (WILDCARD_SERVER_HOSTS.includes(boundHost)) displayHost = 'localhost';
    // Enclose unbracketed raw IPv6 addresses in square brackets (e.g. "::1" -> "[::1]") for valid HTTP URL syntax.
    else if (isIP(boundHost) === 6) displayHost = `[${boundHost}]`;
    else displayHost = boundHost;

    return { boundHost, displayHost };
}
