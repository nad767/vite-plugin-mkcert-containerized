import { isIP } from 'node:net';

/**
 * Check whether an incoming HTTP request `Host` header is permitted based on `allowedHosts` settings.
 *
 * DNS rebinding attacks occur when a malicious webpage in a browser makes requests.
 * It rebinds its own domain name to a local IP address (such as `127.0.0.1`).
 * Browsers enforce the `Same-Origin Policy` (SOP) to protect local resources.
 * However, DNS rebinding tricks the browser into believing requests are same-origin.
 *
 * Validating `Host` headers is necessary specifically when serving over `http` (not `https`).
 * The ephemeral server operates over `http` because its purpose is to distribute the CA trust bundle needed to enable `https`.
 * Because the server cannot use `https` prior to trust establishment, enforcing host header validation is an essential security measure.
 *
 * Like `vite`'s `allowedHosts`, raw IP addresses and `localhost` are allowed by default.
 *
 * @param {string | undefined} reqHostHeader The raw `Host` header from the HTTP request.
 * @param {string[] | boolean | string | undefined} allowedHosts The `allowedHosts` option provided in options or `vite` configuration.
 * @param {string} [serverHost] The bound host IP or hostname of the server.
 * @returns {boolean} `true` if host is permitted, `false` otherwise.
 */
export function isHostAllowed(reqHostHeader, allowedHosts, serverHost) {
    if (!reqHostHeader) return false;

    // Short-circuit early if `allowedHosts` permits all hosts (`true`, `'*'`, or an array containing `'*'`).
    const isAllowedHostsWildcard = (allowedHosts === true) || (allowedHosts === '*') || (Array.isArray(allowedHosts) && allowedHosts.includes('*'));
    if (isAllowedHostsWildcard) return true;

    // Strip port from Host header (e.g. "localhost:25173" -> "localhost", "[::1]:25173" -> "[::1]", "::1" -> "::1").
    let reqHostname = reqHostHeader.trim();
    if (reqHostname.startsWith('[')) {
        const closingBracketIndex = reqHostname.indexOf(']');
        if (closingBracketIndex !== -1) {
            reqHostname = reqHostname.slice(0, closingBracketIndex + 1);
        }
    }
    else {
        const colonCount = (reqHostname.match(/:/g) || []).length;
        if (colonCount === 1) {
            const colonIndex = reqHostname.indexOf(':');
            reqHostname = reqHostname.slice(0, colonIndex);
        }
    }

    reqHostname = reqHostname.toLowerCase();

    // Extract raw IP string for `net.isIP()` validation (strip brackets if IPv6 e.g. "[::1]" -> "::1").
    const rawIpCandidate = (reqHostname.startsWith('[') && reqHostname.endsWith(']')) ? reqHostname.slice(1, -1) : reqHostname;

    // Allow all raw IP addresses by default, as IP addresses cannot be spoofed via DNS rebinding.
    if (isIP(rawIpCandidate) !== 0) return true;

    // Allow `localhost` by default.
    if (reqHostname === 'localhost') return true;

    // Allow matching against explicitly configured `serverHost`, if provided.
    if (serverHost) {
        const normalizedServerHost = serverHost.toLowerCase().trim();
        if (reqHostname === normalizedServerHost) return true;
    }

    // Normalize `allowedHosts` configuration into a list of allowed patterns.
    let patterns;
    if (Array.isArray(allowedHosts)) patterns = allowedHosts;
    else if ((typeof allowedHosts === 'string') && (allowedHosts.length > 0)) patterns = [allowedHosts];
    else patterns = [];

    for (const pattern of patterns) {
        if ((typeof pattern !== 'string') || (pattern.length === 0)) continue;

        const normalizedPattern = pattern.toLowerCase().trim();

        if ((normalizedPattern === '*') || (normalizedPattern === reqHostname)) return true;

        // Subdomain matching rules: e.g. ".example.com" or "*.example.com".
        if (normalizedPattern.startsWith('.')) {
            const domain = normalizedPattern.slice(1);
            if ((reqHostname === domain) || reqHostname.endsWith(normalizedPattern)) return true;
        }
        else if (normalizedPattern.startsWith('*.')) {
            const domain = normalizedPattern.slice(2);
            if (reqHostname.endsWith(`.${domain}`)) return true;
        }
    }

    return false;
}
