// Exercises `runWithRetry` from frontend/utils/dnsleaks — the single entry
// point every DNS leak provider result flows through. Providers are stubbed;
// the behaviors under test are the retry loop and the isValidIP gate that
// keeps garbage upstream responses away from the MaxMind lookup.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runWithRetry } from '../frontend/utils/dnsleaks/index.js';

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
    assert.equal(provider.calls(), 3);
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
