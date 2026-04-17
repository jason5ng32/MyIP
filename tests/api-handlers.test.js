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

// -- 通用 referer-rejection 参数化测试 -----------------------------------

const refererRejectedHandlers = [
  ['get-user-info', getUserInfoHandler],
  ['get-whois', getWhoisHandler],
  ['cf-radar', cfRadarHandler],
  ['invisibility-test', invisibilityHandler],
  ['mac-checker', macCheckerHandler],
  ['update-user-achievement', updateAchievementHandler],
  ['ip-sb', ipSbHandler],
  ['ipapi-com', ipapiComHandler],
  ['ipapi-is', ipapiIsHandler],
  ['ipcheck-ing', ipcheckIngHandler],
  ['ipinfo-io', ipinfoIoHandler],
  ['ip2location-io', ip2locationHandler],
];

describe('All IP/whois/radar/achievement handlers reject missing referer with 403', () => {
  for (const [name, handler] of refererRejectedHandlers) {
    it(`${name} responds 403 when referer header is absent`, async () => {
      const res = createResponse();
      await handler(createRequest({ referer: undefined }), res);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: 'What are you doing?' });
    });

    it(`${name} responds 403 when referer is from an unknown domain`, async () => {
      process.env.ALLOWED_DOMAINS = '';
      const res = createResponse();
      await handler(createRequest({ referer: 'https://evil.example/' }), res);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: 'Access denied' });
    });
  }
});

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
  it('rejects missing ?ip', async () => {
    const res = createResponse();
    await ipcheckIngHandler(createRequest(), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'No IP address provided' });
  });

  it('rejects malformed IP', async () => {
    const res = createResponse();
    await ipcheckIngHandler(createRequest({ query: { ip: '2001:::8888' } }), res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid IP address' });
  });

  it('reports missing API key after IP passes validation', async () => {
    delete process.env.IPCHECKING_API_KEY;
    const res = createResponse();
    await ipcheckIngHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'API key is missing' });
  });
});

// 4 个纯外部 IP 源 handler 共用的参数校验：无 ip / 非法 ip
const ipSourceHandlers = [
  ['ip-sb', ipSbHandler],
  ['ipapi-com', ipapiComHandler],
  ['ipinfo-io', ipinfoIoHandler],
];

describe('external IP-source handlers — parameter validation', () => {
  for (const [name, handler] of ipSourceHandlers) {
    it(`${name} rejects missing ?ip`, async () => {
      const res = createResponse();
      await handler(createRequest(), res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error: 'No IP address provided' });
    });

    it(`${name} rejects malformed ip`, async () => {
      const res = createResponse();
      await handler(createRequest({ query: { ip: '2001:::8888' } }), res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error: 'Invalid IP address' });
    });
  }
});

describe('ipapi-is / ip2location-io handlers — parameter validation', () => {
  // 这两个 handler 在 IP 校验通过后会读取 process.env.*_API_KEY.split(',')，
  // 没配 key 的情况下 .split 会抛 TypeError —— 所以我们只测 IP 预校验路径。
  const handlers = [['ipapi-is', ipapiIsHandler], ['ip2location-io', ip2locationHandler]];

  for (const [name, handler] of handlers) {
    it(`${name} rejects missing ?ip`, async () => {
      const res = createResponse();
      await handler(createRequest(), res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error: 'No IP address provided' });
    });

    it(`${name} rejects malformed ip`, async () => {
      const res = createResponse();
      await handler(createRequest({ query: { ip: '2001:::8888' } }), res);
      assert.equal(res.statusCode, 400);
      assert.deepEqual(res.body, { error: 'Invalid IP address' });
    });
  }
});

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
