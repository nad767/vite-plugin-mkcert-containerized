import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Resolve the `savePath` exactly the way `vite-plugin-mkcert` does so copied CA files come from the same CAROOT.
 *
 * @param {import('vite-plugin-mkcert').MkcertPluginOptions} [options]
 * @returns {string}
 */
export function getBasePluginOutputDir(options = {}) {
    return path.resolve(options.savePath ?? path.join(homedir(), '.vite-plugin-mkcert'));
}
