// Exercises `runChain` from frontend/utils/getips — the single funnel every
// IP-card source result flows through. Providers are stubbed; the behaviors
// under test are the per-hop `accept` gate, fallback advancement on both
// throw and garbage response, the never-throws exhaustion contract, and the
// originalSite passthrough. The single-version entry points run their real
// providers against a stubbed fetch, to pin which version each one accepts.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  runChain,
  getIPFromIPChecking4,
  getIPFromIPChecking6,
  getIPFromIPChecking64,
  getIPFromCloudflare_V4,
  getIPFromCloudflare_V6,
  getIPFromIPIP,
} from '../frontend/utils/getips/index.js';
import { isValidIPv6 } from '../frontend/utils/ip/valid-ip.js';

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
    await runChain([first, second], { originalSite: true });
    assert.deepEqual(first.calls, [true]);
    assert.deepEqual(second.calls, [true]);
  });

  it('advances past a hop whose IP fails a custom accept check', async () => {
    const first = stubProvider('a', 'Source A', '104.28.163.235');
    const second = stubProvider('b', 'Source B', '2606:4700::1111');
    const result = await runChain([first, second], { accept: isValidIPv6 });
    assert.deepEqual(result, { ip: '2606:4700::1111', source: 'Source B' });
  });

  it('exhausts when the accept check rejects every hop', async () => {
    const first = stubProvider('a', 'Source A', '104.28.163.235');
    const second = stubProvider('b', 'Source B', '1.1.1.1');
    const result = await runChain([first, second], { accept: isValidIPv6 });
    assert.deepEqual(result, { ip: null, source: 'Source B' });
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

// The single-version chains, each with a host only its first hop calls and
// the display name of its fallback hop.
const VERSION_CHAINS = [
  { fn: getIPFromIPChecking4, firstHost: '4.ipcheck.ing', fallback: 'IPify IPv4', right: '1.1.1.1', wrong: '2606:4700::1111' },
  { fn: getIPFromIPChecking6, firstHost: '6.ipcheck.ing', fallback: 'IPify IPv6', right: '2606:4700::1111', wrong: '1.1.1.1' },
  { fn: getIPFromCloudflare_V4, firstHost: '1.0.0.1', fallback: 'MyExternalIP IPv4', right: '1.1.1.1', wrong: '2606:4700::1111' },
  { fn: getIPFromCloudflare_V6, firstHost: '[2606:4700:4700::1111]', fallback: 'MyExternalIP IPv6', right: '2606:4700::1111', wrong: '1.1.1.1' },
];

// Answer every provider request with the IP `ipFor(url)` picks, shaped as a
// trace body or JSON to match the endpoint.
const stubFetch = (ipFor) => {
  globalThis.fetch = async (url) => {
    const ip = ipFor(String(url));
    return new Response(url.includes('/cdn-cgi/trace') ? `ip=${ip}\n` : JSON.stringify({ ip }));
  };
};

describe('single-version entry points', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  for (const { fn, firstHost, fallback, right, wrong } of VERSION_CHAINS) {
    it(`${fn.name} skips a wrong-version answer for the fallback's`, async () => {
      stubFetch((url) => (url.includes(firstHost) ? wrong : right));
      assert.deepEqual(await fn(), { ip: right, source: fallback });
    });

    it(`${fn.name} exhausts when every hop answers the wrong version`, async () => {
      stubFetch(() => wrong);
      assert.deepEqual(await fn(), { ip: null, source: fallback });
    });
  }
});
