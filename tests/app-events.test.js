// Tests for the app-wide event bus (frontend/utils/app-events.js):
// subscribe / emit / unsubscribe semantics, handler error isolation, and the
// waitForAppEvent one-shot subscription.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onAppEvent, emitAppEvent, waitForAppEvent } from '../frontend/utils/app-events.js';

describe('app-events', () => {
  it('delivers the payload to every subscriber of the event', () => {
    const seen = [];
    const offA = onAppEvent('test:multi', (p) => seen.push(['a', p.value]));
    const offB = onAppEvent('test:multi', (p) => seen.push(['b', p.value]));
    emitAppEvent('test:multi', { value: 42 });
    offA();
    offB();
    assert.deepEqual(seen, [['a', 42], ['b', 42]]);
  });

  it('defaults the payload to an empty object', () => {
    let received;
    const off = onAppEvent('test:default-payload', (p) => { received = p; });
    emitAppEvent('test:default-payload');
    off();
    assert.deepEqual(received, {});
  });

  it('does not deliver to other events or after unsubscribe', () => {
    let count = 0;
    const off = onAppEvent('test:target', () => { count += 1; });
    emitAppEvent('test:other');
    emitAppEvent('test:target');
    off();
    emitAppEvent('test:target');
    assert.equal(count, 1);
  });

  it('a throwing handler does not break the remaining handlers', () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      let secondRan = false;
      const offA = onAppEvent('test:throws', () => { throw new Error('boom'); });
      const offB = onAppEvent('test:throws', () => { secondRan = true; });
      assert.doesNotThrow(() => emitAppEvent('test:throws'));
      offA();
      offB();
      assert.equal(secondRan, true);
    } finally {
      console.error = originalError;
    }
  });

  it('emitting an event with no subscribers is a no-op', () => {
    assert.doesNotThrow(() => emitAppEvent('test:nobody-listens', { any: 'thing' }));
  });

  it('waitForAppEvent resolves with the next payload, subscribe-before-trigger', async () => {
    const waited = waitForAppEvent('test:one-shot');
    emitAppEvent('test:one-shot', { value: 1 });
    assert.deepEqual(await waited, { value: 1 });
  });

  it('waitForAppEvent is one-shot: only the first emission is delivered', async () => {
    let delivered = 0;
    const waited = waitForAppEvent('test:one-shot-only').then(() => { delivered += 1; });
    emitAppEvent('test:one-shot-only', { n: 1 });
    emitAppEvent('test:one-shot-only', { n: 2 });
    await waited;
    assert.equal(delivered, 1);
  });

  it('waitForAppEvent rejects with code "timeout" and unsubscribes', async () => {
    await assert.rejects(
      waitForAppEvent('test:never-fires', { timeoutMs: 20 }),
      (error) => {
        assert.equal(error.code, 'timeout');
        assert.match(error.message, /test:never-fires/);
        return true;
      },
    );
    // The timed-out subscription is gone: emitting afterwards is a no-op.
    assert.doesNotThrow(() => emitAppEvent('test:never-fires'));
  });
});
