import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { doesMkcertErrSuggestContainer } from '../src/container/doesMkcertErrSuggestContainer.js';

describe('doesMkcertErrSuggestContainer', () => {
    it('returns false for invalid non-object error arguments', () => {
        // Test non-object error arguments return false.
        assert.equal(doesMkcertErrSuggestContainer(null), false);
        assert.equal(doesMkcertErrSuggestContainer(undefined), false);
        assert.equal(doesMkcertErrSuggestContainer('some error'), false);
    });

    it('returns true when error message contains mkcert -install command tokens', () => {
        // Test `mkcert` install error tokens return true.
        const err = new Error('Failed to run mkcert -install in container context');
        assert.equal(doesMkcertErrSuggestContainer(err), true);
    });

    it('returns true when error message contains certutil or permission denied tokens', () => {
        // Test system trust store tokens return true.
        assert.equal(doesMkcertErrSuggestContainer({ message: 'certutil: function failed' }), true);
        assert.equal(doesMkcertErrSuggestContainer({ stderr: 'sudo: permission denied' }), true);
    });

    it('returns false for unrelated errors', () => {
        // Test unrelated error objects return false.
        assert.equal(doesMkcertErrSuggestContainer(new Error('Network connection timeout')), false);
    });
});
