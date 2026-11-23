// hasReachedSection() (frontend/composables/use-section-tracking.js): when a
// homepage section counts as reached for the JNScroll event — top edge in the
// viewport's upper half, or fully visible.
//
// The module pulls in the real Pinia store, which needs the same globalThis
// stubs as store.test.js — installed before the dynamic import below.

globalThis.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] ?? null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; },
};
globalThis.window = {
    location: { search: '' },
    addEventListener() {},
    innerWidth: 1024,
};
globalThis.document = {
    addEventListener() {},
    title: '',
    querySelector() { return null; },
    documentElement: { classList: { toggle() {} } },
};

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// Static, so Vue loads before the stubs: runtime-dom probes `document` at load.
import 'vue';

const { hasReachedSection } = await import('../frontend/composables/use-section-tracking.js');

const VIEWPORT = 800;

describe('hasReachedSection', () => {
    it('counts a tall section once its top reaches the half line', () => {
        assert.equal(hasReachedSection({ top: 300, bottom: 2000 }, VIEWPORT), true);
        assert.equal(hasReachedSection({ top: 400, bottom: 2000 }, VIEWPORT), true);
        assert.equal(hasReachedSection({ top: 500, bottom: 2000 }, VIEWPORT), false);
    });

    it('counts a short section fully visible low on screen', () => {
        assert.equal(hasReachedSection({ top: 600, bottom: 790 }, VIEWPORT), true);
    });

    it('counts a section whose top is above the viewport but still visible', () => {
        assert.equal(hasReachedSection({ top: -500, bottom: 200 }, VIEWPORT), true);
    });

    it('ignores a section scrolled completely past', () => {
        assert.equal(hasReachedSection({ top: -900, bottom: 0 }, VIEWPORT), false);
    });

    it('ignores a section entirely below the viewport', () => {
        assert.equal(hasReachedSection({ top: 900, bottom: 1200 }, VIEWPORT), false);
    });
});
