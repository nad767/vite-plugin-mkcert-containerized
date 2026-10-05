/**
 * Derive a deterministic unique cache key from ephemeral server configuration options.
 *
 * @param {Object} [params] Configuration parameters.
 * @param {string[] | boolean | string} [params.allowedHosts] Allowed host headers for the ephemeral HTTP server.
 * @param {boolean} [params.bundleBinaries=false] Whether platform binaries are bundled.
 * @param {string | boolean} [params.host=''] Host IP or hostname string for binding.
 * @param {string[] | string} [params.hosts] Target domain hostnames passed to the base `vite-plugin-mkcert` plugin.
 * @param {number | string} [params.port=''] Port number on which the ephemeral server listens.
 * @param {string} [params.projectName=''] Name of the project used in generated archive filenames.
 * @param {string} [params.savePath=''] Path to directory containing root CA certificates.
 * @param {boolean} [params.strictPort=false] Whether strict port binding is enabled.
 * @param {number | string} [params.timeoutMs=''] Server auto-shutdown timeout in milliseconds.
 * @returns {string} Deterministic cache key.
 */
export function deriveServerKey({
    allowedHosts,
    bundleBinaries = false,
    host = '',
    hosts,
    port = '',
    projectName = '',
    savePath = '',
    strictPort = false,
    timeoutMs = '',
} = {}) {
    const serializedAllowedHosts = JSON.stringify(allowedHosts ?? null);
    const serializedHosts = JSON.stringify(Array.isArray(hosts) ? hosts.toSorted((a, b) => String(a).localeCompare(String(b))) : (hosts ?? null));
    return `${projectName}::${savePath}::${timeoutMs}::${port}::${strictPort}::${bundleBinaries}::${host}::${serializedAllowedHosts}::${serializedHosts}`;
}
