// Tests for the PWA install-prompt eligibility gate (frontend/utils/pwa.js).

globalThis.localStorage = {
    _data: {},
    _throw: false,
    getItem(k) { if (this._throw) throw new Error('storage disabled'); return this._data[k] ?? null; },
    setItem(k, v) { if (this._throw) throw new Error('storage disabled'); this._data[k] = String(v); },
    clear() { this._data = {}; this._throw = false; },
};
globalThis.window = {
    matchMedia: () => ({ matches: globalThis.__pwaDisplayMode }),
    navigator: {},
};
globalThis.__pwaDisplayMode = false;

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { shouldOfferPwaInstall, getPwaVisitCount } from '../frontend/utils/pwa.js';

const HOURS = 60 * 60 * 1000;
// Seed storage as if the previous counted use happened `agoMs` ago.
const seed = (visits, agoMs, popups = 0) => {
    globalThis.localStorage.setItem('pwaVisitCount', visits);
    globalThis.localStorage.setItem('pwaLastVisitAt', Date.now() - agoMs);
    globalThis.localStorage.setItem('pwaPopupCount', popups);
};

beforeEach(() => {
    globalThis.localStorage.clear();
    globalThis.__pwaDisplayMode = false;
});

describe('shouldOfferPwaInstall', () => {
    it('skips the very first use but still counts and stamps it', () => {
        assert.equal(shouldOfferPwaInstall(), false);
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '1');
        assert.ok(parseInt(globalThis.localStorage.getItem('pwaLastVisitAt'), 10) > 0);
    });

    it('does not count reloads inside the 12h window', () => {
        shouldOfferPwaInstall();
        assert.equal(shouldOfferPwaInstall(), false);
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '1');
    });

    it('offers on the second use, 12h or more after the first', () => {
        seed(1, 13 * HOURS);
        assert.equal(shouldOfferPwaInstall(), true);
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '2');
    });

    it('does not re-prompt on a same-window reload after a show', () => {
        // The visit-2 prompt just fired: PWA.vue bumped pwaPopupCount to 1.
        seed(2, 1 * HOURS, 1);
        assert.equal(shouldOfferPwaInstall(), false);
    });

    it('offers a second time on the third use', () => {
        seed(2, 13 * HOURS, 1);
        assert.equal(shouldOfferPwaInstall(), true);
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '3');
    });

    it('stops offering once the popup cap (2) is reached', () => {
        seed(5, 13 * HOURS, 2);
        assert.equal(shouldOfferPwaInstall(), false);
    });

    it('never offers inside an installed PWA window', () => {
        seed(5, 13 * HOURS);
        globalThis.__pwaDisplayMode = true;
        assert.equal(shouldOfferPwaInstall(), false);
        // The use still counts even when running as a PWA.
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '6');
    });

    it('treats a pre-timestamp legacy count as an expired window', () => {
        // Upgraded visitor: pwaVisitCount exists, pwaLastVisitAt does not.
        globalThis.localStorage.setItem('pwaVisitCount', '4');
        assert.equal(shouldOfferPwaInstall(), true);
        assert.equal(globalThis.localStorage.getItem('pwaVisitCount'), '5');
    });

    it('returns false when storage is unavailable', () => {
        globalThis.localStorage._throw = true;
        assert.equal(shouldOfferPwaInstall(), false);
    });
});

describe('getPwaVisitCount', () => {
    it('reads the stored count and defaults to 0', () => {
        assert.equal(getPwaVisitCount(), 0);
        globalThis.localStorage.setItem('pwaVisitCount', '3');
        assert.equal(getPwaVisitCount(), 3);
    });

    it('returns 0 when storage is unavailable', () => {
        globalThis.localStorage._throw = true;
        assert.equal(getPwaVisitCount(), 0);
    });
});
