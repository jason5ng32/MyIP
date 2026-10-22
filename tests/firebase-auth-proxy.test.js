// Spec for common/firebase-auth-proxy.js — the `/__/auth` proxy target.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FIREBASE_AUTH_PROXY_PATH, firebaseAuthProxyTarget } from '../common/firebase-auth-proxy.js';

describe('firebaseAuthProxyTarget()', () => {
    it('returns null without a project id', () => {
        assert.equal(firebaseAuthProxyTarget(undefined), null);
        assert.equal(firebaseAuthProxyTarget(null), null);
        assert.equal(firebaseAuthProxyTarget(''), null);
        assert.equal(firebaseAuthProxyTarget('   '), null);
    });

    it('maps a project id onto its firebaseapp.com origin', () => {
        assert.equal(firebaseAuthProxyTarget('my-project'), 'https://my-project.firebaseapp.com');
    });

    it('trims surrounding whitespace', () => {
        assert.equal(firebaseAuthProxyTarget('  my-project \n'), 'https://my-project.firebaseapp.com');
    });
});

describe('FIREBASE_AUTH_PROXY_PATH', () => {
    it('is the Firebase Auth handler prefix', () => {
        assert.equal(FIREBASE_AUTH_PROXY_PATH, '/__/auth');
    });
});
