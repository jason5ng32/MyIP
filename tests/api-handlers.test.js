// Smoke coverage for every Express handler under api/.
// Verifies method gating, param-presence checks, param-validity checks,
// and the "API key missing" early-return paths. We never hit the real
// upstream APIs — every assertion is on a branch that returns before
// any fetch fires.
//
// Referer + IP validation are enforced at the middleware layer now (see
// common/guards.js, tests/guards.test.js); handlers themselves no longer
// repeat those checks, so this file focuses on handler-specific branches.

import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, it } from 'node:test';

import configsHandler from '../api/configs.js';
import googleMapHandler from '../api/google-map.js';
import dnsResolverHandler from '../api/dns-resolver.js';
import getUserInfoHandler from '../api/get-user-info.js';
import getWhoisHandler from '../api/get-whois.js';
import cfRadarHandler from '../api/cf-radar.js';
import invisibilityHandler from '../api/invisibility-test.js';
import macCheckerHandler from '../api/mac-checker.js';
import githubStarsHandler from '../api/github-stars.js';
import personaEvaluateHandler from '../api/persona.js';
import updateAchievementHandler from '../api/update-user-achievement.js';
import ipcheckIngHandler from '../api/ipcheck-ing.js';
import { getSessionResult as dnsLeakGetResult } from '../api/dns-leak-test.js';
import ooniBlockingHandler from '../api/ooni-blocking.js';
import globalpingProbesHandler from '../api/globalping-probes.js';
import serviceStatusHandler, {
    detailHandler as serviceStatusDetailHandler,
} from '../api/service-status.js';
import createReportHandler, { getReport as getReportHandler, normalizeTtlDays } from '../api/share-report.js';
import { modifyJsonForIPAPI } from '../api/ipapi-is.js';
import { modifyJson as modifyJsonForIpinfo } from '../api/ipinfo-io.js';
import { REPORT_VERSION } from '../common/report-schema.js';
import logger from '../common/logger.js';

// -- shared test utilities ------------------------------------------------

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

// Back up env keys touched by any test here; restore after each case.
const ENV_KEYS = [
    'IPCHECKING_API_KEY', 'IPCHECKING_API_ENDPOINT',
    'MAC_LOOKUP_API_KEY', 'IPAPIIS_API_KEY',
    'IPINFO_API_KEY', 'IP2LOCATION_API_KEY',
    'CLOUDFLARE_API_KEY',
    'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_KV_NAMESPACE_ID',
    // Pre-rename spellings, still honored as fallbacks.
    'IPINFO_API_TOKEN', 'CLOUDFLARE_API',
];
let envBackup = {};

// Stream tests stub globalThis.fetch; restore the real one after each case.
const originalFetch = globalThis.fetch;

beforeEach(() => {
    envBackup = {};
    for (const k of ENV_KEYS) envBackup[k] = process.env[k];
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const k of ENV_KEYS) {
        if (envBackup[k] === undefined) delete process.env[k];
        else process.env[k] = envBackup[k];
    }
});

// -- configs handler ------------------------------------------------------

