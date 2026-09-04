// Exercises the runners in frontend/utils/dnsleaks with stubbed providers:
// the retry loop and its isValidIP gate (`runWithRetry`), the slot →
// standby → neighbour ordering (`buildFallbackChain`) and the chain walk
// that reports which provider answered (`runWithFallback`).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  runWithRetry, buildFallbackChain, runWithFallback,
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
