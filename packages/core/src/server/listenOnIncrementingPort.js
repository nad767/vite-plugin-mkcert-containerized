/**
 * Listen on the requested starting port, or the first available port above it if strictPort is false.
 *
 * @param {Object} params
 * @param {string} params.host Host interface/IP address to bind the HTTP server to.
 * @param {number} params.port Preferred starting port number.
 * @param {import('node:http').Server} params.server `Node.js` HTTP server instance to bind.
 * @param {boolean} [params.strictPort=false] Whether to fail when preferred port is occupied instead of trying subsequent ports.
 * @returns {Promise<number>} Bound port number.
 */
export async function listenOnIncrementingPort({ host, port, server, strictPort = false }) {
    const MAX_PORT = 65_535;
    let nextPort = port;
    while (nextPort <= MAX_PORT) {
        try {
            await new Promise((resolve, reject) => {
                const cleanupListeners = () => {
                    server.removeAllListeners('error');
                    server.removeAllListeners('listening');
                };

                server.once('error', error => {
                    cleanupListeners();
                    reject(error);
                });

                server.once('listening', () => {
                    cleanupListeners();
                    resolve();
                });

                server.listen(nextPort, host);
            });

            return nextPort;
        }
        catch (err) {
            if (err?.code !== 'EADDRINUSE') throw err;
            if (strictPort) throw new Error(`Port ${nextPort} is already in use.`, { cause: err });
            nextPort += 1;
        }
    }

    throw new Error(`Unable to find an available port in the range ${port}-${MAX_PORT}.`);
}
