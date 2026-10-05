import { defineConfig } from 'vite';
import mkcertContainerized from 'vite-plugin-mkcert-containerized';

// Changes to `core` package are watched at the `Node.js` process level (via `--watch-path` in `package.json`), rather than from `vite`, so the entire playground restarts, including re-logging instructions, while working on the `core` package.
export default defineConfig({
    server: {
        host:  '0.0.0.0', // Equivalent to `true`. Note that we assume we're running inside a container, so we need to bind to all interfaces for the host to be able to access the server.
        port:  3500,
        https: true,
    },
    plugins: [
        mkcertContainerized({
            bundleBinaries: true,
            debug:          true,
        }),
    ],
});