describe('configs handler', () => {
    it('rejects non-GET with 405 before reading config state', () => {
        const res = createResponse();
        configsHandler(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        assert.deepEqual(res.body, { message: 'Method Not Allowed' });
    });

    it('returns boolean config flags for localhost requests', () => {
        const res = createResponse();
        configsHandler(createRequest(), res);
        assert.equal(res.statusCode, 200);
        for (const key of ['map', 'ipInfo', 'ipChecking', 'ip2location', 'originalSite', 'cloudFlare', 'ipapiis', 'reportSharing']) {
            assert.equal(typeof res.body[key], 'boolean');
        }
        assert.equal(res.body.originalSite, false);
    });

    it('honors the pre-rename env spellings as fallbacks', () => {
        delete process.env.IPINFO_API_KEY;
        delete process.env.CLOUDFLARE_API_KEY;
        process.env.IPINFO_API_TOKEN = 'legacy-token';
        process.env.CLOUDFLARE_API = 'legacy-key';
        const res = createResponse();
        configsHandler(createRequest(), res);
        assert.equal(res.body.ipInfo, true);
        assert.equal(res.body.cloudFlare, true);
    });
});

// -- google-map handler ---------------------------------------------------

describe('google-map handler', () => {
    // Express-ish streaming response: a real Writable so pipeline() can pipe
    // into it, plus the status/json surface the handler's error paths use.
    const createStreamResponse = () => {
        const chunks = [];
        const res = new Writable({
            write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
        });
        res.locals = {};
        res.chunks = chunks;
        res.jsonCalls = [];
        Object.defineProperty(res, 'headersSent', { get: () => chunks.length > 0 });
        res.setHeader = () => res;
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (payload) => { res.jsonCalls.push(payload); res.body = payload; return res; };
        return res;
    };

    const jpegUpstream = (streamInit) => async () => new Response(
        new ReadableStream(streamInit),
        { headers: { 'content-type': 'image/jpeg' } },
    );

    const mapQuery = { query: { latitude: '1', longitude: '2', language: 'en' } };

    it('rejects invalid map parameters without calling the external API', () => {
        const res = createResponse();
        googleMapHandler(createRequest({
            query: { latitude: 'not-a-number', longitude: '0', language: 'en' },
        }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Invalid request' });
    });

    it('streams the upstream image through to completion', async () => {
        globalThis.fetch = jpegUpstream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('jpeg bytes'));
                controller.close();
            },
        });
        const res = createStreamResponse();
        await googleMapHandler(createRequest(mapQuery), res);
        assert.equal(Buffer.concat(res.chunks).toString(), 'jpeg bytes');
        assert.equal(res.writableFinished, true);
    });

    it('destroys a partial response instead of crashing when the upstream body fails', async () => {
        globalThis.fetch = jpegUpstream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('partial'));
                setImmediate(() => controller.error(new Error('upstream reset')));
            },
        });
        const res = createStreamResponse();
        // Resolving without an unhandled 'error' event is the crash regression.
        await googleMapHandler(createRequest(mapQuery), res);
        assert.equal(res.destroyed, true);
        assert.equal(res.jsonCalls.length, 0);
    });

    it('cancels the upstream body silently when the client disconnects', async () => {
        let bodyCancelled = false;
        globalThis.fetch = jpegUpstream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode('partial'));
            },
            cancel() { bodyCancelled = true; },
        });
        const errorCalls = [];
        const originalError = logger.error;
        logger.error = (...args) => { errorCalls.push(args); };
        try {
            const res = createStreamResponse();
            const handlerPromise = googleMapHandler(createRequest(mapQuery), res);
            await new Promise((resolve) => setImmediate(resolve));
            res.destroy();
            await handlerPromise;
            await new Promise((resolve) => setImmediate(resolve));
            assert.equal(bodyCancelled, true);
            assert.equal(res.jsonCalls.length, 0);
            assert.equal(errorCalls.length, 0);
        } finally {
            logger.error = originalError;
        }
    });

    it('returns 500 JSON when the upstream fetch itself rejects', async () => {
        globalThis.fetch = async () => { throw new Error('connect timeout'); };
        const res = createStreamResponse();
        await googleMapHandler(createRequest(mapQuery), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'connect timeout' });
    });
});

// -- dns-resolver handler -------------------------------------------------

describe('dns-resolver handler', () => {
    it('rejects non-GET with 405 before DNS lookup', async () => {
        const res = createResponse();
        await dnsResolverHandler(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        assert.deepEqual(res.body, { message: 'Method Not Allowed' });
    });
});

// -- get-whois handler ----------------------------------------------------

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

    for (const ip of ['10.92.24.150', '192.168.1.1', '198.18.0.2', 'fd00::1', '::1']) {
        it(`rejects the non-public address ${ip} before any lookup`, async () => {
            const res = createResponse();
            await getWhoisHandler(createRequest({ query: { q: ip } }), res);
            assert.equal(res.statusCode, 400);
            assert.deepEqual(res.body, { error: 'Not a public IP address' });
        });
    }
});

