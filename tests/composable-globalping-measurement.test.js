// Tests for useGlobalpingMeasurement — the shared POST+poll orchestrator for
// MtrTest / GlobalLatencyTest / CensorshipCheck.
//
// We drive the composable inside an effectScope so onScopeDispose fires
// deterministically, and stub globalThis.fetch to simulate create/poll
// responses without touching the network.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { effectScope } from 'vue';

import { useGlobalpingMeasurement, classifyTarget } from '../frontend/composables/use-globalping-measurement.js';

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

// Wait until `predicate()` holds, polling on a macrotask so the composable's
// setTimeout-driven poll chain can advance between checks.
//
// A fixed sleep cannot do this job: a run here spans a POST plus up to three
// real `pollInterval` timers, so any constant is either flaky when the machine
// is loaded or slow on every green run.
//
// The timeout only bounds a hang; it is never reached on a passing run.
const waitFor = async (predicate, { timeout = 2000, label = 'condition' } = {}) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (predicate()) return;
    if (Date.now() > deadline) throw new Error(`timed out after ${timeout}ms waiting for ${label}`);
    await tick();
  }
};

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

      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });

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
      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });
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
      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });
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
      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });
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
      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });
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
      await waitFor(() => value.status.value !== 'running', { label: "status to leave 'running'" });
      assert.equal(value.status.value, 'error');
      assert.deepEqual(errorReasons, ['poll']);
    } finally {
      scope.stop();
      console.error = origErr;
    }
  });

  it('scope disposal before the first poll cancels pending timer and never transitions status', async () => {
    let polled = false;
    // Set once the create response body has been read: the composable schedules
    // the first poll immediately after that await, so this is the earliest
    // point at which there is a pending timer for scope.stop() to cancel.
    let createRead = false;
    stubFetch([
      [(url, init) => url === API_BASE && init?.method === 'POST',
        () => ({ ok: true, status: 200, json: async () => { createRead = true; return { id: 'abc' }; } })],
      [(url) => url === `${API_BASE}/abc`,
        () => { polled = true; return jsonResponse({ status: 'finished', results: [{ ok: true }] }); }],
    ]);

    let finishCalls = 0;
    let errorCalls = 0;

    // `polled === false` alone does not pin the cancellation: onScopeDispose
    // also sets `disposed`, and poll() returns early on that, so deleting the
    // clearTimeout leaves every other assertion here green. Record the poll
    // timer by its distinctive 50ms delay — tick() and waitFor() use 0 — and
    // require that exact timer to have been cleared.
    const origSetTimeout = globalThis.setTimeout;
    const origClearTimeout = globalThis.clearTimeout;
    const pollTimers = [];
    const clearedTimers = [];
    globalThis.setTimeout = (fn, delay, ...rest) => {
      const id = origSetTimeout(fn, delay, ...rest);
      if (delay === 50) pollTimers.push(id);
      return id;
    };
    globalThis.clearTimeout = (id) => { clearedTimers.push(id); return origClearTimeout(id); };

    try {
      const { scope, value } = withScope(() =>
        useGlobalpingMeasurement({ pollInterval: 50 })
      );
      value.start({}, {
        onResults: () => true,
        onFinish: () => { finishCalls++; },
        onError: () => { errorCalls++; },
      });
      // Stop the scope after the poll is scheduled but before it fires. A fixed
      // 10ms sleep here could land before the POST resolved, leaving no timer to
      // cancel — the test would then pass without exercising the cancellation.
      await waitFor(() => createRead, { label: 'the create response to be read' });
      await tick();
      assert.equal(pollTimers.length, 1, 'the first poll should be scheduled before the scope stops');
      scope.stop();
      assert.ok(clearedTimers.includes(pollTimers[0]), 'scope.stop() should clear the pending poll timer');
      // Nothing should happen from here on, and only a real wait can show that:
      // this is the one delay in the file that is asserting an absence.
      await new Promise((r) => origSetTimeout(r, 80));
    } finally {
      globalThis.setTimeout = origSetTimeout;
      globalThis.clearTimeout = origClearTimeout;
    }

    assert.equal(polled, false, 'poll should never fire after scope stop');
    assert.equal(finishCalls, 0);
    assert.equal(errorCalls, 0);
  });
});

// classifyTarget gates the MtrTest / GlobalLatencyTest manual-entry inputs:
// only 'ok' may run, 'unreachable' earns its own explanation in the UI.
describe('classifyTarget()', () => {
  const cases = [
    ['', 'empty'],
    ['   ', 'empty'],
    [undefined, 'empty'],
    ['not an ip', 'invalid'],
    ['1.1.1.1.1', 'invalid'],
    ['256.1.1.1', 'invalid'],
    ['192.168.1.1', 'unreachable'],
    ['10.0.0.1', 'unreachable'],
    ['127.0.0.1', 'unreachable'],
    ['169.254.1.1', 'unreachable'],
    ['fd00::1', 'unreachable'],
    ['fe80::1', 'unreachable'],
    ['1.1.1.1', 'ok'],
    ['  8.8.8.8  ', 'ok'],
    ['2001:4860:4860::8888', 'ok'],
  ];

  for (const [input, expected] of cases) {
    it(`classifies ${JSON.stringify(input)} as ${expected}`, () => {
      assert.equal(classifyTarget(input), expected);
    });
  }
});
