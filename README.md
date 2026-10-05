# vite-plugin-mkcert-containerized

A wrapper of – and drop-in replacement for – [`vite-plugin-mkcert`](https://github.com/liuweiGL/vite-plugin-mkcert).

In containerized environments (such as VSCode Devcontainers), exposes `mkcert`'s CA certificate and installation helpers via an ephemeral HTTP server, so they can be installed on the host machine.

In non-containerized environments, behaves identically to `vite-plugin-mkcert`.

## Motivation

`vite-plugin-mkcert` (and `mkcert` in general) installs the CA certificate on the system where it runs. In a (dev)containerized runtime, browsers on the host machine will still display HTTPS security warnings because the host does not trust the container-internal CA.

The common solution is to manually copy the CA certificate from the container to the host machine, then run `mkcert -install` on the host.

This plugin eases this process by spinning up a short-lived HTTP server inside the container which exposes a `.zip` archive containing the CA certificate, OS-specific installer scripts, and helper links/binaries for `mkcert`.

## Installation

Install as a dev dependency:

```bash
npm install -D vite-plugin-mkcert-containerized
# or using yarn / pnpm / bun
```

Then add it to the `plugins` array in your `vite.config.js` or `vite.config.ts` (if you're already using `vite-plugin-mkcert`, simply replace it with this plugin, while keeping the same options):

```javascript
import { defineConfig } from 'vite';
import mkcertContainerized from 'vite-plugin-mkcert-containerized';

export default defineConfig({
  server: {
    https: true,
  },
  plugins: [
    mkcertContainerized({
      // `vite-plugin-mkcert-containerized`-specific options (see below).
      bundleBinaries: true,

      // All other options are forwarded to `vite-plugin-mkcert` as-is:
      hosts: ['localhost', 'my-site.test'],
    }),
  ],
});
```

Now whenever a Vite dev/preview server is started in a containerized environment, the ephemeral download server will start and instructions will be printed to stdout:

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ vite-plugin-mkcert-containerized                                                          │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│ Trust the CA certificate on host machine:                                                 │
│                                                                                           │
│   1. Download CA certificate & installation helpers:                                      │
│      http://localhost:25173/downloads/my-project-CA-2026-08-02T17-00-00Z.zip              │
│                                                                                           │
│      · Link expires in 2 minutes (at 8:42:00 PM UTC+00:00).                               │
│        Restart the Vite dev server to renew.                                              │
│      · In a VSCode devcontainer setup, following the link from the integrated terminal    │
│        should automatically rewrite the port to its host mapping.                         │
│        Otherwise, you must rewrite the URL port manually (check VSCode's "Ports" tab).    │
│                                                                                           │
│   2. Extract the archive on your host machine and run the installer:                      │
│                                                                                           │
│      · Windows: install-rootCA.cmd or install-rootCA.ps1.                                 │
│      · macOS, Linux: install-rootCA.sh.                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## Options

The default options should work for the majority of use cases. For exceptional scenarios, the following options are available:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `mode` | `'auto'` \| `'always'` \| `'never'` | `'auto'` | Controls whether the ephemeral download server should start. `'auto'` detects containerized environments via heuristics; `'always'` forces server startup; `'never'` disables it, behaving as standard `vite-plugin-mkcert`. |
| `timeoutMs` | `number` | `120000` (2 minutes) | Expiration timeout in milliseconds for the HTTP server. Set to `0` or negative to disable timing-out. |
| `bundleBinaries` | `boolean` | `false` | If `true`, downloads and bundles `mkcert` binaries into the ZIP for offline installation on the host. |
| `host` | `string` \| `boolean` | `'0.0.0.0'` | Host or IP to bind the ephemeral download HTTP server (unlike `vite-plugin-mkcert`'s `hosts` option, which specifies certificate domains). Defaults to Vite config's `server.host` (or `preview.host`) before falling back to `'0.0.0.0'` (all interfaces). |
| `allowedHosts` | `string[]` \| `boolean` \| `string` | `'localhost'` + IPs | Restricts allowed `Host` headers to mitigate DNS rebinding attacks. Defaults to Vite config's `server.allowedHosts` (or `preview.allowedHosts`) before falling back to `localhost` and all IP addresses. |
| `port` | `number` | `25173` | Preferred port for the download HTTP server. Defaults to Vite config's `server.port` (or `preview.port`) as `(vitePort % 10000) + 20000` (or `+ 21000` when `20000 <= vitePort < 30000` to avoid collisions). |
| `strictPort` | `boolean` | `false` | If `true`, fails if `port` turns out to be occupied. Defaults to `true` if `port` option is explicitly set and Vite config's `server.strictPort` (or `preview.strictPort`) is `true`, otherwise `false`. |
| `debug` | `boolean` | `false` | If `true`, enables verbose logging. Can also be enabled by setting `VITE_PLUGIN_MKCERT_CONTAINERIZED_DEBUG` environment variable to `'true'` or `'1'`. If both are set, the plugin option takes precedence. |

Additional options are forwarded to `vite-plugin-mkcert` – see its [supported options](https://github.com/liuweiGL/vite-plugin-mkcert#parameters).

## Security Considerations

The ephemeral download server operates over plain HTTP to avoid a "catch-22" situation where the host machine throws HTTPS security warnings when trying to download the CA certificate from a server that is itself untrusted.

Risks associated with serving over plain HTTP are mitigated by the following measures:

- **No Private Keys**: The ZIP archive contains only public data (`rootCA.pem`, installer scripts, and optional `mkcert` binaries). CA and Vite server private keys are never bundled.
- **Host Validation**: By default, the ephemeral server validates the `Host` header of incoming requests against `allowedHosts` to prevent DNS rebinding attacks.
- **Short Lifespan**: By default, the ephemeral server auto-shuts down after a short period. This also helps free resources.
- **Disabled Outside Containers**: By default, the ephemeral server only starts in containerized environments, which are usually isolated from the public Internet.
