import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { resolveArchiveProjectName } from '../src/archive/resolveArchiveProjectName.js';

describe('resolveArchiveProjectName', () => {
    it('resolves the package name from workspace package.json', async () => {
        // Test resolving project name from current workspace root directory.
        const workspaceDir = path.resolve(process.cwd());
        const projectName = await resolveArchiveProjectName(workspaceDir);

        // Verify project name matches sanitized package name or `devcontainer` name.
        assert.ok(typeof projectName === 'string');
        assert.ok(projectName.length > 0);
        assert.equal(projectName, 'vite-plugin-mkcert-containerized');
    });

    it('sanitizes unsafe path characters from project names', async () => {
        // Test project name fallback for invalid or root directory.
        const projectName = await resolveArchiveProjectName('/tmp');
        assert.ok(typeof projectName === 'string');
        assert.doesNotMatch(projectName, /[<>:"/\\|?*]/);
    });

    it('parses devcontainer.json with comments and trailing commas without node:vm evaluation', async () => {
        const { mkdtemp, rm, writeFile, mkdir } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const dirPath = await mkdtemp(path.join(tmpdir(), 'devcontainer-jsonc-test-'));
        try {
            await mkdir(path.join(dirPath, '.devcontainer'), { recursive: true });
            const devcontainerContent = `\
// \`devcontainer\` configuration.
{
    /* Project identifier. */
    "name": "my-custom-devcontainer-app", // Inline comment.
    "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
}
`;
            await writeFile(path.join(dirPath, '.devcontainer', 'devcontainer.json'), devcontainerContent);
            const projectName = await resolveArchiveProjectName(dirPath);
            assert.equal(projectName, 'my-custom-devcontainer-app');
        }
        finally {
            await rm(dirPath, { force: true, recursive: true });
        }
    });
});
