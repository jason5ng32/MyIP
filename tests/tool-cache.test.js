// shouldDropToolCache() — when ToolPage drops every cached tool (the auth
// epoch): the signed-in account went away, never on a first sign-in.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldDropToolCache } from '../frontend/utils/tool-cache.js';

describe('shouldDropToolCache()', () => {
    it('drops on sign-out', () => {
        assert.equal(shouldDropToolCache('uid-a', null), true);
    });

    it('drops on an account switch', () => {
        assert.equal(shouldDropToolCache('uid-a', 'uid-b'), true);
    });

    it('keeps the cache on a first sign-in', () => {
        assert.equal(shouldDropToolCache(null, 'uid-a'), false);
        assert.equal(shouldDropToolCache(undefined, 'uid-a'), false);
    });

    it('keeps the cache while the same account stays signed in (token refresh)', () => {
        assert.equal(shouldDropToolCache('uid-a', 'uid-a'), false);
    });

    it('keeps the cache while nobody is signed in', () => {
        assert.equal(shouldDropToolCache(null, null), false);
    });
});
