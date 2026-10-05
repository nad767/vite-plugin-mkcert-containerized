import assert from 'node:assert/strict';
import {
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
    afterEach,
    describe,
    it,
} from 'node:test';

import { activeServers } from '../src/server/activeServers.js';
import { closeActiveEphemeralServers } from '../src/server/closeActiveEphemeralServers.js';
import { getOrStartEphemeralServer } from '../src/server/getOrStartEphemeralServer.js';

/**
 * Helper to create a temporary directory containing a dummy `rootCA.pem`.
 *
 * @returns {Promise<{ cleanup: () => Promise<void>, dirPath: string }>} Temp directory details.
 */
async function createTempCaDir() {
    const dirPath = await mkdtemp(path.join(tmpdir(), 'mkcert-test-getstart-ca-'));
    await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

describe('getOrStartEphemeralServer', () => {
    afterEach(async () => {
        await closeActiveEphemeralServers();
    });

    it('reuses active server instance when called with identical options', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const server1 = await getOrStartEphemeralServer({
                port:        49_410,
                projectName: 'reuse-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            const server2 = await getOrStartEphemeralServer({
                port:        49_410,
                projectName: 'reuse-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(server1.server, server2.server);
            assert.equal(server1.isNew, true);
            assert.equal(server2.isNew, false);
            assert.equal(activeServers.size, 1);
        }
        finally {
            await cleanup();
        }
    });

    it('reuses active server instance when hosts arrays contain identical items in different order', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const server1 = await getOrStartEphemeralServer({
                hosts:       ['beta.local', 'alpha.local'],
                port:        49_415,
                projectName: 'hosts-order-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            const server2 = await getOrStartEphemeralServer({
                hosts:       ['alpha.local', 'beta.local'],
                port:        49_415,
                projectName: 'hosts-order-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(server1.server, server2.server);
            assert.equal(server1.isNew, true);
            assert.equal(server2.isNew, false);
            assert.equal(activeServers.size, 1);
        }
        finally {
            await cleanup();
        }
    });

    it('renews server when remaining TTL falls below the minimum renewal threshold', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const initialPort = 49_418;
            const server1 = await getOrStartEphemeralServer({
                port:        initialPort,
                projectName: 'ttl-threshold-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(server1.isNew, true);

            // Simulate remaining TTL dropping below 30s threshold (e.g. 5s remaining).
            for (const state of activeServers.values()) {
                state.expiresAt = Date.now() + 5000;
            }

            const server2 = await getOrStartEphemeralServer({
                port:        initialPort,
                projectName: 'ttl-threshold-test',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.notEqual(server1.server, server2.server);
            assert.equal(server2.port, initialPort);
            assert.equal(server2.isNew, true);
            assert.equal(activeServers.size, 1);
        }
        finally {
            await cleanup();
        }
    });

    it('evicts and closes previous server when called with modified options for the same project', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const initialPort = 49_411;
            const server1 = await getOrStartEphemeralServer({
                bundleBinaries: false,
                port:           initialPort,
                projectName:    'eviction-test',
                savePath:       dirPath,
                timeoutMs:      60_000,
            });

            assert.equal(server1.port, initialPort);
            assert.equal(server1.isNew, true);
            assert.equal(activeServers.size, 1);

            // Re-invoke with changed option (bundleBinaries: true) on the SAME port.
            // Because previous server is evicted and closed, the new server can bind to initialPort without collision.
            const server2 = await getOrStartEphemeralServer({
                bundleBinaries: true,
                port:           initialPort,
                projectName:    'eviction-test',
                savePath:       dirPath,
                timeoutMs:      60_000,
            });

            assert.notEqual(server1.server, server2.server);
            assert.equal(server2.port, initialPort);
            assert.equal(server2.isNew, true);
            assert.equal(activeServers.size, 1);
        }
        finally {
            await cleanup();
        }
    });
});
