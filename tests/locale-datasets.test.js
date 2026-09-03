// Guards frontend/utils/locale-datasets.js — the shared failure policy for
// the optional per-locale datasets: a failing or empty chunk falls through to
// the next locale on the chain, the cache short-circuits refetches, and only
// a whole-chain failure yields null.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { datasetLoaders, loadLocaleDataset } from '../frontend/utils/locale-datasets.js';

const ok = (data) => async () => ({ default: data });
const failing = (message) => async () => { throw new Error(message); };
const empty = () => async () => ({});

let warn;
beforeEach(() => { warn = mock.method(console, 'warn', () => {}); });
afterEach(() => { warn.mock.restore(); });

describe('datasetLoaders', () => {
    it('keys glob entries by locale code', () => {
        const zh = () => {};
        const en = () => {};
        const map = datasetLoaders({ '../locales/privacy/zh.json': zh, '../locales/privacy/en.json': en });
        assert.deepEqual(map, { zh, en });
    });
});

describe('loadLocaleDataset', () => {
    it('returns the active locale when its chunk loads', async () => {
        const r = await loadLocaleDataset({ fr: ok('FR'), en: ok('EN') }, 'fr');
        assert.deepEqual(r, { code: 'fr', data: 'FR' });
    });

    it('falls through the chain when the active chunk throws', async () => {
        const r = await loadLocaleDataset({ fr: failing('boom'), en: ok('EN') }, 'fr');
        assert.deepEqual(r, { code: 'en', data: 'EN' });
        assert.equal(warn.mock.callCount(), 1);
    });

    it('treats a chunk without a default export like a missing one', async () => {
        const r = await loadLocaleDataset({ fr: empty(), en: ok('EN') }, 'fr');
        assert.deepEqual(r, { code: 'en', data: 'EN' });
    });

    it('walks regional → base → en', async () => {
        const r = await loadLocaleDataset({ 'zh-TW': failing('x'), zh: ok('ZH'), en: ok('EN') }, 'zh-TW');
        assert.deepEqual(r, { code: 'zh', data: 'ZH' });
        const noBase = await loadLocaleDataset({ en: ok('EN') }, 'zh-TW');
        assert.deepEqual(noBase, { code: 'en', data: 'EN' });
    });

    it('returns null only when the whole chain fails', async () => {
        assert.equal(await loadLocaleDataset({ fr: failing('a'), en: failing('b') }, 'fr'), null);
        assert.equal(await loadLocaleDataset({}, 'fr'), null);
        assert.equal(await loadLocaleDataset(undefined, 'fr'), null);
    });

    it('caches by pack code and never refetches a cached pack', async () => {
        const fr = mock.fn(ok('FR'));
        const cache = new Map();
        await loadLocaleDataset({ fr, en: ok('EN') }, 'fr', cache);
        const again = await loadLocaleDataset({ fr, en: ok('EN') }, 'fr', cache);
        assert.deepEqual(again, { code: 'fr', data: 'FR' });
        assert.equal(fr.mock.callCount(), 1);
        assert.equal(cache.get('fr'), 'FR');
    });

    it('a cached fallback serves a locale whose own chunk keeps failing', async () => {
        const cache = new Map();
        const loaders = { fr: failing('down'), en: ok('EN') };
        await loadLocaleDataset(loaders, 'fr', cache);
        const r = await loadLocaleDataset(loaders, 'fr', cache);
        assert.deepEqual(r, { code: 'en', data: 'EN' });
        assert.equal(cache.has('fr'), false);
    });
});
