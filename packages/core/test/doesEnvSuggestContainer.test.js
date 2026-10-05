import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { doesEnvSuggestContainer } from '../src/container/doesEnvSuggestContainer.js';

describe('doesEnvSuggestContainer', () => {
    it('returns true when container environment variables are present', async () => {
        // Save original process environment variables.
        const originalDevcontainer = process.env.DEVCONTAINER;
        try {
            process.env.DEVCONTAINER = 'true';
            const result = await doesEnvSuggestContainer();
            assert.equal(result, true);
        }
        finally {
            // Restore original environment variable value.
            if (originalDevcontainer === undefined) delete process.env.DEVCONTAINER;
            else process.env.DEVCONTAINER = originalDevcontainer;
        }
    });

    it('returns true when CODESPACES environment variable is set', async () => {
        // Test `CODESPACES` flag detection.
        const originalCodespaces = process.env.CODESPACES;
        try {
            process.env.CODESPACES = 'true';
            const result = await doesEnvSuggestContainer();
            assert.equal(result, true);
        }
        finally {
            // Restore original environment variable value.
            if (originalCodespaces === undefined) delete process.env.CODESPACES;
            else process.env.CODESPACES = originalCodespaces;
        }
    });
});
