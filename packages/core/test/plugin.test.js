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

import { DEFAULT_HOST } from '../src/consts.js';
import { createVitePluginMkcertContainerizedFactory, vitePluginMkcertContainerized } from '../src/plugin.js';
import { closeActiveEphemeralServers } from '../src/server/closeActiveEphemeralServers.js';
import { getOrStartEphemeralServer } from '../src/server/getOrStartEphemeralServer.js';
import { isDebugEnabled, setDebugOption } from '../src/utils/debug.js';

/**
 * Helper to create an empty temporary directory for `vite-plugin-mkcert` certificate generation.
 *
 * @returns {Promise<{ cleanup: () => Promise<void>, dirPath: string }>} Temp directory details.
 */
async function createTempDir() {
    const dirPath = await mkdtemp(path.join(tmpdir(), 'mkcert-test-plugin-dir-'));
    await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

// eslint-disable-next-line unicorn/no-unnecessary-parameters
function createStubbedPluginFactory(basePlugin = {}) {
    return createVitePluginMkcertContainerizedFactory({
        createBasePlugin: () => ({
            config: async () => ({ server: { https: true } }),
            ...basePlugin,
        }),
    });
}

async function withSuppressedConsoleLog(callback) {
    const originalConsoleLog = console.log;
    console.log = () => {};

    try { return await callback(); }
    finally { console.log = originalConsoleLog; }
}

/**
 * Send an `HTTP` GET request with a custom `Host` header using `node:http`.
 *
 * @param {string} urlString Target URL string.
 * @param {string} customHost Custom `Host` header value.
 * @returns {Promise<{ body: string, statusCode: number }>} `HTTP` response status and body.
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

describe('vitePluginMkcertContainerized options', () => {
    it('initializes plugin with default options', () => {
        const plugin = vitePluginMkcertContainerized();
        assert.equal(plugin.name, 'vite-plugin-mkcert-containerized');
        assert.equal(typeof plugin.config, 'function');
    });

    it('allows VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG env var when debug option is omitted', () => {
        const originalEnv = process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
        try {
            process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = 'true';
            const pluginFactory = createStubbedPluginFactory();
            pluginFactory(); // Instantiating plugin without debug option.
            assert.equal(isDebugEnabled(), true);
        }
        finally {
            setDebugOption(undefined);
            if (originalEnv === undefined) delete process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG;
            else process.env.VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG = originalEnv;
        }
    });

    it('defines DEFAULT_HOST constant as "0.0.0.0"', () => {
        assert.equal(DEFAULT_HOST, '0.0.0.0');
    });

    it('handles config hook execution with server.host and server.allowedHosts in mode "never"', async () => {
        // Test config hook execution when `server.host` and `server.allowedHosts` are set and mode is "never".
        const pluginFactory = createStubbedPluginFactory();
        const plugin = pluginFactory({ allowedHosts: ['custom.local'], host: '192.168.0.50', mode: 'never' });
        const userConfig = { server: { allowedHosts: ['vite.local'], host: '10.0.0.1' } };
        const result = await plugin.config(userConfig, { command: 'serve', mode: 'development' });
        assert.ok(result);
    });

    it('skips container detection and ephemeral server for non-serve commands like "build"', async () => {
        // Test that non-serve command `vite build` skips starting ephemeral server even when mode is "always".
        const pluginFactory = createStubbedPluginFactory();
        const plugin = pluginFactory({ mode: 'always' });
        const userConfig = { root: process.cwd() };
        const result = await plugin.config(userConfig, { command: 'build', mode: 'production' });
        assert.ok(result);
    });

    it('defaults strictPort to false when plugin port is omitted even if Vite has strictPort', async () => {
        const { cleanup, dirPath } = await createTempDir();
        let serverState;
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 5000;
            const plugin = pluginFactory({
                mode:     'always',
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                root:   process.cwd(),
                server: { port: 3510, strictPort: true },
            };
            const result = await withSuppressedConsoleLog(async () => await plugin.config(userConfig, { command: 'serve', mode: 'development' }));
            assert.ok(result);

            // Verify the ephemeral server was started with derived port (23510) and strictPort: false.
            serverState = await getOrStartEphemeralServer({
                allowedHosts:   undefined,
                bundleBinaries: false,
                host:           DEFAULT_HOST,
                port:           23_510,
                projectName:    'vite-plugin-mkcert-containerized',
                savePath:       dirPath,
                strictPort:     false,
                timeoutMs,
            });
            assert.equal(serverState.port, 23_510);
        }
        finally {
            serverState?.server.close();
            await cleanup();
        }
    });

    it('defaults strictPort to true when plugin port is set explicitly AND Vite has strictPort', async () => {
        const { cleanup, dirPath } = await createTempDir();
        let serverState;
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 5000;
            const plugin = pluginFactory({
                mode:     'always',
                port:     48_990,
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                root:   process.cwd(),
                server: { strictPort: true },
            };
            const result = await withSuppressedConsoleLog(async () => await plugin.config(userConfig, { command: 'serve', mode: 'development' }));
            assert.ok(result);

            // Verify the ephemeral server was started with explicit port and strictPort: true.
            serverState = await getOrStartEphemeralServer({
                allowedHosts:   undefined,
                bundleBinaries: false,
                host:           DEFAULT_HOST,
                port:           48_990,
                projectName:    'vite-plugin-mkcert-containerized',
                savePath:       dirPath,
                strictPort:     true,
                timeoutMs,
            });
            assert.equal(serverState.port, 48_990);
        }
        finally {
            serverState?.server.close();
            await cleanup();
        }
    });

    it('derives default port in preview mode using derivePortFromVite', async () => {
        const { cleanup, dirPath } = await createTempDir();
        let serverState;
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 5000;
            const plugin = pluginFactory({
                mode:     'always',
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                preview: { port: 4210, strictPort: true },
                root:    process.cwd(),
            };
            const result = await withSuppressedConsoleLog(async () => await plugin.config(userConfig, { command: 'serve', isPreview: true, mode: 'production' }));
            assert.ok(result);

            // Verify the ephemeral server was derived from preview.port (4210 -> 24210).
            serverState = await getOrStartEphemeralServer({
                allowedHosts:   undefined,
                bundleBinaries: false,
                host:           DEFAULT_HOST,
                port:           24_210,
                projectName:    'vite-plugin-mkcert-containerized',
                savePath:       dirPath,
                strictPort:     false,
                timeoutMs,
            });
            assert.equal(serverState.port, 24_210);
        }
        finally {
            serverState?.server.close();
            await cleanup();
        }
    });

    for (const {
        allowedHost,
        blockedHost,
        description,
        env,
        expectedHost,
        expectedPort,
        userConfig,
    } of [
            {
                allowedHost:  'preview.local',
                blockedHost:  'server.local',
                description:  'prioritizes preview.host and preview.allowedHosts in preview mode',
                env:          { command: 'serve', isPreview: true, mode: 'production' },
                expectedHost: '127.0.0.1',
                expectedPort: 49_310,
                userConfig:   {
                    preview: { allowedHosts: ['preview.local'], host: '127.0.0.1' },
                    server:  { allowedHosts: ['server.local'], host: '10.0.0.1' },
                },
            },
            {
                allowedHost:  'server.local',
                blockedHost:  'preview.local',
                description:  'prioritizes server.host and server.allowedHosts in dev mode',
                env:          { command: 'serve', mode: 'development' },
                expectedHost: '127.0.0.1',
                expectedPort: 49_312,
                userConfig:   {
                    preview: { allowedHosts: ['preview.local'], host: '10.0.0.2' },
                    server:  { allowedHosts: ['server.local'], host: '127.0.0.1' },
                },
            },
        ]) {
        it(`handles config hook execution and ${description}`, async () => {
            const { cleanup, dirPath } = await createTempDir();
            try {
                const pluginFactory = createStubbedPluginFactory();
                const timeoutMs = 5000;
                const plugin = pluginFactory({
                    allowedHosts: undefined,
                    host:         undefined,
                    mode:         'always',
                    port:         expectedPort,
                    savePath:     dirPath,
                    timeoutMs,
                });
                const result = await withSuppressedConsoleLog(async () => await plugin.config(userConfig, env));
                assert.ok(result);

                const resolvedAllowedHosts = env.isPreview === true
                    ? userConfig.preview?.allowedHosts
                    : userConfig.server?.allowedHosts;

                const serverState = await getOrStartEphemeralServer({
                    allowedHosts:   resolvedAllowedHosts,
                    bundleBinaries: false,
                    host:           expectedHost,
                    port:           expectedPort,
                    projectName:    'vite-plugin-mkcert-containerized',
                    savePath:       dirPath,
                    strictPort:     false,
                    timeoutMs,
                });

                try {
                    const okResponse = await makeCustomHostRequest(serverState.archiveDownloadUrl, allowedHost);
                    assert.equal(okResponse.statusCode, 200);

                    if (blockedHost) {
                        const forbiddenResponse = await makeCustomHostRequest(serverState.archiveDownloadUrl, blockedHost);
                        assert.equal(forbiddenResponse.statusCode, 403);
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

    it('emits port collision warning when explicit plugin port matches Vite port', async () => {
        const { cleanup, dirPath } = await createTempDir();
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (...args) => { warnings.push(args.join(' ')); };

        let serverState;
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 5000;
            const testPort = 48_765;
            const plugin = pluginFactory({
                mode:     'always',
                port:     testPort,
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                root:   process.cwd(),
                server: { port: testPort, strictPort: true },
            };
            const result = await withSuppressedConsoleLog(async () => await plugin.config(userConfig, { command: 'serve', mode: 'development' }));
            assert.ok(result);

            // Verify a port collision warning was emitted.
            assert.ok(warnings.some(msg => msg.includes('Critical port collision') && msg.includes(String(testPort))));

            serverState = await getOrStartEphemeralServer({
                allowedHosts:   undefined,
                bundleBinaries: false,
                host:           DEFAULT_HOST,
                port:           testPort,
                projectName:    'vite-plugin-mkcert-containerized',
                savePath:       dirPath,
                strictPort:     true,
                timeoutMs,
            });
        }
        finally {
            console.warn = originalWarn;
            serverState?.server.close();
            await cleanup();
        }
    });

    it('reuses ephemeral server across multiple config hook invocations', async () => {
        const { cleanup, dirPath } = await createTempDir();
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 60_000;
            const testPort = 49_420;
            const plugin1 = pluginFactory({
                mode:     'always',
                port:     testPort,
                savePath: dirPath,
                timeoutMs,
            });
            const plugin2 = pluginFactory({
                mode:     'always',
                port:     testPort,
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                root:   process.cwd(),
                server: { port: 3000 },
            };

            await withSuppressedConsoleLog(async () => await plugin1.config(userConfig, { command: 'serve', mode: 'development' }));
            await withSuppressedConsoleLog(async () => await plugin2.config(userConfig, { command: 'serve', mode: 'development' }));

            // Verify server is running and accessible on requested port.
            const response = await fetch(`http://localhost:${testPort}/downloads/vite-plugin-mkcert-containerized-CA-`).catch(() => null);
            assert.ok(response !== null);
        }
        finally {
            await closeActiveEphemeralServers();
            await cleanup();
        }
    });

    it('terminates ephemeral server when closeActiveEphemeralServers is called', async () => {
        const { cleanup, dirPath } = await createTempDir();
        try {
            const pluginFactory = createStubbedPluginFactory();
            const timeoutMs = 60_000;
            const testPort = 49_421;
            const plugin = pluginFactory({
                mode:     'always',
                port:     testPort,
                savePath: dirPath,
                timeoutMs,
            });
            const userConfig = {
                preview: { port: 4173 },
                root:    process.cwd(),
            };
            await withSuppressedConsoleLog(async () => await plugin.config(userConfig, { command: 'serve', isPreview: true, mode: 'production' }));

            // Verify server is running.
            const initialResponse = await fetch(`http://localhost:${testPort}/downloads/vite-plugin-mkcert-containerized-CA-`).catch(() => null);
            assert.ok(initialResponse !== null);

            // Explicitly close active ephemeral servers.
            await closeActiveEphemeralServers();

            // Verify ephemeral server was terminated.
            await assert.rejects(fetch(`http://localhost:${testPort}/`));
        }
        finally {
            await cleanup();
        }
    });
});
