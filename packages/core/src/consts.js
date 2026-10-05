import { tmpdir } from 'node:os';
import path from 'node:path';

export const DEFAULT_MODE = 'auto';

export const DEFAULT_TIMEOUT_MS = 120_000;

export const DEFAULT_MIN_REUSE_TTL_MS = 30_000;

export const DEFAULT_BUNDLE_BINARIES = false;

/**
 * We default to `0.0.0.0` (all interfaces), rather than to `localhost` (like `vite` does for its `host` option),
 * because we assume that we're running inside a container, where `localhost` would be inaccessible from the host machine.
 * However, if the user set `host`, we'll use their value, as we assume they somehow made it accessible from the host machine.
 */
export const DEFAULT_HOST = '0.0.0.0';

export const WILDCARD_SERVER_HOSTS = ['0.0.0.0', '::', '::0', '0:0:0:0:0:0:0:0'];

// With the following, the plugin's default port would be `25173` (`(5173 % 10000) + 20000`), which plays on `Vite`'s default port (5173) with prefix `2` (keypad `C` for Cert/CA).
export const DEFAULT_VITE_PORT = 5173;
export const VITE_PORT_OFFSET = 20_000;
export const VITE_PORT_MODULO = 10_000;
export const DEFAULT_PORT_COLLISION_OFFSET = 1000;

export const ERRONEOUS_MKCERT_TOKENS = ['certutil', 'keychain', 'nss', 'trust', 'permission denied', 'sudo'];

export const DEFAULT_BIN_CACHE_DIR = path.join(tmpdir(), 'vite-plugin-mkcert-containerized', 'bin');

export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours.
export const DEFAULT_CACHE_FILE_PATH = path.join(tmpdir(), 'vite-plugin-mkcert-containerized', 'mkcert-release-cache.json');

export const MKCERT_TARGETS = Object.freeze([
    Object.freeze({ binaryKey: 'darwin-amd64', binaryFilename: 'mkcert-darwin-amd64', envKey: 'MKCERT_DARWIN_AMD64_URL' }),
    Object.freeze({ binaryKey: 'darwin-arm64', binaryFilename: 'mkcert-darwin-arm64', envKey: 'MKCERT_DARWIN_ARM64_URL' }),
    Object.freeze({ binaryKey: 'linux-amd64', binaryFilename: 'mkcert-linux-amd64', envKey: 'MKCERT_LINUX_AMD64_URL' }),
    Object.freeze({ binaryKey: 'linux-arm', binaryFilename: 'mkcert-linux-arm', envKey: 'MKCERT_LINUX_ARM_URL' }),
    Object.freeze({ binaryKey: 'linux-arm64', binaryFilename: 'mkcert-linux-arm64', envKey: 'MKCERT_LINUX_ARM64_URL' }),
    Object.freeze({ binaryKey: 'windows-amd64', binaryFilename: 'mkcert-windows-amd64.exe', envKey: 'MKCERT_WINDOWS_AMD64_URL' }),
    Object.freeze({ binaryKey: 'windows-arm64', binaryFilename: 'mkcert-windows-arm64.exe', envKey: 'MKCERT_WINDOWS_ARM64_URL' }),
]);
