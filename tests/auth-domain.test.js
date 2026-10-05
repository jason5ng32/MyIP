// Tests for the auth-domain choice (frontend/utils/auth-domain.js): browsers
// keep the shared default domain, the installed PWA may use its own, and
// GitHub (one callback, on the default domain) drops out when it does.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveAuthDomain, signInProvidersFor } from '../frontend/utils/auth-domain.js';

const DEFAULT = 'auth.example.com';
const SITE = 'example.com';

describe('resolveAuthDomain', () => {
    it('uses the default domain in a browser tab, even with a PWA domain set', () => {
        assert.equal(resolveAuthDomain({ runningAsPwa: false, authDomain: DEFAULT, pwaAuthDomain: SITE }), DEFAULT);
    });

    it('uses the PWA domain inside the installed PWA', () => {
        assert.equal(resolveAuthDomain({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: SITE }), SITE);
    });

    it('falls back to the default in the PWA when the PWA domain is unset or blank', () => {
        assert.equal(resolveAuthDomain({ runningAsPwa: true, authDomain: DEFAULT }), DEFAULT);
        assert.equal(resolveAuthDomain({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: '' }), DEFAULT);
        assert.equal(resolveAuthDomain({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: '   ' }), DEFAULT);
    });

    it('trims both values', () => {
        assert.equal(resolveAuthDomain({ runningAsPwa: false, authDomain: ` ${DEFAULT} ` }), DEFAULT);
        assert.equal(resolveAuthDomain({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: ` ${SITE}\n` }), SITE);
    });

    it('returns an empty string when nothing is configured', () => {
        assert.equal(resolveAuthDomain({ runningAsPwa: false }), '');
        assert.equal(resolveAuthDomain({ runningAsPwa: true }), '');
    });
});

describe('signInProvidersFor', () => {
    it('offers both providers in a browser tab', () => {
        assert.deepEqual(signInProvidersFor({ runningAsPwa: false, authDomain: DEFAULT, pwaAuthDomain: SITE }), ['google', 'github']);
    });

    it('offers both providers in the PWA when it shares the default domain', () => {
        assert.deepEqual(signInProvidersFor({ runningAsPwa: true, authDomain: DEFAULT }), ['google', 'github']);
        assert.deepEqual(signInProvidersFor({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: ' ' }), ['google', 'github']);
        assert.deepEqual(signInProvidersFor({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: ` ${DEFAULT}` }), ['google', 'github']);
    });

    it('drops GitHub in the PWA when it signs in through a different domain', () => {
        assert.deepEqual(signInProvidersFor({ runningAsPwa: true, authDomain: DEFAULT, pwaAuthDomain: SITE }), ['google']);
    });

    it('returns a fresh array each call', () => {
        const inputs = { runningAsPwa: false, authDomain: DEFAULT };
        assert.notEqual(signInProvidersFor(inputs), signInProvidersFor(inputs));
    });
});
