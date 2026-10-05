import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
    chmod,
    copyFile,
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Helper to create a temporary test directory.
 *
 * @returns {Promise<{ cleanup: () => Promise<void>, dirPath: string }>} Temp directory details.
 */
async function createTempTestDir() {
    const dirPath = await mkdtemp(path.join(tmpdir(), 'manage-rootca-test-'));
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

describe('manage-rootCA script', () => {
    it('executes bundled binary when present without needing env file', async () => {
        const { cleanup, dirPath } = await createTempTestDir();
        try {
            // Copy manage-rootCA.sh into test directory.
            const staticDir = path.resolve('src/static');
            await copyFile(path.join(staticDir, 'manage-rootCA.sh'), path.join(dirPath, 'manage-rootCA.sh'));
            await chmod(path.join(dirPath, 'manage-rootCA.sh'), 0o755);

            // Write dummy rootCA.pem.
            await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');

            // Detect current platform binary name for `Linux`/`macOS` testing.
            const os = (process.platform === 'darwin') ? 'darwin' : 'linux';
            const arch = (process.arch === 'arm64') ? 'arm64' : (process.arch === 'arm') ? 'arm' : 'amd64';
            const binaryName = `mkcert-${os}-${arch}`;

            // Create a mock executable that records invocation args and env.
            const mockLogPath = path.join(dirPath, 'mock-log.txt');
            const mockScript = `#!/usr/bin/env sh\necho "ARGS: $@" > "${mockLogPath}"\necho "CAROOT: $CAROOT" >> "${mockLogPath}"\n`;
            await writeFile(path.join(dirPath, binaryName), mockScript);
            await chmod(path.join(dirPath, binaryName), 0o755);

            // Execute manage-rootCA.sh install.
            const { stdout } = await execFileAsync('sh', [path.join(dirPath, 'manage-rootCA.sh'), 'install']);

            assert.ok(stdout.includes('Using bundled mkcert binary'));
            assert.ok(stdout.includes('Installation complete.'));

            const logContent = await readFile(mockLogPath, 'utf8');
            assert.ok(logContent.includes('ARGS: -install'));
            assert.ok(logContent.includes(`CAROOT: ${dirPath}`));
        }
        finally {
            await cleanup();
        }
    });

    it('downloads binary via HTTP when env file is provided and bundled binary is absent', async () => {
        const { cleanup, dirPath } = await createTempTestDir();
        let server;
        try {
            // Copy manage-rootCA.sh into test directory.
            const staticDir = path.resolve('src/static');
            await copyFile(path.join(staticDir, 'manage-rootCA.sh'), path.join(dirPath, 'manage-rootCA.sh'));
            await chmod(path.join(dirPath, 'manage-rootCA.sh'), 0o755);

            // Write dummy rootCA.pem.
            await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');

            // Create mock HTTP server to serve the `mkcert` binary.
            const mockLogPath = path.join(dirPath, 'downloaded-mock-log.txt');
            const mockBinaryContent = `#!/usr/bin/env sh\necho "DOWNLOADED_ARGS: $@" > "${mockLogPath}"\necho "DOWNLOADED_CAROOT: $CAROOT" >> "${mockLogPath}"\n`;

            server = createServer((_req, res) => {
                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                res.end(mockBinaryContent);
            });

            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const port = server.address().port;
            const downloadUrl = `http://127.0.0.1:${port}/mkcert`;

            // Detect target key.
            const os = (process.platform === 'darwin') ? 'DARWIN' : 'LINUX';
            const arch = (process.arch === 'arm64') ? 'ARM64' : (process.arch === 'arm') ? 'ARM' : 'AMD64';
            const binaryKey = `${os}_${arch}`;

            // Create `mkcert-containerized.env`.
            const envContent = `MKCERT_${binaryKey}_URL=${downloadUrl}\n`;
            await writeFile(path.join(dirPath, 'mkcert-containerized.env'), envContent);

            // Execute manage-rootCA.sh uninstall.
            const { stdout } = await execFileAsync('sh', [path.join(dirPath, 'manage-rootCA.sh'), 'uninstall']);

            assert.ok(stdout.includes('Downloading mkcert binary'));
            assert.ok(stdout.includes('Download complete.'));
            assert.ok(stdout.includes('Uninstallation complete.'));

            const logContent = await readFile(mockLogPath, 'utf8');
            assert.ok(logContent.includes('DOWNLOADED_ARGS: -uninstall'));
            assert.ok(logContent.includes(`DOWNLOADED_CAROOT: ${dirPath}`));
        }
        finally {
            server?.close();
            await cleanup();
        }
    });

    it('downloads binary using fallback URL when neither bundled binary nor env file exists', async () => {
        const { cleanup, dirPath } = await createTempTestDir();
        try {
            // Copy manage-rootCA.sh into test directory.
            const staticDir = path.resolve('src/static');
            await copyFile(path.join(staticDir, 'manage-rootCA.sh'), path.join(dirPath, 'manage-rootCA.sh'));
            await chmod(path.join(dirPath, 'manage-rootCA.sh'), 0o755);

            // Write dummy rootCA.pem.
            await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');

            // Detect target platform.
            const os = (process.platform === 'darwin') ? 'darwin' : 'linux';
            const arch = (process.arch === 'arm64') ? 'arm64' : (process.arch === 'arm') ? 'arm' : 'amd64';
            const expectedUrl = `https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-${os}-${arch}`;

            // Create mock `curl` to intercept download and write dummy binary.
            const binDir = path.join(dirPath, 'mock-bin');
            await mkdir(binDir, { recursive: true });

            const mockLogPath = path.join(dirPath, 'fallback-mock-log.txt');
            const mockCurlScript = [
                '#!/usr/bin/env sh',
                `echo "$@" > "${mockLogPath}"`,
                'dest=""',
                'while [ $# -gt 0 ]; do',
                '    if [ "$1" = "-o" ]; then dest="$2"; shift 2; else shift; fi',
                'done',
                'if [ -n "$dest" ]; then',
                String.raw`    printf '#!/usr/bin/env sh\necho "FALLBACK_CALLED: $@"\n' > "$dest"`,
                '    chmod +x "$dest"',
                'fi',
            ].join('\n');

            await writeFile(path.join(binDir, 'curl'), mockCurlScript);
            await chmod(path.join(binDir, 'curl'), 0o755);

            // Execute manage-rootCA.sh install without bundled binary or .env file.
            const { stdout } = await execFileAsync('sh', [path.join(dirPath, 'manage-rootCA.sh'), 'install'], {
                env: {
                    ...process.env,
                    PATH: `${binDir}:${process.env.PATH}`,
                },
            });

            assert.ok(stdout.includes(`Downloading mkcert binary from ${expectedUrl}`));
            assert.ok(stdout.includes('Download complete.'));
            assert.ok(stdout.includes('Installation complete.'));

            const logContent = await readFile(mockLogPath, 'utf8');
            assert.ok(logContent.includes(expectedUrl));
        }
        finally {
            await cleanup();
        }
    });

    it('downloads binary using fallback URL when env file is empty', async () => {
        const { cleanup, dirPath } = await createTempTestDir();
        try {
            // Copy manage-rootCA.sh into test directory.
            const staticDir = path.resolve('src/static');
            await copyFile(path.join(staticDir, 'manage-rootCA.sh'), path.join(dirPath, 'manage-rootCA.sh'));
            await chmod(path.join(dirPath, 'manage-rootCA.sh'), 0o755);

            // Write dummy rootCA.pem.
            await writeFile(path.join(dirPath, 'rootCA.pem'), '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----');

            // Write empty `mkcert-containerized.env`.
            await writeFile(path.join(dirPath, 'mkcert-containerized.env'), '# Empty env file\n');

            // Detect target platform.
            const os = (process.platform === 'darwin') ? 'darwin' : 'linux';
            const arch = (process.arch === 'arm64') ? 'arm64' : (process.arch === 'arm') ? 'arm' : 'amd64';
            const expectedUrl = `https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-${os}-${arch}`;

            // Create mock `curl` to intercept download and write dummy binary.
            const binDir = path.join(dirPath, 'mock-bin');
            await mkdir(binDir, { recursive: true });

            const mockLogPath = path.join(dirPath, 'fallback-empty-env-log.txt');
            const mockCurlScript = [
                '#!/usr/bin/env sh',
                `echo "$@" > "${mockLogPath}"`,
                'dest=""',
                'while [ $# -gt 0 ]; do',
                '    if [ "$1" = "-o" ]; then dest="$2"; shift 2; else shift; fi',
                'done',
                'if [ -n "$dest" ]; then',
                String.raw`    printf '#!/usr/bin/env sh\necho "FALLBACK_EMPTY_CALLED: $@"\n' > "$dest"`,
                '    chmod +x "$dest"',
                'fi',
            ].join('\n');

            await writeFile(path.join(binDir, 'curl'), mockCurlScript);
            await chmod(path.join(binDir, 'curl'), 0o755);

            // Execute manage-rootCA.sh uninstall with empty .env file.
            const { stdout } = await execFileAsync('sh', [path.join(dirPath, 'manage-rootCA.sh'), 'uninstall'], {
                env: {
                    ...process.env,
                    PATH: `${binDir}:${process.env.PATH}`,
                },
            });

            assert.ok(stdout.includes(`Downloading mkcert binary from ${expectedUrl}`));
            assert.ok(stdout.includes('Download complete.'));
            assert.ok(stdout.includes('Uninstallation complete.'));

            const logContent = await readFile(mockLogPath, 'utf8');
            assert.ok(logContent.includes(expectedUrl));
        }
        finally {
            await cleanup();
        }
    });

    it('fails with clear error message when rootCA.pem is missing', async () => {
        const { cleanup, dirPath } = await createTempTestDir();
        try {
            const staticDir = path.resolve('src/static');
            await copyFile(path.join(staticDir, 'manage-rootCA.sh'), path.join(dirPath, 'manage-rootCA.sh'));
            await chmod(path.join(dirPath, 'manage-rootCA.sh'), 0o755);

            await assert.rejects(
                execFileAsync('sh', [path.join(dirPath, 'manage-rootCA.sh'), 'install']),
                err => {
                    assert.ok(err.stderr.includes('Expected root CA certificate'));
                    return true;
                },
            );
        }
        finally {
            await cleanup();
        }
    });
});
