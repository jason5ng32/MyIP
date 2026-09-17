// Exercises the runners in frontend/utils/dnsleaks with stubbed providers:
// the retry loop and its isValidIP gate (`runWithRetry`), the slot →
// standby → neighbour ordering (`buildFallbackChain`) and the chain walk
// that reports which provider answered (`runWithFallback`).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  runWithRetry, buildFallbackChain, runWithFallback, createDnsLeakRunner,
} from '../frontend/utils/dnsleaks/index.js';

const providerReturning = (results) => {
  let call = 0;
  return {
    id: 'stub',
    name: 'stub-provider',
    run: async () => {
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      if (result instanceof Error) throw result;
      return result;
    },
    calls: () => call,
  };
};

describe('runWithRetry', () => {
  it('returns a result whose ip passes isValidIP', async () => {
    const provider = providerReturning([{ ip: '8.8.8.8' }]);
    const result = await runWithRetry(provider);
    assert.deepEqual(result, { ip: '8.8.8.8' });
    assert.equal(provider.calls(), 1);
  });

  it('accepts IPv6 results', async () => {
    const provider = providerReturning([{ ip: '2001:4860:4860::8888' }]);
    const result = await runWithRetry(provider);
    assert.deepEqual(result, { ip: '2001:4860:4860::8888' });
  });

  it('retries when the provider throws, then returns the first success', async () => {
    const provider = providerReturning([
      new Error('boom'),
      { ip: '1.1.1.1' },
    ]);
    const result = await runWithRetry(provider);
    assert.deepEqual(result, { ip: '1.1.1.1' });
    assert.equal(provider.calls(), 2);
  });

  it('treats an invalid ip as a failed attempt and retries', async () => {
    const provider = providerReturning([
      { ip: 'error' },
      { ip: '9.9.9.9' },
    ]);
    const result = await runWithRetry(provider);
    assert.deepEqual(result, { ip: '9.9.9.9' });
    assert.equal(provider.calls(), 2);
  });

  it('throws after exhausting attempts on persistently invalid ips', async () => {
    const provider = providerReturning([{ ip: 'not-an-ip' }]);
    await assert.rejects(
      () => runWithRetry(provider),
      /stub: invalid IP in response/,
    );
    assert.equal(provider.calls(), 2);
  });

  it('rejects a result missing the ip field entirely', async () => {
    const provider = providerReturning([{}]);
    await assert.rejects(
      () => runWithRetry(provider),
      /stub: invalid IP in response/,
    );
  });

  it('honors a custom attempts count', async () => {
    const provider = providerReturning([new Error('boom')]);
    await assert.rejects(() => runWithRetry(provider, 5), /boom/);
    assert.equal(provider.calls(), 5);
  });
});

const provider = (id, results) => ({ ...providerReturning(results), id, name: `${id}.example` });

describe('buildFallbackChain', () => {
  const a = provider('a', []);
  const b = provider('b', []);
  const c = provider('c', []);
  const d = provider('d', []);
  const e = provider('e', []);
  const registry = [a, b, c, d, e];

  it('orders own provider, then the standbys beyond the slots, then the other slots from 0', () => {
    assert.deepEqual(buildFallbackChain(1, registry, 3), [b, d, e, a, c]);
  });

  it('keeps registry order among several standbys', () => {
    assert.deepEqual(buildFallbackChain(0, registry, 2), [a, c, d, e, b]);
  });

  it('is just the neighbours when there are no standbys', () => {
    assert.deepEqual(buildFallbackChain(2, [a, b, c], 3), [c, a, b]);
  });

  it('is only the provider itself when it is the whole registry', () => {
    assert.deepEqual(buildFallbackChain(0, [a], 1), [a]);
  });

  it('returns an empty chain for an index outside the registry', () => {
    assert.deepEqual(buildFallbackChain(5, registry, 4), []);
  });
});

describe('runWithFallback', () => {
  it('resolves with the primary and never touches the rest of the chain', async () => {
    const primary = provider('primary', [{ ip: '8.8.8.8' }]);
    const spare = provider('spare', [{ ip: '1.1.1.1' }]);
    const result = await runWithFallback([primary, spare]);
    assert.deepEqual(result, { ip: '8.8.8.8', provider: primary });
    assert.equal(spare.calls(), 0);
  });

  it('falls through to the next provider once the primary exhausts its attempts', async () => {
    const dead = provider('dead', [new Error('down')]);
    const spare = provider('spare', [{ ip: '1.1.1.1' }]);
    const result = await runWithFallback([dead, spare]);
    assert.equal(result.ip, '1.1.1.1');
    assert.equal(result.provider, spare);
    assert.equal(dead.calls(), 2);
    assert.equal(spare.calls(), 1);
  });

  it('gives every provider in the chain the default retry budget', async () => {
    const dead = provider('dead', [new Error('down')]);
    const flaky = provider('flaky', [{ ip: 'garbage' }, { ip: '9.9.9.9' }]);
    const result = await runWithFallback([dead, flaky]);
    assert.equal(result.provider, flaky);
    assert.equal(dead.calls(), 2);
    assert.equal(flaky.calls(), 2);
  });

  it('throws the last error when the whole chain fails', async () => {
    const first = provider('first', [new Error('first down')]);
    const last = provider('last', [new Error('last down')]);
    await assert.rejects(() => runWithFallback([first, last]), /last down/);
  });

  it('rejects an empty chain', async () => {
    await assert.rejects(() => runWithFallback([]), /empty provider chain/);
  });
});

