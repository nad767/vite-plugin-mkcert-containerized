import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
import {
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { startEphemeralServer } from '../src/server/startEphemeralServer.js';

/**
 * Helper to create a temporary directory containing a dummy `rootCA.pem`.
 *
 * @returns {Promise<{ cleanup: () => Promise<void>, dirPath: string }>} Temp directory details.
 */
async function createTempCaDir() {
    const dirPath = await mkdtemp(path.join(tmpdir(), 'mkcert-test-server-ca-'));
    await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

/**
 * Send an HTTP GET request with a custom `Host` header using `node:http`.
 *
 * @param {string} urlString Target URL string.
 * @param {string} customHost Custom `Host` header value.
 * @returns {Promise<{ body: string, statusCode: number }>} HTTP response status and body.
 */
function makeCustomHostRequest(urlString, customHost) {
    const url = new URL(urlString);
    return new Promise((resolve, reject) => {
        const req = httpRequest({
            headers:  { Host: customHost },
            hostname: url.hostname,
            method:   'GET',
            path:     url.pathname,
            port:     url.port,
        }, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => resolve({ body, statusCode: res.statusCode }));
        });
        req.on('error', reject);
        req.end();
    });
}

describe('startEphemeralServer', () => {
    it('starts HTTP server and serves ZIP archive on exact download path', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Start ephemeral HTTP server on dynamic port.
            const serverState = await startEphemeralServer({
                timeoutMs:      60_000,
                bundleBinaries: false,
                port:           49_200,
                strictPort:     false,
                projectName:    'http-test',
                savePath:       dirPath,
            });

            try {
                assert.ok(serverState.archiveDownloadUrl.startsWith('http://localhost:'));
                assert.ok(serverState.closeTimer);

                // Test GET request to exact archive download path returns 200 and zip content type.
                const downloadResponse = await fetch(serverState.archiveDownloadUrl);
                assert.equal(downloadResponse.status, 200);
                assert.equal(downloadResponse.headers.get('content-type'), 'application/zip');
                assert.ok(downloadResponse.headers.get('content-disposition')?.includes(serverState.archiveFileName));

                // Test GET request to unmatched path returns 404 Not Found.
                const invalidPathUrl = `http://localhost:${serverState.port}/unmatched-path`;
                const notFoundResponse = await fetch(invalidPathUrl);
                assert.equal(notFoundResponse.status, 404);

                // Test POST request returns 405 Method Not Allowed.
                const methodNotAllowedResponse = await fetch(serverState.archiveDownloadUrl, { method: 'POST' });
                assert.equal(methodNotAllowedResponse.status, 405);
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('formats archiveDownloadUrl using custom non-wildcard host', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                timeoutMs:      60_000,
                bundleBinaries: false,
                host:           '127.0.0.1',
                port:           49_202,
                strictPort:     false,
                projectName:    'custom-host-test',
                savePath:       dirPath,
            });

            try {
                assert.ok(serverState.archiveDownloadUrl.startsWith('http://127.0.0.1:'));
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('handles boolean host: true as wildcard binding to 0.0.0.0 and formats displayHost as localhost', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                timeoutMs:      60_000,
                bundleBinaries: false,
                host:           true,
                port:           49_203,
                strictPort:     false,
                projectName:    'boolean-host-test',
                savePath:       dirPath,
            });

            try {
                assert.ok(serverState.archiveDownloadUrl.startsWith('http://localhost:'));
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('encloses raw unbracketed IPv6 host strings in square brackets in archiveDownloadUrl', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                timeoutMs:      60_000,
                bundleBinaries: false,
                host:           '::1',
                port:           49_204,
                strictPort:     false,
                projectName:    'ipv6-host-test',
                savePath:       dirPath,
            });

            try {
                assert.ok(serverState.archiveDownloadUrl.startsWith('http://[::1]:'));
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('handles disabled timeout (timeoutMs <= 0) without setting expiresAt', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Test non-expiring server mode when timeoutMs <= 0.
            const serverState = await startEphemeralServer({
                timeoutMs:      0,
                bundleBinaries: false,
                port:           49_205,
                strictPort:     false,
                projectName:    'no-timeout-test',
                savePath:       dirPath,
            });

            try {
                assert.equal(serverState.expiresAt, undefined);
                assert.equal(serverState.closeTimer, undefined);
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('rejects requests with unauthorized host headers with HTTP 403 Forbidden', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                timeoutMs:      60_000,
                bundleBinaries: false,
                allowedHosts:   ['allowed.local'],
                port:           49_210,
                strictPort:     false,
                projectName:    'host-check-test',
                savePath:       dirPath,
            });

            try {
                // Authorized Host header should succeed with 200 OK.
                const okResponse = await makeCustomHostRequest(serverState.archiveDownloadUrl, 'allowed.local');
                assert.equal(okResponse.statusCode, 200);

                // Unauthorized Host header should be rejected with 403 Forbidden.
                const forbiddenResponse = await makeCustomHostRequest(serverState.archiveDownloadUrl, 'attacker.com');
                assert.equal(forbiddenResponse.statusCode, 403);
                assert.ok(forbiddenResponse.body.includes('Forbidden'));
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('returns 400 Bad Request when request URL cannot be parsed', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                bundleBinaries: false,
                port:           49_211,
                projectName:    'bad-url-test',
                savePath:       dirPath,
                strictPort:     false,
                timeoutMs:      60_000,
            });

            try {
                // Send raw malformed request path that causes URL parsing to fail.
                const rawBadResponse = await new Promise((resolve, reject) => {
                    const req = httpRequest({
                        headers:  { Host: 'localhost' },
                        hostname: 'localhost',
                        method:   'GET',
                        path:     'http://[invalid-ipv6-bracket',
                        port:     serverState.port,
                    }, res => {
                        let body = '';
                        res.on('data', chunk => { body += chunk; });
                        res.on('end', () => resolve({ body, statusCode: res.statusCode }));
                    });
                    req.on('error', reject);
                    req.end();
                });
                assert.equal(rawBadResponse.statusCode, 400);
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    it('handles HEAD requests with HTTP 200, Content-Length header, and empty body', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const serverState = await startEphemeralServer({
                bundleBinaries: false,
                port:           49_212,
                projectName:    'head-test',
                savePath:       dirPath,
                strictPort:     false,
                timeoutMs:      60_000,
            });

            try {
                const url = new URL(serverState.archiveDownloadUrl);
                const headResponse = await new Promise((resolve, reject) => {
                    const req = httpRequest({
                        headers:  { Host: url.host },
                        hostname: url.hostname,
                        method:   'HEAD',
                        path:     url.pathname,
                        port:     url.port,
                    }, res => {
                        let body = '';
                        res.on('data', chunk => { body += chunk; });
                        res.on('end', () => resolve({
                            body,
                            contentLength: res.headers['content-length'],
                            contentType:   res.headers['content-type'],
                            statusCode:    res.statusCode,
                        }));
                    });
                    req.on('error', reject);
                    req.end();
                });

                assert.equal(headResponse.statusCode, 200);
                assert.equal(headResponse.contentType, 'application/zip');
                assert.ok(Number(headResponse.contentLength) > 0);
                assert.equal(headResponse.body, '');
            }
            finally {
                serverState.server.close();
            }
        }
        finally {
            await cleanup();
        }
    });

    for (const bundleBinaries of [false, true]) {
        it(`serves valid download archive containing expected files over HTTP when bundleBinaries is ${bundleBinaries}`, async () => {
            const { cleanup, dirPath } = await createTempCaDir();
            try {
                const serverState = await startEphemeralServer({
                    bundleBinaries,
                    port:        bundleBinaries ? 49_214 : 49_213,
                    projectName: 'http-bundle-test',
                    savePath:    dirPath,
                    strictPort:  false,
                    timeoutMs:   60_000,
                });

                try {
                    const response = await fetch(serverState.archiveDownloadUrl);
                    assert.equal(response.status, 200);

                    const arrayBuffer = await response.arrayBuffer();
                    const downloadedBuffer = new Uint8Array(arrayBuffer);
                    const entries = unzipSync(downloadedBuffer);
                    const entryNames = Object.keys(entries);

                    // Verify common essential files.
                    assert.ok(entryNames.includes('rootCA.pem'), 'Downloaded zip must include "rootCA.pem".');
                    assert.ok(entryNames.includes('INSTRUCTIONS.txt'), 'Downloaded zip must include "INSTRUCTIONS.txt".');
                    assert.ok(entryNames.includes('install-rootCA.sh'), 'Downloaded zip must include "install-rootCA.sh".');
                    assert.ok(entryNames.includes('manage-rootCA.sh'), 'Downloaded zip must include "manage-rootCA.sh".');

                    if (bundleBinaries) {
                        assert.ok(entryNames.includes('mkcert-linux-amd64'), 'Downloaded offline zip must include Linux mkcert binary.');
                        assert.ok(entryNames.includes('mkcert-windows-amd64.exe'), 'Downloaded offline zip must include Windows mkcert binary.');
                        assert.equal(entryNames.includes('mkcert-containerized.env'), false);
                    }
                    else {
                        assert.ok(entryNames.includes('mkcert-containerized.env'), 'Downloaded dynamic zip must include "mkcert-containerized.env".');
                        assert.equal(entryNames.some(name => name.startsWith('mkcert-') && !name.endsWith('.env')), false);
                    }
                }
                finally {
                    serverState.server.close();
                }
            }
            finally {
                await cleanup();
            }
        });
    }
});
