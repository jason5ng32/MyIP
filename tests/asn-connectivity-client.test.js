// Tests for frontend/utils/ip/asn-connectivity.js: the request URL (incl. the
// `v=` cache-buster), cache hits skipping the network, and the
// `{ graph }` / `{ error: true }` entry shapes ASNConnectivity.vue reads.
// globalThis.fetch is stubbed per test.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  ASN_CONNECTIVITY_VERSION, asnConnectivityUrl, loadAsnConnectivityInto,
} from '../frontend/utils/ip/asn-connectivity.js';

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

describe('asnConnectivityUrl', () => {
  it('carries the version param', () => {
    assert.equal(asnConnectivityUrl('13335'), `/api/asn-connectivity?asn=13335&v=${ASN_CONNECTIVITY_VERSION}`);
  });
});

describe('loadAsnConnectivityInto', () => {
  it('caches the body as { graph } under the numeric ASN', async () => {
    const graph = { origin: 13335, nodes: [], edges: [] };
    stubFetch(() => jsonResponse(graph));
    const cache = {};
    const entry = await loadAsnConnectivityInto(cache, '13335');
    assert.deepEqual(calls, [asnConnectivityUrl('13335')]);
    assert.deepEqual(cache, { 13335: { graph } });
    assert.equal(entry, cache['13335']);
  });

  it('a cached ASN resolves without a request', async () => {
    stubFetch(() => jsonResponse({}));
    const cache = { 64500: { graph: { origin: 64500 } } };
    const entry = await loadAsnConnectivityInto(cache, '64500');
    assert.equal(calls.length, 0);
    assert.deepEqual(entry, { graph: { origin: 64500 } });
  });

  it('a non-2xx answer is cached as { error: true }', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, 500));
    const cache = {};
    assert.deepEqual(await loadAsnConnectivityInto(cache, '64501'), { error: true });
    assert.deepEqual(cache, { 64501: { error: true } });
  });

  it('a 503 (data loading at boot) answers { error: true } but stays retryable', async () => {
    stubFetch(() => jsonResponse({ error: 'Offline data is loading' }, 503));
    const cache = {};
    assert.deepEqual(await loadAsnConnectivityInto(cache, '64503'), { error: true });
    assert.deepEqual(cache, {});
    stubFetch(() => jsonResponse({ origin: 64503 }));
    assert.deepEqual(await loadAsnConnectivityInto(cache, '64503'), { graph: { origin: 64503 } });
  });

  it('a network failure is cached as { error: true }', async () => {
    stubFetch(() => { throw new TypeError('offline'); });
    const cache = {};
    assert.deepEqual(await loadAsnConnectivityInto(cache, '64502'), { error: true });
  });
});
