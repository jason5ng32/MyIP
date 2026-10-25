// Tests for frontend/utils/ip/asn-history.js: the request URL, cache hits
// skipping the network, and the body / `{ error: true }` entry shapes
// ASNHistory.vue reads. globalThis.fetch is stubbed per test.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { asnHistoryUrl, loadAsnHistoryInto } from '../frontend/utils/ip/asn-history.js';

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

describe('asnHistoryUrl', () => {
  it('encodes the prefix', () => {
    assert.equal(asnHistoryUrl('1.1.1.0/24'), '/api/asn-history?prefix=1.1.1.0%2F24');
  });
});

describe('loadAsnHistoryInto', () => {
  it('caches the body under the prefix', async () => {
    const body = { prefix: '1.1.1.0/24', asns: [] };
    stubFetch(() => jsonResponse(body));
    const cache = {};
    const entry = await loadAsnHistoryInto(cache, '1.1.1.0/24');
    assert.deepEqual(calls, [asnHistoryUrl('1.1.1.0/24')]);
    assert.deepEqual(cache, { '1.1.1.0/24': body });
    assert.equal(entry, cache['1.1.1.0/24']);
  });

  it('a cached prefix resolves without a request', async () => {
    stubFetch(() => jsonResponse({}));
    const cache = { '2001:db8::/48': { asns: [{ asn: 64500 }] } };
    const entry = await loadAsnHistoryInto(cache, '2001:db8::/48');
    assert.equal(calls.length, 0);
    assert.deepEqual(entry, { asns: [{ asn: 64500 }] });
  });

  it('a non-2xx answer is cached as { error: true }', async () => {
    stubFetch(() => jsonResponse({ error: 'Gateway Timeout' }, 504));
    const cache = {};
    assert.deepEqual(await loadAsnHistoryInto(cache, '192.0.2.0/24'), { error: true });
    assert.deepEqual(cache, { '192.0.2.0/24': { error: true } });
  });

  it('a network failure is cached as { error: true }', async () => {
    stubFetch(() => { throw new TypeError('offline'); });
    const cache = {};
    assert.deepEqual(await loadAsnHistoryInto(cache, '198.51.100.0/24'), { error: true });
    assert.deepEqual(cache, { '198.51.100.0/24': { error: true } });
  });
});
