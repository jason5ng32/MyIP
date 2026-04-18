import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import configsHandler from '../api/configs.js';
import dnsResolverHandler from '../api/dns-resolver.js';
import googleMapHandler from '../api/google-map.js';
import maxmindHandler from '../api/maxmind.js';
import { refererCheck } from '../common/referer-check.js';

const originalAllowedDomains = process.env.ALLOWED_DOMAINS;

afterEach(() => {
  if (originalAllowedDomains === undefined) {
    delete process.env.ALLOWED_DOMAINS;
    return;
  }

  process.env.ALLOWED_DOMAINS = originalAllowedDomains;
});

function createRequest(options = {}) {
  const method = options.method || 'GET';
  const query = options.query || {};
  const referer = Object.hasOwn(options, 'referer') ? options.referer : 'http://localhost/';
  const headers = {};
  if (referer !== undefined) {
    headers.referer = referer;
  }

  return { method, headers, query };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    sentWith: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.sentWith = 'json';
      return this;
    },
    send(payload) {
      this.body = payload;
      this.sentWith = 'send';
      return this;
    },
  };
}

describe('referer checks', () => {
  it('allows localhost referers', () => {
    assert.equal(refererCheck('http://localhost:18966/'), true);
  });

  it('allows domains configured by ALLOWED_DOMAINS', () => {
    process.env.ALLOWED_DOMAINS = 'example.com';

    assert.equal(refererCheck('https://example.com/tools'), true);
  });

  it('rejects missing and unknown referers', () => {
    process.env.ALLOWED_DOMAINS = '';

    assert.equal(refererCheck(), false);
    assert.equal(refererCheck('https://example.net/'), false);
  });
});

describe('configs API smoke tests', () => {
  it('rejects non-GET requests before reading config state', () => {
    const res = createResponse();

    configsHandler(createRequest({ method: 'POST' }), res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { message: 'Method Not Allowed' });
  });

  // Referer rejection is now enforced by requireReferer middleware
  // (mounted globally on /api in backend-server.js). See tests/guards.test.js.

  it('returns boolean config flags for localhost requests', () => {
    const res = createResponse();

    configsHandler(createRequest(), res);

    assert.equal(res.statusCode, 200);
    for (const key of ['map', 'ipInfo', 'ipChecking', 'ip2location', 'originalSite', 'cloudFlare', 'ipapiis']) {
      assert.equal(typeof res.body[key], 'boolean');
    }
    assert.equal(res.body.originalSite, false);
  });
});

describe('map API smoke tests', () => {
  // Referer rejection moved to requireReferer middleware (see tests/guards.test.js).

  it('rejects invalid map parameters without calling the external map API', () => {
    const res = createResponse();

    googleMapHandler(createRequest({
      query: { latitude: 'not-a-number', longitude: '0', language: 'en' },
    }), res);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { error: 'Invalid request' });
  });
});

describe('MaxMind API smoke tests', () => {
  // Referer rejection moved to requireReferer middleware (see tests/guards.test.js).

  it('rejects missing and invalid IP parameters before database lookup', () => {
    const missingIpResponse = createResponse();
    const invalidIpResponse = createResponse();

    maxmindHandler(createRequest(), missingIpResponse);
    maxmindHandler(createRequest({ query: { ip: '2001:::8888' } }), invalidIpResponse);

    assert.equal(missingIpResponse.statusCode, 400);
    assert.deepEqual(missingIpResponse.body, { error: 'No IP address provided' });
    assert.equal(invalidIpResponse.statusCode, 400);
    assert.deepEqual(invalidIpResponse.body, { error: 'Invalid IP address' });
  });
});

describe('DNS resolver API smoke tests', () => {
  it('rejects non-GET requests before DNS lookup', async () => {
    const res = createResponse();

    await dnsResolverHandler(createRequest({ method: 'POST' }), res);

    assert.equal(res.statusCode, 405);
    assert.deepEqual(res.body, { message: 'Method Not Allowed' });
  });

  // Referer rejection moved to requireReferer middleware (see tests/guards.test.js).

  it('rejects invalid hostnames before DNS lookup', async () => {
    const missingHostnameResponse = createResponse();
    const invalidHostnameResponse = createResponse();

    await dnsResolverHandler(createRequest(), missingHostnameResponse);
    await dnsResolverHandler(createRequest({ query: { hostname: 'localhost', type: 'A' } }), invalidHostnameResponse);

    assert.equal(missingHostnameResponse.statusCode, 400);
    assert.deepEqual(missingHostnameResponse.body, { error: 'Hostname parameter must be a string' });
    assert.equal(invalidHostnameResponse.statusCode, 400);
    assert.deepEqual(invalidHostnameResponse.body, { error: 'Invalid hostname' });
  });
});
