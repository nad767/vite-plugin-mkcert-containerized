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
    const dirPath = await mkdtemp(path.join(tmpdir(), 'mkcert-test-close-ca-'));
    await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

describe('closeActiveEphemeralServers', () => {
    afterEach(async () => {
        await closeActiveEphemeralServers();
    });

    it('closes and evicts active servers matching projectName filter', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverA = await getOrStartEphemeralServer({
                port:        49_401,
                projectName: 'project-a',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            const serverB = await getOrStartEphemeralServer({
                port:        49_402,
                projectName: 'project-b',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(activeServers.size, 2);

            // Close only project-a servers.
            const closed = await closeActiveEphemeralServers({ projectName: 'project-a' });
            assert.equal(closed, 1);
            assert.equal(activeServers.size, 1);
            const remainingKey = activeServers.keys().next().value;
            assert.equal(activeServers.has(remainingKey), true);

            serverB.server.close();
            serverA.server.close();
        }
        finally {
            await cleanup();
        }
    });

    it('closes and evicts active servers matching savePath filter', async () => {
        const ca1 = await createTempCaDir();
        const ca2 = await createTempCaDir();
        try {
            await getOrStartEphemeralServer({
                port:        49_403,
                projectName: 'proj',
                savePath:    ca1.dirPath,
                timeoutMs:   60_000,
            });

            await getOrStartEphemeralServer({
                port:        49_404,
                projectName: 'proj2',
                savePath:    ca2.dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(activeServers.size, 2);

            const closed = await closeActiveEphemeralServers({ savePath: ca1.dirPath });
            assert.equal(closed, 1);
            assert.equal(activeServers.size, 1);
        }
        finally {
            await closeActiveEphemeralServers();
            await ca1.cleanup();
            await ca2.cleanup();
        }
    });

    it('closes and evicts all active servers when no filter is provided', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            await getOrStartEphemeralServer({
                port:        49_405,
                projectName: 'proj-all-1',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            await getOrStartEphemeralServer({
                port:        49_406,
                projectName: 'proj-all-2',
                savePath:    dirPath,
                timeoutMs:   60_000,
            });

            assert.equal(activeServers.size, 2);

            const closed = await closeActiveEphemeralServers();
            assert.equal(closed, 2);
            assert.equal(activeServers.size, 0);
        }
        finally {
            await cleanup();
        }
    });
});
