// Tests for the app-wide command bus (frontend/utils/app-commands.js):
// single-owner registration, dispatch / result semantics, 'unavailable' and
// 'timeout' rejection codes, the appCommandError owner-rejection helper, and
// waitForAppCommand registration hooks.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  registerAppCommand,
  dispatchAppCommand,
  hasAppCommand,
  waitForAppCommand,
  appCommandError,
} from '../frontend/utils/app-commands.js';

const withSilencedWarn = async (fn) => {
  const original = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = original;
  }
};

describe('app-commands', () => {
  it('dispatch resolves with the handler result and passes the payload', async () => {
    const off = registerAppCommand('test:echo', (payload) => ({ got: payload.value }));
    try {
      assert.deepEqual(await dispatchAppCommand('test:echo', { value: 7 }), { got: 7 });
    } finally {
      off();
    }
  });

  it('defaults the payload to an empty object and awaits async handlers', async () => {
    const off = registerAppCommand('test:async', async (payload) => payload);
    try {
      assert.deepEqual(await dispatchAppCommand('test:async'), {});
    } finally {
      off();
    }
  });

  it('dispatch with no handler rejects with code "unavailable"', async () => {
    await assert.rejects(dispatchAppCommand('test:nobody'), (error) => {
      assert.equal(error.code, 'unavailable');
      assert.match(error.message, /test:nobody/);
      return true;
    });
  });

  it('re-registering warns and the new handler wins', async () => {
    await withSilencedWarn(async () => {
      let warned = 0;
      const originalWarn = console.warn;
      console.warn = () => { warned += 1; };
      const offA = registerAppCommand('test:owner', () => 'a');
      const offB = registerAppCommand('test:owner', () => 'b');
      console.warn = originalWarn;
      try {
        assert.equal(warned, 1, 'second registration warns');
        assert.equal(await dispatchAppCommand('test:owner'), 'b');
      } finally {
        offA();
        offB();
      }
    });
  });

  it('an unregister only removes its own handler, never a replacement', async () => {
    await withSilencedWarn(async () => {
      const offA = registerAppCommand('test:stale', () => 'a');
      const offB = registerAppCommand('test:stale', () => 'b');
      offA(); // stale owner unregisters after being replaced
      try {
        assert.equal(hasAppCommand('test:stale'), true, 'replacement survives');
        assert.equal(await dispatchAppCommand('test:stale'), 'b');
      } finally {
        offB();
      }
      assert.equal(hasAppCommand('test:stale'), false);
    });
  });

  it('a throwing handler propagates as a rejection (sync and async)', async () => {
    const offSync = registerAppCommand('test:throws', () => { throw new Error('sync boom'); });
    const offAsync = registerAppCommand('test:rejects', async () => { throw new Error('async boom'); });
    try {
      await assert.rejects(dispatchAppCommand('test:throws'), /sync boom/);
      await assert.rejects(dispatchAppCommand('test:rejects'), /async boom/);
    } finally {
      offSync();
      offAsync();
    }
  });

  it('a handler rejecting with appCommandError surfaces its code to the dispatcher', async () => {
    const off = registerAppCommand('test:gated', () => {
      throw appCommandError('auth', 'sign-in required');
    });
    try {
      await assert.rejects(dispatchAppCommand('test:gated'), (error) => {
        assert.ok(error instanceof Error, 'helper produces a real Error');
        assert.equal(error.code, 'auth');
        assert.equal(error.message, 'sign-in required');
        return true;
      });
    } finally {
      off();
    }
  });

  it('timeoutMs rejects a hung handler with code "timeout", naming the command', async () => {
    const off = registerAppCommand('test:hangs', () => new Promise(() => {}));
    try {
      await assert.rejects(
        dispatchAppCommand('test:hangs', {}, { timeoutMs: 20 }),
        (error) => {
          assert.equal(error.code, 'timeout');
          assert.match(error.message, /test:hangs/);
          return true;
        },
      );
    } finally {
      off();
    }
  });

  it('a handler resolving before timeoutMs wins the race', async () => {
    const off = registerAppCommand('test:fast', async () => 'done');
    try {
      assert.equal(await dispatchAppCommand('test:fast', {}, { timeoutMs: 1000 }), 'done');
    } finally {
      off();
    }
  });

  it('hasAppCommand reflects registration state', () => {
    assert.equal(hasAppCommand('test:presence'), false);
    const off = registerAppCommand('test:presence', () => {});
    assert.equal(hasAppCommand('test:presence'), true);
    off();
    assert.equal(hasAppCommand('test:presence'), false);
  });

  it('waitForAppCommand resolves immediately for an already-registered command', async () => {
    const off = registerAppCommand('test:already', () => {});
    try {
      await waitForAppCommand('test:already');
    } finally {
      off();
    }
  });

  it('waitForAppCommand resolves when the command registers later', async () => {
    const waited = waitForAppCommand('test:later', { timeoutMs: 1000 });
    const off = registerAppCommand('test:later', () => {});
    try {
      await waited;
    } finally {
      off();
    }
  });

  it('waitForAppCommand rejects with code "timeout" when nothing registers', async () => {
    await assert.rejects(
      waitForAppCommand('test:never', { timeoutMs: 20 }),
      (error) => {
        assert.equal(error.code, 'timeout');
        assert.match(error.message, /test:never/);
        return true;
      },
    );
  });
});
