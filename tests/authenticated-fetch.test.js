// Contract tests for utils/authenticated-fetch.js — the HTTP status must
// survive the error rewrapping, because fetchErrorLabel() turns it into the
// console.error prefix that Sentry fingerprints on.
//
// The module imports the Pinia store, which reaches for localStorage /
// window / document at import time — same globalThis stubs as store.test.js,
// installed before the dynamic import below.

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
import { describe, it, beforeEach, afterEach } from 'node:test';
import { createPinia, setActivePinia } from 'pinia';

const { authenticatedFetch, fetchErrorLabel } = await import('../frontend/utils/authenticated-fetch.js');

const realFetch = globalThis.fetch;

// Minimal Response stand-in: only the members authenticatedFetch touches.
const httpResponse = (status, body, { statusText = '', json = true } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText,
  json: async () => {
    if (!json) throw new SyntaxError('Unexpected token < in JSON');
    return body;
  },
});

beforeEach(() => {
  setActivePinia(createPinia());
  globalThis.localStorage.clear();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('fetchErrorLabel', () => {
  it('names the status when the failure carried one', () => {
    assert.equal(fetchErrorLabel(Object.assign(new Error('x'), { status: 403 })), 'HTTP 403');
    assert.equal(fetchErrorLabel(Object.assign(new Error('x'), { status: 500 })), 'HTTP 500');
  });

  it('falls back to "network" without a status, and tolerates no argument', () => {
    assert.equal(fetchErrorLabel(new Error('Failed to fetch')), 'network');
    assert.equal(fetchErrorLabel(undefined), 'network');
  });

  it('stays bounded — one label per status, so fingerprints cannot sprawl', () => {
    const labels = new Set([400, 403, 429, 500, 502].map(
      (status) => fetchErrorLabel({ status })
    ));
    assert.equal(labels.size, 5);
  });
});

describe('authenticatedFetch — error shape', () => {
  it('attaches the HTTP status to the thrown error', async () => {
    globalThis.fetch = async () => httpResponse(403, { error: 'Access denied' });
    const error = await authenticatedFetch('/api/ipchecking?ip=1.1.1.1').then(
      () => null,
      (e) => e
    );
    assert.equal(error.status, 403);
    assert.match(error.message, /^Fetch failed: HTTP error! Status: 403 - /);
    assert.equal(fetchErrorLabel(error), 'HTTP 403');
  });

  it('keeps the status when the body is not JSON (edge block pages)', async () => {
    globalThis.fetch = async () => httpResponse(403, null, { json: false });
    const error = await authenticatedFetch('/api/ipchecking?ip=1.1.1.1').catch((e) => e);
    assert.equal(error.status, 403);
    assert.equal(fetchErrorLabel(error), 'HTTP 403');
  });

  it('leaves a network failure without a status', async () => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    const error = await authenticatedFetch('/api/ipchecking?ip=1.1.1.1').catch((e) => e);
    assert.equal(error.status, undefined);
    assert.equal(error.message, 'Fetch failed: Failed to fetch');
    assert.equal(fetchErrorLabel(error), 'network');
  });

  it('passes AbortError through untouched for the Sentry beforeSend filter', async () => {
    globalThis.fetch = async () => {
      throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    };
    const error = await authenticatedFetch('/api/ipchecking?ip=1.1.1.1').catch((e) => e);
    assert.equal(error.name, 'AbortError');
    assert.doesNotMatch(error.message, /^Fetch failed:/);
  });

  it('returns the parsed body on success', async () => {
    globalThis.fetch = async () => httpResponse(200, { ip: '1.1.1.1' });
    assert.deepEqual(await authenticatedFetch('/api/ipchecking?ip=1.1.1.1'), { ip: '1.1.1.1' });
  });
});
