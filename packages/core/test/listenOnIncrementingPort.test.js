import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { describe, it } from 'node:test';

import { listenOnIncrementingPort } from '../src/server/listenOnIncrementingPort.js';

describe('listenOnIncrementingPort', () => {
    it('binds server to the requested port when available', async () => {
        // Test binding to an available port.
        const server = createServer();
        try {
            const boundPort = await listenOnIncrementingPort({
                host: '127.0.0.1',
                port: 48_100,
                server,
            });
            assert.equal(boundPort, 48_100);
        }
        finally {
            server.close();
        }
    });

    it('increments port when initial port is occupied and strictPort is false', async () => {
        // Test port incrementing on occupied port.
        const occupiedServer = createServer();
        const testServer = createServer();

        try {
            await new Promise(resolve => occupiedServer.listen(48_101, '127.0.0.1', resolve));

            const boundPort = await listenOnIncrementingPort({
                host:       '127.0.0.1',
                port:       48_101,
                server:     testServer,
                strictPort: false,
            });

            assert.equal(boundPort, 48_102);
        }
        finally {
            occupiedServer.close();
            testServer.close();
        }
    });

    it('throws error when initial port is occupied and strictPort is true', async () => {
        // Test strictPort error throwing behavior.
        const occupiedServer = createServer();
        const testServer = createServer();

        try {
            await new Promise(resolve => occupiedServer.listen(48_103, '127.0.0.1', resolve));

            await assert.rejects(
                listenOnIncrementingPort({
                    host:       '127.0.0.1',
                    port:       48_103,
                    server:     testServer,
                    strictPort: true,
                }),
                /Port 48103 is already in use/,
            );
        }
        finally {
            occupiedServer.close();
            testServer.close();
        }
    });
});
