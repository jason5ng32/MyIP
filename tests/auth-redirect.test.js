// Tests for the pending-redirect sign-in marker (frontend/utils/auth-redirect.js),
// driven through an injected fake sessionStorage.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
    markPendingRedirectSignIn,
    hasPendingRedirectSignIn,
    takePendingRedirectSignIn,
} from '../frontend/utils/auth-redirect.js';

const createStorage = () => ({
    data: {},
    broken: false,
    getItem(k) { if (this.broken) throw new Error('storage disabled'); return this.data[k] ?? null; },
    setItem(k, v) { if (this.broken) throw new Error('storage disabled'); this.data[k] = String(v); },
    removeItem(k) { if (this.broken) throw new Error('storage disabled'); delete this.data[k]; },
});

let storage;
beforeEach(() => {
    storage = createStorage();
});

describe('auth-redirect marker', () => {
    it('reports nothing pending on a fresh storage', () => {
        assert.equal(hasPendingRedirectSignIn(storage), false);
        assert.equal(takePendingRedirectSignIn(storage), null);
    });

    it('marks a pending redirect with its provider', () => {
        markPendingRedirectSignIn('github', storage);
        assert.equal(hasPendingRedirectSignIn(storage), true);
    });

    it('has() reads without consuming', () => {
        markPendingRedirectSignIn('google', storage);
        hasPendingRedirectSignIn(storage);
        assert.equal(hasPendingRedirectSignIn(storage), true);
    });

    it('take() returns the provider once and clears the marker', () => {
        markPendingRedirectSignIn('github', storage);
        assert.deepEqual(takePendingRedirectSignIn(storage), { providerKey: 'github' });
        assert.equal(hasPendingRedirectSignIn(storage), false);
        assert.equal(takePendingRedirectSignIn(storage), null);
    });

    it('a later mark replaces the earlier provider', () => {
        markPendingRedirectSignIn('google', storage);
        markPendingRedirectSignIn('github', storage);
        assert.deepEqual(takePendingRedirectSignIn(storage), { providerKey: 'github' });
    });

    it('never throws when storage is disabled', () => {
        storage.broken = true;
        assert.doesNotThrow(() => markPendingRedirectSignIn('google', storage));
        assert.equal(hasPendingRedirectSignIn(storage), false);
        assert.equal(takePendingRedirectSignIn(storage), null);
    });

    it('never throws when no storage exists at all', () => {
        assert.doesNotThrow(() => markPendingRedirectSignIn('google', null));
        assert.equal(hasPendingRedirectSignIn(null), false);
        assert.equal(takePendingRedirectSignIn(null), null);
    });
});
