// Tests for the sign-in flow choice (frontend/utils/auth-flow.js): popup in a
// browser tab, redirect in the installed PWA and on a popup that can't open.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSignInFlow, shouldFallBackToRedirect } from '../frontend/utils/auth-flow.js';

describe('resolveSignInFlow', () => {
    it('redirects inside the installed PWA', () => {
        assert.equal(resolveSignInFlow({ runningAsPwa: true }), 'redirect');
    });

    it('uses the popup in a browser tab', () => {
        assert.equal(resolveSignInFlow({ runningAsPwa: false }), 'popup');
    });
});

describe('shouldFallBackToRedirect', () => {
    it('falls back when the popup cannot open', () => {
        assert.equal(shouldFallBackToRedirect('auth/popup-blocked'), true);
        assert.equal(shouldFallBackToRedirect('auth/operation-not-supported-in-this-environment'), true);
    });

    it('does not fall back when the visitor closed or superseded the popup', () => {
        assert.equal(shouldFallBackToRedirect('auth/popup-closed-by-user'), false);
        assert.equal(shouldFallBackToRedirect('auth/cancelled-popup-request'), false);
    });

    it('does not fall back on other or missing codes', () => {
        assert.equal(shouldFallBackToRedirect('auth/account-exists-with-different-credential'), false);
        assert.equal(shouldFallBackToRedirect('auth/network-request-failed'), false);
        assert.equal(shouldFallBackToRedirect(undefined), false);
        assert.equal(shouldFallBackToRedirect(''), false);
    });
});
