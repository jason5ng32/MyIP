// Exercises the bash.ws session/probe flow without contacting the provider.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bashws } from '../frontend/utils/dnsleaks/bashws.js';

describe('bash.ws session flow', () => {
  it('uses the upstream ID for exactly one probe and its result, even after TLS failure', async (t) => {
    const sessions = ['123456789', '987654321'];
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      const step = calls.length % 3;
      const id = sessions[Math.floor(calls.length / 3)];
      calls.push({ url, mode: init.mode });
      if (step === 0) {
        assert.equal(url, 'https://bash.ws/id');
        return new Response(` ${id}\n`);
      }
      if (step === 1) {
        throw new TypeError('TLS certificate mismatch after DNS resolution');
      }
      assert.equal(url, `https://bash.ws/dnsleak/test/${id}?json`);
      return Response.json([
        { type: 'ip', ip: '192.0.2.1' },
        { type: 'dns', ip: '192.0.2.53' },
      ]);
    });

    for (const _id of sessions) {
      assert.deepEqual(await bashws.run(), { ip: '192.0.2.53' });
    }
    assert.deepEqual(calls, sessions.flatMap((id) => [
      { url: 'https://bash.ws/id', mode: undefined },
      { url: `https://ex.1.${id}.bash.ws/css/z.css`, mode: 'no-cors' },
      { url: `https://bash.ws/dnsleak/test/${id}?json`, mode: undefined },
    ]));
  });

  it('stops before probing when the ID request fails', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
    await assert.rejects(bashws.run(), /bashws: ID response not ok/);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('rejects invalid ID responses before constructing a probe URL', async (t) => {
    for (const id of ['', ' ', '<html>error</html>', '{"error":"unavailable"}', 'one.two', 'one/path', 'a'.repeat(64)]) {
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(id));
      await assert.rejects(bashws.run(), /bashws: invalid test ID/);
      assert.equal(fetchMock.mock.callCount(), 1);
      fetchMock.mock.restore();
    }
  });

  for (const [name, response, error] of [
    ['HTTP failure', () => new Response('', { status: 503 }), /bashws: response not ok/],
    ['empty result', () => Response.json({ error: 'No DNS servers found. Try again...' }), /bashws: no resolver IP/],
  ]) {
    it(`reports ${name} so the existing retry/fallback can handle it`, async (t) => {
      let calls = 0;
      t.mock.method(globalThis, 'fetch', async () => {
        calls += 1;
        if (calls === 1) return new Response('123456789');
        if (calls === 2) return new Response('');
        return response();
      });
      await assert.rejects(bashws.run(), error);
      assert.equal(calls, 3);
    });
  }
});