// -- github-stars handler -------------------------------------------------

describe('github-stars handler', () => {
    it('rejects non-GET with 405 before hitting GitHub', async () => {
        const res = createResponse();
        await githubStarsHandler(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        assert.deepEqual(res.body, { message: 'Method Not Allowed' });
    });
});

// -- persona handler (thin proxy) -----------------------------------------

describe('persona handler', () => {
    it('rejects non-POST with 405', async () => {
        const res = createResponse();
        await personaEvaluateHandler(createRequest({ method: 'GET' }), res);
        assert.equal(res.statusCode, 405);
        assert.deepEqual(res.body, { error: 'Method Not Allowed' });
    });

    it('reports the missing API key rather than calling out', async () => {
        delete process.env.IPCHECKING_API_KEY;
        const res = createResponse();
        await personaEvaluateHandler(createRequest({ method: 'POST', body: {} }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('rejects a call carrying no persona', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        const res = createResponse();
        await personaEvaluateHandler(createRequest({ method: 'POST', body: { observation: {} } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No persona provided' });
    });

    it('passes the upstream status and payload back verbatim', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        let requested;
        globalThis.fetch = async (url, options) => {
            requested = { url: String(url), options };
            return {
                status: 200,
                ok: true,
                json: async () => ({ grade: 'B', results: [] }),
            };
        };

        const req = createRequest({ method: 'POST', body: { persona: { country: 'JP' } } });
        req.headers['accept-language'] = 'ja-JP,ja;q=0.9';
        // Framing headers describe this hop; the body is re-serialized here, so
        // forwarding them would announce a length that no longer matches.
        req.headers['content-length'] = '999';
        req.headers.host = 'ipcheck.ing';
        req.headers['content-type'] = 'application/json';
        const res = createResponse();
        await personaEvaluateHandler(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.grade, 'B');
        // The visitor's own Accept-Language is one of the things being checked,
        // so it has to reach the evaluator untouched.
        assert.equal(requested.options.headers['accept-language'], 'ja-JP,ja;q=0.9');
        assert.equal('content-length' in requested.options.headers, false);
        assert.equal('host' in requested.options.headers, false);
        // Exactly one content-type reaches the upstream: two would arrive as
        // "application/json, application/json" and be refused with 415.
        assert.equal(requested.options.headers['Content-Type'], 'application/json');
        assert.equal('content-type' in requested.options.headers, false);
        assert.match(requested.url, /\/persona\/evaluate\?key=test-key$/);
    });

    it('answers 502 when the evaluator cannot be reached', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        globalThis.fetch = async () => { throw new Error('network down'); };
        const res = createResponse();
        await personaEvaluateHandler(
            createRequest({ method: 'POST', body: { persona: { country: 'JP' } } }), res);
        assert.equal(res.statusCode, 502);
        assert.deepEqual(res.body, { error: 'Upstream fetch failed' });
    });
});

// -- cf-radar handler -----------------------------------------------------
// One dispatch route for all Radar views; params are validated by each
// view's guards from common/guards.js, so per-view checks here only cover
// the dispatch wiring. The pure transform pipeline (outage normalize/merge,
// traffic matrix) is unit-tested in tests/cf-radar.test.js.

describe('cf-radar handler', () => {
    it('rejects non-GET methods', async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ method: 'POST', query: { view: 'outages' } }), res);
        assert.equal(res.statusCode, 405);
    });

    it('rejects missing ?view', async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest(), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No view provided' });
    });

    it('rejects an unknown ?view', async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'nope' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Invalid view' });
    });

    it("runs the asn view's guard: missing ?asn", async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'asn' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No ASN provided' });
    });

    it("runs the asn view's guard: non-numeric ASN", async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'asn', asn: 'not-an-asn' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Invalid ASN' });
    });

    it("runs the country-traffic view's guard: missing ?country", async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'country-traffic' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No country provided' });
    });

    it('returns 500 when no Cloudflare API key is configured', async () => {
        delete process.env.CLOUDFLARE_API_KEY;
        delete process.env.CLOUDFLARE_API;
        const res = createResponse();
        // 'AS15169' also pins the guard's normalization: the AS prefix is
        // now accepted (stripped in place), so the request passes validation
        // and stops at the key check — before any upstream call.
        await cfRadarHandler(createRequest({ query: { view: 'asn', asn: 'AS15169' } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });
});

// -- invisibility-test handler --------------------------------------------

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
        await invisibilityHandler(createRequest({ query: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa----' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Invalid ID' });
    });

    it('reports missing API key after param validation passes', async () => {
        delete process.env.IPCHECKING_API_KEY;
        const res = createResponse();
        await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('passes an upstream auth rejection through as its own 4xx, not a 500', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        globalThis.fetch = async () => ({
            status: 403,
            ok: false,
            json: async () => ({ message: 'Authorization header is missing.' }),
        });
        const res = createResponse();
        await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { error: 'Authorization header is missing.' });
    });
});

