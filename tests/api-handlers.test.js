// refactor/03 stage B — 其余 API handler 的 smoke 覆盖
// 仅验证 referer 校验、方法校验、参数早期校验、未配置 API key 的路径。
// 不发起任何真实外部请求：我们全部在这些校验之前就会 return。

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import getUserInfoHandler from '../api/get-user-info.js';
import getWhoisHandler from '../api/get-whois.js';
import cfRadarHandler from '../api/cf-radar.js';
import invisibilityHandler from '../api/invisibility-test.js';
import macCheckerHandler from '../api/mac-checker.js';
import updateAchievementHandler from '../api/update-user-achievement.js';
import ipSbHandler from '../api/ip-sb.js';
import ipapiComHandler from '../api/ipapi-com.js';
import ipapiIsHandler from '../api/ipapi-is.js';
import ipcheckIngHandler from '../api/ipcheck-ing.js';
import ipinfoIoHandler from '../api/ipinfo-io.js';
import ip2locationHandler from '../api/ip2location-io.js';
import dnsResolverHandler from '../api/dns-resolver.js';

// -- 共享测试工具 ---------------------------------------------------------

function createRequest(options = {}) {
  const method = options.method || 'GET';
  const query = options.query || {};
  const body = options.body;
  const referer = Object.hasOwn(options, 'referer') ? options.referer : 'http://localhost/';
  const headers = {};
  if (referer !== undefined) headers.referer = referer;
  return { method, headers, query, body };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
  };
}

// 运行每条测试前备份会被我们操作的 env，运行后还原。
const ENV_KEYS = [
  'IPCHECKING_API_KEY', 'IPCHECKING_API_ENDPOINT',
  'MAC_LOOKUP_API_KEY', 'IPAPIIS_API_KEY',
  'IPINFO_API_TOKEN', 'IP2LOCATION_API_KEY',
  'CLOUDFLARE_API',
];
let envBackup = {};

beforeEach(() => {
  envBackup = {};
  for (const k of ENV_KEYS) envBackup[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (envBackup[k] === undefined) delete process.env[k];
    else process.env[k] = envBackup[k];
  }
});

// Per-handler referer rejection tests have been removed. Referer validation
// is now enforced globally by requireReferer middleware (mounted on /api in
// backend-server.js). tests/guards.test.js covers the middleware itself; the
// handler-level assertions here would pass through when called directly,
// since handlers no longer carry their own referer check.

// -- 逐 handler 参数校验 ---------------------------------------------------

describe('get-whois handler', () => {
  it('rejects missing ?q', async () => {
    const res = createResponse();
    await getWhoisHandler(createRequest(), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'No address provided' });
  });

  it('rejects neither-IP-nor-domain inputs before calling whoiser', async () => {
    const res = createResponse();
    await getWhoisHandler(createRequest({ query: { q: 'not an address' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid IP or address' });
  });
});

describe('cf-radar handler', () => {
  it('rejects missing ?asn', async () => {
    const res = createResponse();
    await cfRadarHandler(createRequest(), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'No ASN provided' });
  });

  it('rejects non-numeric ASN', async () => {
    const res = createResponse();
    await cfRadarHandler(createRequest({ query: { asn: 'AS12345' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid ASN' });
  });
});

describe('invisibility-test handler', () => {
  it('rejects missing ?id', async () => {
    const res = createResponse();
    await invisibilityHandler(createRequest(), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'No ID provided' });
  });

  it('rejects wrong-length id (must be 28 alphanumeric chars)', async () => {
    const res = createResponse();
    await invisibilityHandler(createRequest({ query: { id: 'short' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid ID' });
  });

  it('rejects 28-char id containing non-alphanumerics', async () => {
    const res = createResponse();
    // 28 chars but includes dashes
    await invisibilityHandler(createRequest({ query: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa----' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid ID' });
  });

  it('reports missing API key after param validation passes', async () => {
    delete process.env.IPCHECKING_API_KEY;
    const res = createResponse();
    await invisibilityHandler(createRequest({
      query: { id: 'a'.repeat(28) },
    }), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'API key is missing' });
  });
});

describe('mac-checker handler', () => {
  it('rejects missing ?mac', async () => {
    const res = createResponse();
    await macCheckerHandler(createRequest(), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'No MAC address provided' });
  });

  it('rejects invalid MAC format', async () => {
    const res = createResponse();
    await macCheckerHandler(createRequest({ query: { mac: 'not-a-mac' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid MAC address' });
  });
});

describe('update-user-achievement handler', () => {
  it('rejects non-PUT methods with 405', async () => {
    const res = createResponse();
    await updateAchievementHandler(createRequest({ method: 'POST', body: { name: 'X' } }), res);
    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { error: 'Method not allowed' });
  });

  it('reports missing API key before forwarding', async () => {
    delete process.env.IPCHECKING_API_KEY;
    const res = createResponse();
    await updateAchievementHandler(createRequest({ method: 'PUT', body: { name: 'X' } }), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'API key is missing' });
  });
});

describe('get-user-info handler', () => {
  it('reports missing API key before fetch', async () => {
    delete process.env.IPCHECKING_API_KEY;
    const res = createResponse();
    await getUserInfoHandler(createRequest(), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'API key is missing' });
  });
});

describe('ipcheck-ing handler', () => {
  // Missing / malformed ?ip rejection moved to requireValidIP middleware
  // (see tests/guards.test.js). The handler itself no longer checks.

  it('reports missing API key after IP passes validation', async () => {
    delete process.env.IPCHECKING_API_KEY;
    const res = createResponse();
    await ipcheckIngHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'API key is missing' });
  });
});

// The parametrized "rejects missing ?ip / rejects malformed ip" suites
// across ip-sb / ipapi-com / ipinfo-io / ipapi-is / ip2location-io are all
// covered by tests/guards.test.js at the middleware layer now.

// -- dns-resolver 补充分支 -------------------------------------------------

describe('dns-resolver additional branches', () => {
  it("rejects hostname that doesn't contain a dot", async () => {
    const res = createResponse();
    await dnsResolverHandler(createRequest({ query: { hostname: 'localhost', type: 'A' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid hostname' });
  });

  it('rejects a numeric (non-string) hostname with a specific error', async () => {
    const res = createResponse();
    // Express parses query as strings normally, but we simulate a caller sending a non-string.
    await dnsResolverHandler(createRequest({ query: { hostname: 12345, type: 'A' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Hostname parameter must be a string' });
  });
});
