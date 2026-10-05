import type { MkcertPluginOptions as BaseMkcertPluginOptions, BaseSource, SourceInfo } from 'vite-plugin-mkcert';
import type { PluginOption } from 'vite';

export type EphemeralServerMode = 'always' | 'never' | 'auto';

export type MkcertPluginOptions = BaseMkcertPluginOptions & {
    /**
     * Controls when the ephemeral host trust download server is started.
     * - 'auto': Only start if container heuristics or `mkcert` failures suggest a containerized environment.
     * - 'always': Always start the ephemeral server.
     * - 'never': Never start the ephemeral server.
     * @default 'auto'
     */
    mode?: EphemeralServerMode;
    /**
     * Controls how long the short-lived host helper server stays alive (in milliseconds). Set to 0 or negative to disable timing-out.
     * @default 120000
     */
    timeoutMs?: number;
    /**
     * Set to true to pre-download and bundle platform-specific `mkcert` binaries into the archive for 100% offline host installation.
     * @default false
     */
    bundleBinaries?: boolean;
    /**
     * Host or IP on which the short-lived host helper HTTP server will listen (binding/serving).
     * Note: This configures the network interface for the ephemeral download server, unlike the base `vite-plugin-mkcert` plugin's `hosts` option (which specifies domain names to include in the generated SSL certificate).
     * Defaults to `Vite` config's `server.host` (or `preview.host`) before falling back to `'0.0.0.0'` (all interfaces).
     * @default '0.0.0.0'
     */
    host?: string | boolean;
    /**
     * Allowed host headers for the ephemeral HTTP server to prevent DNS rebinding attacks.
     * Defaults to `Vite` config's `server.allowedHosts` (or `preview.allowedHosts`) before falling back to `'localhost'` and all IP addresses.
     * @default "'localhost' + IPs"
     */
    allowedHosts?: string[] | boolean | string;
    /**
     * The port on which the short-lived host helper server will listen.
     * Defaults to `Vite` config's `server.port` (or `preview.port`) as `(vitePort % 10000) + 20000` (or `+ 21000` when `20000 <= vitePort < 30000` to avoid collisions).
     * @default 25173
     */
    port?: number;
    /**
     * Set to true to fail if the ephemeral server port is already in use, instead of automatically trying the next available port.
     * Defaults to true if `port` option is explicitly set and `Vite` config's `server.strictPort` (or `preview.strictPort`) is true, otherwise false.
     * @default false
     */
    strictPort?: boolean;
    /**
     * Enable debug mode for verbose logging to the console. Can also be enabled via the `VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG` environment variable.
     * @default false
     */
    debug?: boolean;
};

declare const vitePluginMkcertContainerized: (options?: MkcertPluginOptions) => PluginOption;

export type { BaseSource, SourceInfo };
export { vitePluginMkcertContainerized };
export default vitePluginMkcertContainerized;