// -- mac-checker handler --------------------------------------------------

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

// -- update-user-achievement handler --------------------------------------

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

// -- get-user-info handler ------------------------------------------------

describe('get-user-info handler', () => {
    it('reports missing API key before fetch', async () => {
        delete process.env.IPCHECKING_API_KEY;
        const res = createResponse();
        await getUserInfoHandler(createRequest(), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });
});

// -- dns-leak-test handler ------------------------------------------------

describe('dns-leak-test getSessionResult', () => {
    it('rejects non-GET with 405', async () => {
        const res = createResponse();
        await dnsLeakGetResult({ method: 'POST', headers: {}, query: {}, params: {} }, res);
        assert.equal(res.statusCode, 405);
        assert.deepEqual(res.body, { error: 'Method Not Allowed' });
    });

    it('rejects missing / malformed token before calling upstream', async () => {
        const missing = createResponse();
        await dnsLeakGetResult({ method: 'GET', headers: {}, query: {}, params: {} }, missing);
        assert.equal(missing.statusCode, 400);
        assert.deepEqual(missing.body, { error: 'Invalid token' });

        const tooShort = createResponse();
        await dnsLeakGetResult({ method: 'GET', headers: {}, query: {}, params: { token: 'abc' } }, tooShort);
        assert.equal(tooShort.statusCode, 400);
        assert.deepEqual(tooShort.body, { error: 'Invalid token' });

        const notHex = createResponse();
        await dnsLeakGetResult({
            method: 'GET', headers: {}, query: {}, params: { token: 'G'.repeat(32) },
        }, notHex);
        assert.equal(notHex.statusCode, 400);
        assert.deepEqual(notHex.body, { error: 'Invalid token' });
    });

    it('reports missing API key after token passes validation', async () => {
        delete process.env.IPCHECKING_API_KEY;
        delete process.env.IPCHECKING_API_ENDPOINT;
        const res = createResponse();
        await dnsLeakGetResult({
            method: 'GET', headers: {}, query: {},
            params: { token: 'a'.repeat(32) },
            set() { return this; },
        }, res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    // ?lang is a pass-through: the upstream owns tag resolution, so the handler
    // neither validates nor substitutes a default.
    describe('lang forwarding', () => {
        const callWithLang = async (query) => {
            process.env.IPCHECKING_API_KEY = 'test-key';
            process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
            let requested;
            globalThis.fetch = async (url) => {
                requested = new URL(String(url));
                return { status: 200, ok: true, json: async () => ({}) };
            };
            // The success path sets a Cache-Control header on the way out.
            const res = createResponse();
            res.set = () => res;
            await dnsLeakGetResult({
                method: 'GET', headers: {}, query,
                params: { token: 'a'.repeat(32) },
            }, res);
            assert.equal(res.statusCode, 200);
            return requested;
        };

        it('forwards the caller tag verbatim, family variants included', async () => {
            for (const lang of ['zh-TW', 'ja', 'pt-PT', 'tr']) {
                const url = await callWithLang({ lang });
                assert.equal(url.searchParams.get('lang'), lang);
            }
        });

        it('sends no lang at all when the caller omits it', async () => {
            const url = await callWithLang({});
            assert.equal(url.searchParams.has('lang'), false);
            // The apikey still rides along — proof the request was built, not skipped.
            assert.equal(url.searchParams.get('apikey'), 'test-key');
        });

        it('drops a non-string lang rather than stringifying it', async () => {
            // Express turns a repeated ?lang= into an array; "a,b" is not a tag.
            const url = await callWithLang({ lang: ['zh-CN', 'en'] });
            assert.equal(url.searchParams.has('lang'), false);
        });
    });
});

// -- ipcheck-ing handler --------------------------------------------------

describe('ipcheck-ing handler', () => {
    it('reports missing API key after IP passes validation', async () => {
        delete process.env.IPCHECKING_API_KEY;
        const res = createResponse();
        await ipcheckIngHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });
});

// -- ipinfo-io normalizer -------------------------------------------------
// Pure transform, no fetch involved.

describe('ipinfo-io normalize', () => {
    const CANONICAL_KEYS = [
        'ip', 'city', 'region', 'country', 'country_name', 'country_code',
        'latitude', 'longitude', 'asn', 'org',
    ];

    it('maps a fully populated upstream payload', () => {
        const out = modifyJsonForIpinfo({
            ip: '8.8.8.8',
            city: 'Mountain View',
            region: 'California',
            country: 'US',
            loc: '37.4056,-122.0775',
            org: 'AS15169 Google LLC',
        });
        assert.equal(out.country_name, 'United States');
        assert.equal(out.country_code, 'US');
        assert.equal(out.latitude, 37.4056);
        assert.equal(out.longitude, -122.0775);
        assert.equal(out.asn, 'AS15169');
        assert.equal(out.org, 'Google LLC');
    });

    it('degrades coordinates to null when the upstream omits loc', () => {
        // Anycast ranges answer 200 without loc.
        const out = modifyJsonForIpinfo({
            ip: '104.28.212.153', city: 'Los Angeles', country: 'US', org: 'AS13335 Cloudflare, Inc.',
        });
        assert.equal(out.latitude, null);
        assert.equal(out.longitude, null);
        assert.equal(out.asn, 'AS13335');
    });

    it('degrades a partial or non-numeric loc to null', () => {
        assert.equal(modifyJsonForIpinfo({ loc: '37.4056' }).longitude, null);
        assert.equal(modifyJsonForIpinfo({ loc: '' }).latitude, null);
        assert.equal(modifyJsonForIpinfo({ loc: 'unknown,unknown' }).latitude, null);
        assert.equal(modifyJsonForIpinfo({ loc: ',-122.0775' }).latitude, null);
        // 0 is a real coordinate, not a blank one.
        assert.equal(modifyJsonForIpinfo({ loc: '0,0' }).latitude, 0);
    });

    it('empties asn / org when the upstream omits org', () => {
        const out = modifyJsonForIpinfo({ ip: '8.8.8.8', country: 'US', loc: '37.4,-122.0' });
        assert.equal(out.asn, '');
        assert.equal(out.org, '');
    });

    it('falls back to Unknown Country for an absent or unlisted code', () => {
        assert.equal(modifyJsonForIpinfo({}).country_name, 'Unknown Country');
        assert.equal(modifyJsonForIpinfo({ country: 'XX' }).country_name, 'Unknown Country');
    });

    it('survives a bogon payload and still emits the canonical shape', () => {
        // ipinfo.io answers {"ip":…,"bogon":true} — no loc, org or country.
        const out = modifyJsonForIpinfo({ ip: '192.0.2.1', bogon: true });
        assert.equal(out.ip, '192.0.2.1');
        for (const key of CANONICAL_KEYS) {
            assert.ok(key in out, `${key} must stay present in the response`);
        }
    });

    it('survives an empty or null upstream body', () => {
        for (const payload of [{}, null, undefined]) {
            const out = modifyJsonForIpinfo(payload);
            for (const key of CANONICAL_KEYS) {
                assert.ok(key in out, `${key} must stay present in the response`);
            }
        }
    });
});

// -- ipapi-is normalizer --------------------------------------------------
// Pure transform, no fetch involved.

describe('ipapi-is normalize', () => {
    it('maps a fully populated upstream payload', () => {
        const out = modifyJsonForIPAPI({
            ip: '8.8.8.8',
            location: {
                city: 'Mountain View', state: 'California', country: 'United States',
                country_code: 'US', latitude: 37.4, longitude: -122.07,
            },
            asn: { asn: 15169, org: 'Google LLC' },
            is_datacenter: true,
        });
        assert.equal(out.city, 'Mountain View');
        assert.equal(out.country_code, 'US');
        assert.equal(out.asn, 'AS15169');
        assert.equal(out.isHosting, true);
        assert.equal(out.isProxy, false);
    });

    it('falls back to N/A when the upstream places no location', () => {
        // Anycast / bogon addresses come back 200 with location: null.
        const out = modifyJsonForIPAPI({ ip: '104.28.212.153', location: null });
        assert.equal(out.ip, '104.28.212.153');
        for (const key of ['city', 'region', 'country', 'country_name', 'country_code', 'latitude', 'longitude']) {
            assert.equal(out[key], 'N/A', `${key} should degrade to N/A`);
        }
        assert.equal(out.asn, 'N/A');
        assert.equal(out.isHosting, false);
        assert.equal(out.isProxy, false);
    });

    it('flags a proxy when any of the vpn / tor / proxy bits is set', () => {
        assert.equal(modifyJsonForIPAPI({ location: {}, is_vpn: true }).isProxy, true);
        assert.equal(modifyJsonForIPAPI({ location: {}, is_tor: true }).isProxy, true);
    });
});

// -- service-status handlers ----------------------------------------------

describe('service-status overview handler', () => {
    it('serves the in-memory overview shape without any upstream call', async () => {
        const res = createResponse();
        await serviceStatusHandler(createRequest(), res);
        // Before the poller's first tick the snapshot is empty, but the shape
        // ({ updatedAt, providers[] }) is always present — and nothing was fetched.
        assert.equal(res.statusCode, 200);
        assert.ok(Array.isArray(res.body.providers), 'providers must be an array');
        assert.ok('updatedAt' in res.body, 'overview must carry updatedAt');
    });
});

describe('service-status detail handler', () => {
    it('rejects non-GET with 405', async () => {
        const res = createResponse();
        await serviceStatusDetailHandler(createRequest({ method: 'POST', query: { id: 'claude' } }), res);
        assert.equal(res.statusCode, 405);
    });

    it('serves components + incidents arrays (empty until the poller fills the snapshot)', async () => {
        const res = createResponse();
        await serviceStatusDetailHandler(createRequest({ query: { id: 'claude' } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.id, 'claude');
        assert.ok(Array.isArray(res.body.components));
        assert.ok(Array.isArray(res.body.incidents));
    });
});

// -- share-report (POST /api/report + GET /api/report/:id) -----------------
// Everything asserted here returns before the first fetchUpstream (KV is
// never hit).

describe('share-report handlers', () => {
    const kvEnv = () => {
        process.env.CLOUDFLARE_API_KEY = 'test-key';
        process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
        process.env.CLOUDFLARE_KV_NAMESPACE_ID = 'test-namespace';
    };
    const noKvEnv = () => {
        delete process.env.CLOUDFLARE_API_KEY;
        delete process.env.CLOUDFLARE_API;
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
        delete process.env.CLOUDFLARE_KV_NAMESPACE_ID;
    };

    const createReq = (body, method = 'POST') => createRequest({ method, body });

    const validReport = () => ({
        v: REPORT_VERSION,
        generatedAt: '2026-07-14T08:00:00.000Z',
        origin: 'ipcheck.ing',
        locale: 'zh',
        sections: {
            ruletest: {
                testedAt: '2026-07-14T08:00:00.000Z',
                uniqueIPCount: 1,
                workers: [{ id: 1, ip: '1.2.3.4', countryCode: 'US', org: 'CF' }],
            },
        },
    });

    it('POST rejects non-POST with 405', async () => {
        const res = createResponse();
        await createReportHandler(createReq(undefined, 'GET'), res);
        assert.equal(res.statusCode, 405);
    });

    it('POST returns 503 when KV env is not configured', async () => {
        noKvEnv();
        const res = createResponse();
        await createReportHandler(createReq({ report: validReport(), ttlDays: 7 }), res);
        assert.equal(res.statusCode, 503);
    });

    it('forces a tampered ttlDays down to 1 day, keeps whitelisted values', () => {
        for (const ttlDays of [0, 2, 30, 365, -1, '7', null, undefined]) {
            assert.equal(normalizeTtlDays(ttlDays), 1, `ttlDays=${ttlDays} should coerce to 1`);
        }
        for (const ttlDays of [1, 3, 7]) {
            assert.equal(normalizeTtlDays(ttlDays), ttlDays);
        }
    });

    it('POST rejects an invalid report with the validator details', async () => {
        kvEnv();
        const res = createResponse();
        await createReportHandler(createReq({ report: { v: REPORT_VERSION, smuggled: 'x' }, ttlDays: 7 }), res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, 'Invalid report');
        assert.ok(Array.isArray(res.body.details));
    });

    it('POST rejects a schema-valid but oversized report with 413', async () => {
        kvEnv();
        const report = validReport();
        // Inflate within schema caps: 32 mtr probes × 64 hops with long
        // hostnames ≈ 300KB+ serialized ≫ REPORT_MAX_BYTES (256KB).
        report.sections.mtrtest = {
            testedAt: '2026-07-14T08:00:00.000Z',
            target: '8.8.8.8',
            probes: Array.from({ length: 32 }, () => ({
                countryCode: 'US',
                network: 'n'.repeat(120),
                hops: Array.from({ length: 64 }, (_, i) => ({
                    n: i + 1, host: 'h'.repeat(120), lossPct: 0, avgMs: 1.5,
                })),
            })),
        };
        const res = createResponse();
        await createReportHandler(createReq({ report, ttlDays: 7 }), res);
        assert.equal(res.statusCode, 413);
    });

    it('GET rejects non-GET with 405', async () => {
        const res = createResponse();
        const req = createReq(undefined, 'POST');
        req.params = { id: 'a'.repeat(22) };
        await getReportHandler(req, res);
        assert.equal(res.statusCode, 405);
    });

    it('GET returns 503 when KV env is not configured', async () => {
        noKvEnv();
        const res = createResponse();
        const req = createReq(undefined, 'GET');
        req.params = { id: 'a'.repeat(22) };
        await getReportHandler(req, res);
        assert.equal(res.statusCode, 503);
    });
});

// -- ooni-blocking handler -------------------------------------------------
// Domain presence/shape is enforced by requireValidDomain middleware
// (tests/guards.test.js); the handler's only pre-fetch branch is the
// defensive method gate.

describe('ooni-blocking handler', () => {
    it('rejects non-GET with 405 before hitting OONI', async () => {
        const res = createResponse();
        await ooniBlockingHandler(createRequest({ method: 'POST', query: { domain: 'example.com' } }), res);
        assert.equal(res.statusCode, 405);
        assert.equal(res.body.error, 'Method Not Allowed');
    });
});

// -- globalping-probes handler ----------------------------------------------
// No params to validate; the only pre-fetch branch is the method gate.

describe('globalping-probes handler', () => {
    it('rejects non-GET with 405 before hitting Globalping', async () => {
        const res = createResponse();
        await globalpingProbesHandler(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        assert.equal(res.body.error, 'Method Not Allowed');
    });
});