describe('per-run shared probes', () => {
  it('shares an in-flight standby across failed slots and reuses the settled result', async () => {
    let resolve;
    let calls = 0;
    const pending = new Promise(yes => { resolve = yes; });
    const spare = { id: 'spare', run: () => { calls++; return pending; } };
    const dead = [provider('a', [new Error('down')]), provider('b', [new Error('down')])];
    const run = createDnsLeakRunner([...dead, spare], 2);
    const results = [run(0), run(1)];
    await new Promise(yes => setImmediate(yes));
    assert.equal(calls, 1, 'concurrent slots share the pending request');
    resolve({ ip: '192.0.2.53' });
    for (const result of await Promise.all(results)) {
      assert.equal(result.provider, spare);
      assert.equal(result.ip, '192.0.2.53');
    }
    await run(0);
    assert.equal(calls, 1, 'the completed result is cached for the run');
    assert.deepEqual(dead.map(p => p.calls()), [2, 2]);
  });

  it('shares exhausted failures and retries them only in a fresh run', async () => {
    const registry = ['a', 'b', 'spare'].map(id => provider(id, [new Error(`${id} down`)]));
    const first = createDnsLeakRunner(registry, 2);
    const results = await Promise.allSettled([first(0), first(1)]);
    assert(results.every(result => result.status === 'rejected'));
    assert.deepEqual(registry.map(p => p.calls()), [2, 2, 2]);
    await assert.rejects(first(0));
    assert.deepEqual(registry.map(p => p.calls()), [2, 2, 2]);
    await assert.rejects(createDnsLeakRunner(registry, 2)(0));
    assert.deepEqual(registry.map(p => p.calls()), [4, 4, 4]);
  });

  it('shares a neighbour primary and refreshes successful results in a new run', async () => {
    const dead = provider('dead', [new Error('down')]);
    const live = provider('live', [{ ip: '192.0.2.1' }, { ip: '192.0.2.2' }]);
    const spare = provider('spare', [new Error('down')]);
    const registry = [dead, live, spare];
    const first = createDnsLeakRunner(registry, 2);
    const results = await Promise.all([first(0), first(1)]);
    assert(results.every(result => result.provider === live && result.ip === '192.0.2.1'));
    assert.equal(live.calls(), 1);
    assert.equal((await createDnsLeakRunner(registry, 2)(1)).ip, '192.0.2.2');
    assert.equal(live.calls(), 2);
  });
});

describe('provider response parsers', () => {
  it('bash.ws: picks the first entry tagged as a resolver', async () => {
    const { pickDnsIp } = await import('../frontend/utils/dnsleaks/bashws.js');
    assert.equal(pickDnsIp([
      { ip: '203.0.113.9', type: 'ip' },
      { ip: '13.229.187.208', type: 'dns' },
      { ip: '13.229.187.209', type: 'dns' },
      { ip: 'DNS is not leaking.', type: 'conclusion' },
    ]), '13.229.187.208');
    assert.equal(pickDnsIp([{ ip: '203.0.113.9', type: 'ip' }]), null);
    assert.equal(pickDnsIp({ ip: '1.1.1.1' }), null);
    assert.equal(pickDnsIp(null), null);
  });

  it('myipstack: extracts the ip between proto and port, IPv6 included', async () => {
    const { parseRemoteAddress } = await import('../frontend/utils/dnsleaks/myipstack.js');
    assert.equal(parseRemoteAddress('udp:111.206.4.139:41321'), '111.206.4.139');
    assert.equal(parseRemoteAddress('tcp:2001:4860:4860::8888:53\n'), '2001:4860:4860::8888');
    assert.equal(parseRemoteAddress('udp:'), null);
    assert.equal(parseRemoteAddress('garbage'), null);
    assert.equal(parseRemoteAddress(''), null);
    assert.equal(parseRemoteAddress(undefined), null);
  });
});
