// Exercises `runChain` from frontend/utils/getips — the single funnel every
// IP-card source result flows through. Providers are stubbed; the behaviors
// under test are the per-hop isValidIP gate, fallback advancement on both
// throw and garbage response, the never-throws exhaustion contract, and the
// originalSite passthrough. Real provider modules are only asserted for
// shape — their network behavior is out of scope.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  runChain,
  getIPFromIPChecking4,
  getIPFromIPChecking6,
  getIPFromIPChecking64,
  getIPFromCloudflare_V4,
  getIPFromCloudflare_V6,
  getIPFromIPIP,
} from '../frontend/utils/getips/index.js';

const stubProvider = (id, name, behavior) => {
  const calls = [];
  return {
    id,
    name,
    run: async (originalSite) => {
      calls.push(originalSite);
      if (behavior instanceof Error) throw behavior;
      return behavior;
    },
    calls,
  };
};

// Silence the intentional per-hop console.warn noise during the spec run.
const originalWarn = console.warn;
console.warn = () => {};
process.on('exit', () => { console.warn = originalWarn; });

describe('runChain', () => {
  it('returns the first hop when its IP is valid, without touching later hops', async () => {
    const first = stubProvider('a', 'Source A', '8.8.8.8');
    const second = stubProvider('b', 'Source B', '9.9.9.9');
    const result = await runChain([first, second]);
    assert.deepEqual(result, { ip: '8.8.8.8', source: 'Source A' });
    assert.equal(second.calls.length, 0);
  });

  it('advances past a hop that returns garbage', async () => {
    const first = stubProvider('a', 'Source A', '<html>error page</html>');
    const second = stubProvider('b', 'Source B', '1.1.1.1');
    const result = await runChain([first, second]);
    assert.deepEqual(result, { ip: '1.1.1.1', source: 'Source B' });
  });

  it('advances past a hop that throws', async () => {
    const first = stubProvider('a', 'Source A', new Error('network down'));
    const second = stubProvider('b', 'Source B', '2001:4860:4860::8888');
    const result = await runChain([first, second]);
    assert.deepEqual(result, { ip: '2001:4860:4860::8888', source: 'Source B' });
  });

  it('resolves { ip: null } with the last hop name when every hop fails', async () => {
    const first = stubProvider('a', 'Source A', 'not-an-ip');
    const second = stubProvider('b', 'Source B', new Error('boom'));
    const result = await runChain([first, second]);
    assert.deepEqual(result, { ip: null, source: 'Source B' });
  });

  it('never rejects even when a hop throws synchronous garbage', async () => {
    const broken = {
      id: 'broken',
      name: 'Broken',
      run: () => { throw new Error('sync throw'); },
    };
    const result = await runChain([broken]);
    assert.deepEqual(result, { ip: null, source: 'Broken' });
  });

  it('passes originalSite through to every hop', async () => {
    const first = stubProvider('a', 'Source A', 'nope');
    const second = stubProvider('b', 'Source B', '3.3.3.3');
    await runChain([first, second], true);
    assert.deepEqual(first.calls, [true]);
    assert.deepEqual(second.calls, [true]);
  });
});

describe('getips public entry points', () => {
  it('keeps the six card-facing functions exported', () => {
    for (const fn of [
      getIPFromIPChecking4,
      getIPFromIPChecking6,
      getIPFromIPChecking64,
      getIPFromCloudflare_V4,
      getIPFromCloudflare_V6,
      getIPFromIPIP,
    ]) {
      assert.equal(typeof fn, 'function');
    }
  });
});
