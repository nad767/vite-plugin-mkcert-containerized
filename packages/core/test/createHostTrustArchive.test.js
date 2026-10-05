import { unzipSync } from 'fflate';
import assert from 'node:assert/strict';
import {
    mkdtemp,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { createHostTrustArchive } from '../src/archive/createHostTrustArchive.js';
import { MKCERT_TARGETS } from '../src/consts.js';

const textDecoder = new TextDecoder();

/**
 * Decode and read an entry from the in-memory zip archive buffer as text.
 *
 * @param {Uint8Array | Buffer} archiveBuffer Raw zip archive buffer.
 * @param {string} fileName Name of entry to decode.
 * @returns {string} Decoded text content.
 */
// eslint-disable-next-line unicorn/no-unnecessary-parameters
function readArchiveTextFile(archiveBuffer, fileName) {
    const archiveEntries = unzipSync(archiveBuffer);
    return textDecoder.decode(archiveEntries[fileName]);
}

/**
 * Helper to create a temporary directory containing a dummy `rootCA.pem`.
 *
 * @param {string} [customCertContent] Optional certificate string content.
 * @returns {Promise<{ cleanup: () => Promise<void>, dirPath: string }>} Temp directory details.
 */
async function createTempCaDir(customCertContent = '-----BEGIN CERTIFICATE-----\nTEST-ROOT-CA\n-----END CERTIFICATE-----') {
    const dirPath = await mkdtemp(path.join(tmpdir(), 'mkcert-test-ca-'));
    await writeFile(path.join(dirPath, 'rootCA.pem'), customCertContent);
    return {
        cleanup: () => rm(dirPath, { force: true, recursive: true }),
        dirPath,
    };
}

describe('createHostTrustArchive', () => {
    it('throws error when rootCA.pem certificate is missing', async () => {
        const emptyDir = await mkdtemp(path.join(tmpdir(), 'mkcert-empty-ca-'));
        try {
            await assert.rejects(
                createHostTrustArchive({ bundleBinaries: false, projectName: 'test-app', savePath: emptyDir }),
                /Missing "rootCA\.pem" certificate/,
            );
        }
        finally {
            await rm(emptyDir, { force: true, recursive: true });
        }
    });

    it('creates zip archive bundle for dynamic download mode (bundleBinaries: false)', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Test zip bundle creation in default dynamic mode.
            const bundle = await createHostTrustArchive({
                bundleBinaries: false,
                projectName:    'test-app',
                savePath:       dirPath,
            });

            assert.ok(bundle.archiveFileName.startsWith('test-app-CA-'));
            assert.ok(bundle.archiveFileName.endsWith('.zip'));
            assert.ok(bundle.archiveBuffer.length > 0);
            assert.ok(bundle.archiveContents.includes('INSTRUCTIONS.txt'));
            assert.ok(bundle.archiveContents.includes('install-rootCA.sh'));
            assert.ok(bundle.archiveContents.includes('manage-rootCA.sh'));
            assert.ok(bundle.archiveContents.includes('manage-rootCA.ps1'));
            assert.ok(bundle.archiveContents.includes('rootCA.pem'));
            assert.ok(bundle.archiveContents.includes('mkcert-containerized.env'));

            // Verify `rootCA-key.pem` is strictly excluded from the host trust ZIP bundle.
            assert.equal(bundle.archiveContents.includes('rootCA-key.pem'), false);

            const instructions = readArchiveTextFile(bundle.archiveBuffer, 'INSTRUCTIONS.txt');
            assert.equal(instructions.includes('rootCA-key.pem'), false);
            assert.ok(instructions.includes('mkcert-containerized.env'));
        }
        finally {
            await cleanup();
        }
    });

    it('creates zip archive bundle for offline bundled mode (bundleBinaries: true)', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Test zip bundle creation in offline bundled mode.
            const bundle = await createHostTrustArchive({
                bundleBinaries: true,
                projectName:    'test-app-offline',
                savePath:       dirPath,
            });

            assert.ok(bundle.archiveFileName.startsWith('test-app-offline-CA-'));
            assert.ok(bundle.archiveBuffer.length > 0);
            assert.ok(bundle.archiveContents.includes('INSTRUCTIONS.txt'));
            assert.ok(bundle.archiveContents.includes('install-rootCA.sh'));
            assert.ok(bundle.archiveContents.includes('manage-rootCA.sh'));
            assert.ok(bundle.archiveContents.includes('manage-rootCA.ps1'));
            assert.ok(bundle.archiveContents.includes('rootCA.pem'));
            assert.ok(bundle.archiveContents.includes('mkcert-darwin-amd64'));
            assert.ok(bundle.archiveContents.includes('mkcert-windows-amd64.exe'));

            // Verify `mkcert-containerized.env` is not needed when binaries are bundled directly.
            assert.equal(bundle.archiveContents.includes('mkcert-containerized.env'), false);

            const instructions = readArchiveTextFile(bundle.archiveBuffer, 'INSTRUCTIONS.txt');
            assert.ok(instructions.includes('mkcert-*'));
            assert.equal(instructions.includes('mkcert-containerized.env'), false);
        }
        finally {
            await cleanup();
        }
    });

    it('ensures all bundled static scripts end with a trailing newline', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Verify static script entries inside archive end with newline.
            const bundle = await createHostTrustArchive({
                bundleBinaries: false,
                projectName:    'test-app',
                savePath:       dirPath,
            });

            const staticFileNames = [
                'install-rootCA.cmd',
                'install-rootCA.ps1',
                'install-rootCA.sh',
                'manage-rootCA.ps1',
                'manage-rootCA.sh',
                'uninstall-rootCA.cmd',
                'uninstall-rootCA.ps1',
                'uninstall-rootCA.sh',
            ];

            const entries = unzipSync(bundle.archiveBuffer);
            for (const fileName of staticFileNames) {
                assert.ok(entries[fileName], `Missing static file: ${fileName}.`);
                const content = textDecoder.decode(entries[fileName]);
                assert.ok(content.endsWith('\n'), `Expected ${fileName} to end with a newline.`);
            }
        }
        finally {
            await cleanup();
        }
    });

    for (const projectName of [
        'my-cool-frontend',
        '@scoped/service-api',
        'project with spaces',
        'special!@#$%^&*()symbols',
    ]) {
        it(`verifies exact expected file entries in bundle for project name "${projectName}" with bundleBinaries: false`, async () => {
            const expectedStaticFiles = [
                'install-rootCA.cmd',
                'install-rootCA.ps1',
                'install-rootCA.sh',
                'manage-rootCA.ps1',
                'manage-rootCA.sh',
                'uninstall-rootCA.cmd',
                'uninstall-rootCA.ps1',
                'uninstall-rootCA.sh',
            ];
            const expectedDynamicEntries = [
                ...expectedStaticFiles,
                'INSTRUCTIONS.txt',
                'mkcert-containerized.env',
                'rootCA.pem',
            ].toSorted((a, b) => a.localeCompare(b));

            const customCert = '-----BEGIN CERTIFICATE-----\nCUSTOM-CERT-BODY\n-----END CERTIFICATE-----';
            const { cleanup, dirPath } = await createTempCaDir(customCert);
            try {
                const bundle = await createHostTrustArchive({
                    bundleBinaries: false,
                    projectName,
                    savePath:       dirPath,
                });

                assert.ok(bundle.archiveFileName.endsWith('.zip'));

                // Verify file list returned in archiveContents matches unzipped archive contents exactly.
                const unzippedEntries = unzipSync(bundle.archiveBuffer);
                const unzippedEntryNames = Object.keys(unzippedEntries).toSorted((a, b) => a.localeCompare(b));

                assert.deepEqual(unzippedEntryNames, expectedDynamicEntries);
                assert.deepEqual([...bundle.archiveContents].toSorted((a, b) => a.localeCompare(b)), expectedDynamicEntries);

                // Verify certificate file content inside archive.
                const extractedCert = textDecoder.decode(unzippedEntries['rootCA.pem']);
                assert.equal(extractedCert, customCert);

                // Verify `mkcert-containerized.env` contains all target environment keys.
                const envText = textDecoder.decode(unzippedEntries['mkcert-containerized.env']);
                for (const target of MKCERT_TARGETS) {
                    assert.ok(envText.includes(`${target.envKey}=`), `Expected env key ${target.envKey} in mkcert-containerized.env.`);
                }
            }
            finally {
                await cleanup();
            }
        });
    }

    it('verifies exact file list and non-empty binary buffers with bundleBinaries: true', async () => {
        const expectedBinaryFiles = MKCERT_TARGETS.map(target => target.binaryFilename);
        const expectedStaticFiles = [
            'install-rootCA.cmd',
            'install-rootCA.ps1',
            'install-rootCA.sh',
            'manage-rootCA.ps1',
            'manage-rootCA.sh',
            'uninstall-rootCA.cmd',
            'uninstall-rootCA.ps1',
            'uninstall-rootCA.sh',
        ];
        const expectedAllEntries = [
            ...expectedStaticFiles,
            ...expectedBinaryFiles,
            'INSTRUCTIONS.txt',
            'rootCA.pem',
        ].toSorted((a, b) => a.localeCompare(b));

        const { cleanup, dirPath } = await createTempCaDir();
        try {
            const bundle = await createHostTrustArchive({
                bundleBinaries: true,
                projectName:    'offline-production-app',
                savePath:       dirPath,
            });

            const unzippedEntries = unzipSync(bundle.archiveBuffer);
            const unzippedEntryNames = Object.keys(unzippedEntries).toSorted((a, b) => a.localeCompare(b));

            assert.deepEqual(unzippedEntryNames, expectedAllEntries);
            assert.deepEqual([...bundle.archiveContents].toSorted((a, b) => a.localeCompare(b)), expectedAllEntries);

            // Verify each bundled binary is non-empty.
            for (const binaryName of expectedBinaryFiles) {
                assert.ok(unzippedEntries[binaryName].length > 0, `Expected bundled binary ${binaryName} to have non-zero length.`);
            }

            // Verify `mkcert-containerized.env` is strictly absent when binaries are bundled.
            assert.equal(unzippedEntries['mkcert-containerized.env'], undefined);
        }
        finally {
            await cleanup();
        }
    });

    it('strictly excludes unrelated files, private keys, and server certificates from the savePath directory', async () => {
        const { cleanup, dirPath } = await createTempCaDir();
        try {
            // Write sensitive private key, server certificates, and arbitrary files into savePath directory.
            await writeFile(path.join(dirPath, 'rootCA-key.pem'), '-----BEGIN PRIVATE KEY-----\nSECRET_KEY\n-----END PRIVATE KEY-----');
            await writeFile(path.join(dirPath, 'cert.pem'), '-----BEGIN CERTIFICATE-----\nSERVER_CERT\n-----END CERTIFICATE-----');
            await writeFile(path.join(dirPath, 'dev.local-key.pem'), '-----BEGIN PRIVATE KEY-----\nDEV_KEY\n-----END PRIVATE KEY-----');
            await writeFile(path.join(dirPath, 'credentials.env'), 'SECRET_TOKEN=xyz');
            await writeFile(path.join(dirPath, 'random.txt'), 'random data');

            // Generate bundle with bundleBinaries: false.
            const dynamicBundle = await createHostTrustArchive({
                bundleBinaries: false,
                projectName:    'secure-app',
                savePath:       dirPath,
            });

            const dynamicEntries = unzipSync(dynamicBundle.archiveBuffer);
            assert.equal(dynamicEntries['rootCA-key.pem'], undefined);
            assert.equal(dynamicEntries['cert.pem'], undefined);
            assert.equal(dynamicEntries['dev.local-key.pem'], undefined);
            assert.equal(dynamicEntries['credentials.env'], undefined);
            assert.equal(dynamicEntries['random.txt'], undefined);

            // Generate bundle with bundleBinaries: true.
            const offlineBundle = await createHostTrustArchive({
                bundleBinaries: true,
                projectName:    'secure-app',
                savePath:       dirPath,
            });

            const offlineEntries = unzipSync(offlineBundle.archiveBuffer);
            assert.equal(offlineEntries['rootCA-key.pem'], undefined);
            assert.equal(offlineEntries['cert.pem'], undefined);
            assert.equal(offlineEntries['dev.local-key.pem'], undefined);
            assert.equal(offlineEntries['credentials.env'], undefined);
            assert.equal(offlineEntries['random.txt'], undefined);
        }
        finally {
            await cleanup();
        }
    });
});
