// Exercises the every1dns.net provider without contacting the upstream.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { every1dns } from '../frontend/utils/dnsleaks/every1dns.js';

const SAMPLE = {
  ip: '13.229.187.210', ip_version: 1, protocol: 'udp', dnssec: true, edns: 0,
  client_subnet: -1, qname_minimization: true, isp: { asn: 16509, name: 'Amazon.com, Inc.' },
};

describe('every1dns.net provider', () => {
  it('probes a fresh UUID label per run and returns the resolver ip', async (t) => {
    const urls = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      urls.push(url);
      // Upstream answers text/plain with a JSON body.
      return new Response(JSON.stringify(SAMPLE), { headers: { 'content-type': 'text/plain' } });
    });
    assert.deepEqual(await every1dns.run(), { ip: '13.229.187.210' });
    assert.deepEqual(await every1dns.run(), { ip: '13.229.187.210' });
    const label = /^https:\/\/([0-9a-f-]{36})\.map\.help\.every1dns\.net\/$/;
    assert.match(urls[0], label);
    assert.match(urls[1], label);
    assert.notEqual(urls[0], urls[1]);
  });

  it('throws on a non-ok response or a body without ip', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 502 }));
    await assert.rejects(every1dns.run(), /every1dns: response not ok/);
    fetchMock.mock.mockImplementation(async () => Response.json({ isp: SAMPLE.isp }));
    await assert.rejects(every1dns.run(), /every1dns: missing ip/);
  });
});
