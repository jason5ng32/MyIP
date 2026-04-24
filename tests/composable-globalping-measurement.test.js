// Tests for useGlobalpingMeasurement — the shared POST+poll orchestrator for
// MtrTest / GlobalLatencyTest / CensorshipCheck.
//
// We drive the composable inside an effectScope so onScopeDispose fires
// deterministically, and stub globalThis.fetch to simulate create/poll
// responses without touching the network.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { effectScope } from 'vue';

import { useGlobalpingMeasurement } from '../frontend/composables/use-globalping-measurement.js';

const API_BASE = 'https://api.globalping.io/v1/measurements';
const originalFetch = globalThis.fetch;

// Minimal Response-shaped helper for fetch stubs.
const jsonResponse = (body, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => body,
});

// A fetch router: given a map of predicate → handler, dispatch by URL.
function stubFetch(routes) {
  globalThis.fetch = async (url, init) => {
    for (const [match, handler] of routes) {
      if (match(url, init)) return handler(url, init);
    }
    throw new Error(`unstubbed fetch: ${url}`);
  };
}

// Run a fn inside an effectScope, call scope.stop() to fire onScopeDispose.
function withScope(fn) {
  const scope = effectScope();
  const value = scope.run(fn);
  return { scope, value };
}

// Flush scheduled microtasks + one macrotask tick so chained setTimeout(0)
// promises settle before we assert.
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('useGlobalpingMeasurement()', () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('happy path: POST → poll returns finished → status="finished", onFinish fires', async () => {
    const payload = { status: 'finished', results: [{ ok: true }] };
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ id: 'abc' })],
      [(url) => url === `${API_BASE}/abc`,
        () => jsonResponse(payload)],
    ]);

    const resultPayloads = [];
    let finishCalls = 0;
    let errorCalls = 0;

    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 5, maxRetries: 3 })
    );
    try {
      value.start({ target: '1.2.3.4', type: 'ping' }, {
        onResults: (d) => { resultPayloads.push(d); return d.results.length > 0; },
        onFinish: () => { finishCalls++; },
        onError: () => { errorCalls++; },
      });

      // wait for the poll to land (initial create + one setTimeout(pollInterval))
      await tick(); await tick(); await new Promise((r) => setTimeout(r, 20));

      assert.equal(value.status.value, 'finished');
      assert.equal(finishCalls, 1);
      assert.equal(errorCalls, 0);
      assert.deepEqual(resultPayloads, [payload]);
    } finally {
      scope.stop();
    }
  });

  it('retries while in-progress, then finishes when the last poll returns success', async () => {
    let pollCount = 0;
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ id: 'abc' })],
      [(url) => url === `${API_BASE}/abc`,
        () => {
          pollCount++;
          if (pollCount < 3) return jsonResponse({ status: 'in-progress', results: [] });
          return jsonResponse({ status: 'finished', results: [{ ok: true }] });
        }],
    ]);

    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 5, maxRetries: 5 })
    );
    try {
      value.start({}, {
        onResults: (d) => d.results.length > 0,
      });
      await new Promise((r) => setTimeout(r, 80));
      assert.equal(value.status.value, 'finished');
      assert.equal(pollCount, 3);
    } finally {
      scope.stop();
    }
  });

  it('stops retrying once maxRetries is reached; "empty" error when no results ever arrived', async () => {
    let pollCount = 0;
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ id: 'abc' })],
      [(url) => url === `${API_BASE}/abc`,
        () => { pollCount++; return jsonResponse({ status: 'in-progress', results: [] }); }],
    ]);

    const errorReasons = [];
    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 2, maxRetries: 2 })
    );
    try {
      value.start({}, {
        onResults: () => false,
        onError: (r) => errorReasons.push(r),
      });
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(value.status.value, 'error');
      assert.deepEqual(errorReasons, ['empty']);
      // 1 initial poll + 2 retries = 3 total
      assert.equal(pollCount, 3);
    } finally {
      scope.stop();
    }
  });

  it('POST failure → status="error", onError("create"), no polling', async () => {
    let polled = false;
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => { throw new Error('boom'); }],
      [() => true,
        () => { polled = true; return jsonResponse({}); }],
    ]);

    const errorReasons = [];
    // silence the expected console.error so test output stays clean
    const origErr = console.error;
    console.error = () => {};

    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 5 })
    );
    try {
      value.start({}, { onError: (r) => errorReasons.push(r) });
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(value.status.value, 'error');
      assert.deepEqual(errorReasons, ['create']);
      assert.equal(polled, false);
    } finally {
      scope.stop();
      console.error = origErr;
    }
  });

  it('POST returns payload without id → status="error", onError("create")', async () => {
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ /* no id */ })],
    ]);
    const errorReasons = [];
    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 5 })
    );
    try {
      value.start({}, { onError: (r) => errorReasons.push(r) });
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(value.status.value, 'error');
      assert.deepEqual(errorReasons, ['create']);
    } finally {
      scope.stop();
    }
  });

  it('poll failure → status="error", onError("poll")', async () => {
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ id: 'abc' })],
      [(url) => url === `${API_BASE}/abc`,
        () => { throw new Error('net'); }],
    ]);
    const errorReasons = [];
    const origErr = console.error;
    console.error = () => {};

    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 5 })
    );
    try {
      value.start({}, { onError: (r) => errorReasons.push(r) });
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(value.status.value, 'error');
      assert.deepEqual(errorReasons, ['poll']);
    } finally {
      scope.stop();
      console.error = origErr;
    }
  });

  it('scope disposal before the first poll cancels pending timer and never transitions status', async () => {
    let polled = false;
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => jsonResponse({ id: 'abc' })],
      [(url) => url === `${API_BASE}/abc`,
        () => { polled = true; return jsonResponse({ status: 'finished', results: [{ ok: true }] }); }],
    ]);

    let finishCalls = 0;
    let errorCalls = 0;
    const { scope, value } = withScope(() =>
      useGlobalpingMeasurement({ pollInterval: 50 })
    );
    value.start({}, {
      onResults: () => true,
      onFinish: () => { finishCalls++; },
      onError: () => { errorCalls++; },
    });
    // let the POST resolve but stop the scope before the poll fires
    await new Promise((r) => setTimeout(r, 10));
    scope.stop();
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(polled, false, 'poll should never fire after scope stop');
    assert.equal(finishCalls, 0);
    assert.equal(errorCalls, 0);
  });
});
