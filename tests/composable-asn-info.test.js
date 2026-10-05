// Tests for frontend/composables/use-asn-info.js: the request URL (incl. the
// `v=` cache-buster), the 'AS<n>' cache key, cache hits skipping the network,
// and failures staying uncached. globalThis.fetch is stubbed per test.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { isReactive } from 'vue';
import {
  ASN_INFO_VERSION, asnInfoUrl, loadAsnInfoInto, useAsnInfo,
} from '../frontend/composables/use-asn-info.js';

const realFetch = globalThis.fetch;
const realConsoleError = console.error;
let calls;

const stubFetch = (impl) => {
  globalThis.fetch = async (url, init) => {
    calls.push(url);
    return impl(url, init);
  };
};
const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => {
  calls = [];
  console.error = () => {};
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
});

describe('asnInfoUrl', () => {
  it('targets the Radar asn view with the version param', () => {
    assert.equal(asnInfoUrl('13335'), `/api/cfradar?view=asn&asn=13335&v=${ASN_INFO_VERSION}`);
  });
});

describe('loadAsnInfoInto', () => {
  it('fetches the numeric ASN and caches under AS<n>', async () => {
    stubFetch(() => jsonResponse({ asnName: 'CLOUDFLARENET' }));
    const cache = {};
    const data = await loadAsnInfoInto(cache, 'AS13335');
    assert.deepEqual(calls, [`/api/cfradar?view=asn&asn=13335&v=${ASN_INFO_VERSION}`]);
    assert.deepEqual(cache, { AS13335: { asnName: 'CLOUDFLARENET' } });
    assert.equal(data, cache.AS13335);
  });

  it('a cached ASN resolves without a request', async () => {
    stubFetch(() => jsonResponse({}));
    const cache = { AS64500: { asnName: 'CACHED' } };
    const data = await loadAsnInfoInto(cache, 'AS64500');
    assert.equal(calls.length, 0);
    assert.deepEqual(data, { asnName: 'CACHED' });
  });

  it('caches any parsed body, error responses included', async () => {
    stubFetch(() => jsonResponse({ error: 'upstream' }, 500));
    const cache = {};
    await loadAsnInfoInto(cache, 'AS64501');
    assert.deepEqual(cache.AS64501, { error: 'upstream' });
  });

  it('a network failure resolves null, caches nothing and stays retryable', async () => {
    stubFetch(() => { throw new TypeError('network down'); });
    const cache = {};
    assert.equal(await loadAsnInfoInto(cache, 'AS64502'), null);
    assert.deepEqual(cache, {});

    stubFetch(() => jsonResponse({ asnName: 'BACK' }));
    await loadAsnInfoInto(cache, 'AS64502');
    assert.equal(calls.length, 2);
    assert.deepEqual(cache.AS64502, { asnName: 'BACK' });
  });

  it('an unparseable body resolves null and caches nothing', async () => {
    stubFetch(() => ({ ok: true, json: async () => { throw new SyntaxError('bad json'); } }));
    const cache = {};
    assert.equal(await loadAsnInfoInto(cache, 'AS64503'), null);
    assert.deepEqual(cache, {});
  });
});

describe('useAsnInfo', () => {
  it('creates a reactive cache, optionally seeded, without sharing it', () => {
    const seed = { AS1: { asnName: 'SEED' } };
    const a = useAsnInfo(seed);
    const b = useAsnInfo();
    assert.ok(isReactive(a.asnInfos));
    assert.deepEqual({ ...a.asnInfos }, seed);
    assert.deepEqual({ ...b.asnInfos }, {});
    a.asnInfos.AS2 = {};
    assert.equal('AS2' in seed, false, 'the seed object is copied');
  });

  it('the bound loader fills its own cache only', async () => {
    stubFetch(() => jsonResponse({ asnName: 'BOUND' }));
    const a = useAsnInfo();
    const b = useAsnInfo();
    await a.loadAsnInfo('AS64504');
    assert.deepEqual(a.asnInfos.AS64504, { asnName: 'BOUND' });
    assert.equal(b.asnInfos.AS64504, undefined);
  });
});
