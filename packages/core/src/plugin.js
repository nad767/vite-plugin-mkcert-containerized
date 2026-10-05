import path from 'node:path';
import vitePluginMkcert from 'vite-plugin-mkcert';

import { getBasePluginOutputDir } from './archive/getBasePluginOutputDir.js';
import { resolveArchiveProjectName } from './archive/resolveArchiveProjectName.js';
import { printInstructions } from './cli/printInstructions.js';
import {
    DEFAULT_BUNDLE_BINARIES,
    DEFAULT_HOST,
    DEFAULT_MODE,
    DEFAULT_TIMEOUT_MS,
} from './consts.js';
import { doesEnvSuggestContainer } from './container/doesEnvSuggestContainer.js';
import { doesMkcertErrSuggestContainer } from './container/doesMkcertErrSuggestContainer.js';
import { derivePortFromVite } from './server/derivePortFromVite.js';
import { getOrStartEphemeralServer } from './server/getOrStartEphemeralServer.js';
import { warnOnPortCollision } from './server/warnOnPortCollision.js';
import { debugLog, setDebugOption } from './utils/debug.js';

/**
 * Create the containerized plugin factory with an injectable `vite-plugin-mkcert` implementation.
 * The injectable factory keeps tests fast and deterministic without changing the public API.
 *
 * @param {{ createBasePlugin?: typeof vitePluginMkcert }} [dependencies] Injectable dependency options.
 * @param {typeof vitePluginMkcert} [dependencies.createBasePlugin] Custom base plugin creation function for dependency injection.
 * @returns {(options?: import('./index.d.ts').MkcertPluginOptions) => import('vite').PluginOption} Plugin creator function configured with injected dependencies.
 */
export function createVitePluginMkcertContainerizedFactory({ createBasePlugin = vitePluginMkcert } = {}) {
    return function vitePluginMkcertContainerized({
        mode = DEFAULT_MODE,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        bundleBinaries = DEFAULT_BUNDLE_BINARIES,
        host, // Intentionally `undefined` to allow derivation from `Vite`'s config when omitted by user.
        allowedHosts, // Likewise.
        port, // Likewise.
        strictPort, // Likewise.
        debug, // Intentionally `undefined` to allow derivation from `VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG` environment variable when omitted by user.
        ...basePluginOptions
    } = {}) {
        setDebugOption(debug);
        debugLog('Plugin initialized with options:', { mode, timeoutMs, bundleBinaries, host, allowedHosts, port, strictPort, debug });

        const basePlugin = createBasePlugin(basePluginOptions);
        const savePath = getBasePluginOutputDir(basePluginOptions);

        let ephemeralServerState;

        return {
            ...basePlugin,
            name:   'vite-plugin-mkcert-containerized',
            config: async (userConfig, env) => {
                debugLog('Executing Vite plugin config hook.');
                let basePluginResult, basePluginErr;
                try {
                    basePluginResult = await basePlugin.config?.(userConfig, env);
                    debugLog('basePlugin.config executed successfully.');
                }
                catch (err) {
                    basePluginErr = err;
                    debugLog('basePlugin.config threw an error:', err);
                }
                // Ephemeral server and host trust instructions should only be activated during `Vite` dev server startup (`vite` or `vite dev` or `vite serve`).
                // Short-circuit and skip container detection / HTTP server startup for non-serve commands such as `vite build`.
                if (env?.command !== 'serve') {
                    debugLog(`Skipping container detection and ephemeral server for non-serve command "${env?.command}".`);
                    if (basePluginErr) throw basePluginErr;
                    return basePluginResult;
                }

                let shouldServeArchive;
                switch (mode) {
                    case 'always': {
                        shouldServeArchive = true;
                        debugLog('Mode is "always"; enabling archive server.');
                        break;
                    }
                    case 'never': {
                        shouldServeArchive = false;
                        debugLog('Mode is "never"; skipping archive server.');
                        break;
                    }
                    case 'auto': {
                        debugLog('Mode is "auto"; evaluating container heuristics...');
                        const isEnvSuggestingContainer = await doesEnvSuggestContainer();
                        const isMkcertErrorSuggestingContainer = doesMkcertErrSuggestContainer(basePluginErr);
                        shouldServeArchive = isEnvSuggestingContainer || isMkcertErrorSuggestingContainer;
                        debugLog(`Auto evaluation complete. isEnvSuggestingContainer=${isEnvSuggestingContainer}, isMkcertErrorSuggestingContainer=${isMkcertErrorSuggestingContainer}.`);
                        break;
                    }
                    default: {
                        throw new Error(`[vite-plugin-mkcert-containerized] Invalid mode "${mode}". Expected "always", "never", or "auto".`);
                    }
                }

                if (shouldServeArchive) {
                    const rootDir = userConfig.root ? path.resolve(userConfig.root) : process.cwd();
                    const projectName = await resolveArchiveProjectName(rootDir);
                    // Distinguish between `Vite` dev server (`vite dev`) and preview server (`vite preview`).
                    const isPreview = (env?.isPreview === true) || process.argv.includes('preview');
                    const serveConfig = isPreview ? userConfig.preview : userConfig.server;

                    const resolvedHost = host ?? serveConfig?.host ?? DEFAULT_HOST;
                    const resolvedAllowedHosts = allowedHosts ?? serveConfig?.allowedHosts;
                    const resolvedPort = port ?? derivePortFromVite(serveConfig?.port);
                    const resolvedStrictPort = strictPort ?? Boolean(port && serveConfig?.strictPort);

                    // Check for port collisions when the resolved plugin port matches `Vite`'s port.
                    warnOnPortCollision({
                        pluginPort:       resolvedPort,
                        pluginStrictPort: resolvedStrictPort,
                        vitePort:         serveConfig?.port,
                        viteStrictPort:   serveConfig?.strictPort,
                    });

                    const hosts = basePluginOptions.hosts;

                    debugLog(`Resolved project name "${projectName}" from root dir "${rootDir}". Starting ephemeral server on port ${resolvedPort} (strictPort: ${resolvedStrictPort})...`);
                    try {
                        ephemeralServerState = await getOrStartEphemeralServer({
                            allowedHosts: resolvedAllowedHosts,
                            bundleBinaries,
                            host:         resolvedHost,
                            hosts,
                            port:         resolvedPort,
                            projectName,
                            savePath,
                            strictPort:   resolvedStrictPort,
                            timeoutMs,
                        });
                    }
                    // If the ephemeral download server fails to start, don't fail the whole plugin.
                    catch (err) {
                        console.error('[vite-plugin-mkcert-containerized] Failed to start ephemeral http server', err);
                    }

                    if (ephemeralServerState?.isNew) {
                        debugLog(`Ephemeral server ready at ${ephemeralServerState.archiveDownloadUrl}. Printing instructions...`);
                        printInstructions({ basePluginErr, ephemeralServerState });
                    }
                }

                if (basePluginErr) throw basePluginErr;

                return basePluginResult;
            },
        };
    };
}

/**
 * Create a `Vite` plugin wrapper for `vite-plugin-mkcert` that delegates certificate generation and automatically exposes the CA certificate and `mkcert` trust installation helpers via an ephemeral HTTP server when a containerized environment is detected.
 *
 * @type {(options?: import('./index.d.ts').MkcertPluginOptions) => import('vite').PluginOption}
 */
export const vitePluginMkcertContainerized = createVitePluginMkcertContainerizedFactory();
