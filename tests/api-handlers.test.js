// Smoke coverage for every Express handler under api/.
// Verifies method gating, param-presence checks, param-validity checks,
// and the "API key missing" early-return paths. We never hit the real
// upstream APIs — every assertion is on a branch that returns before
// any fetch fires.
//
// Referer + IP validation are enforced at the middleware layer now (see
// server/guards.js, tests/guards.test.js); handlers themselves no longer
// repeat those checks, so this file focuses on handler-specific branches.

import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import fs from 'node:fs';
import { Resolver } from 'node:dns/promises';
import { afterEach, beforeEach, describe, it } from 'node:test';

import configsHandler from '../api/configs.js';
import googleMapHandler from '../api/google-map.js';
import dnsResolverHandler from '../api/dns-resolver.js';
import usageHandler from '../api/usage.js';
import getWhoisHandler from '../api/get-whois.js';
import cfRadarHandler from '../api/cf-radar.js';
import invisibilityHandler from '../api/invisibility-test.js';
import ipBlocklistHandler, { IP_BLOCKLIST_TIMEOUT_MS } from '../api/ip-blocklist.js';
import macCheckerHandler, { createMacChecker } from '../api/mac-checker.js';
import githubStarsHandler from '../api/github-stars.js';
import personaEvaluateHandler from '../api/persona.js';
import asnProfileHandler, { peeringdbReadiness, connectivityReadiness } from '../api/asn-profile.js';
import { isAsRelLoaded } from '../server/datasets/as-rel-db.js';
import { describeMac } from '../server/datasets/oui-db.js';
import { isCompleteProfile } from '../server/asn-profile.js';
import { createAchievementHandlers } from '../api/achievements.js';
import { createSyncHandlers } from '../api/sync.js';
import { createSyncSettingsHandlers } from '../api/sync-settings.js';
import { SYNC_COLLECTIONS, SYNC_OFF_CODE } from '../common/sync-collections.js';
import { sanitizeLists } from '../frontend/utils/features/connectivity-lists.js';
import { requireUser, requireUserStorage, requireValidSyncCollection } from '../server/guards.js';
import { AUTH_REASON } from '../common/codes/service-errors.js';
import { FEATURE_USES, recordFeatureUse } from '../server/db/feature-uses.js';
import { fakeUserDb, fakeStorage } from './fake-user-db.js';
import ipcheckIngHandler from '../api/ipcheck-ing.js';
import { createBulkLookup } from '../api/bulk-lookup.js';
import { BULK_LOOKUP_MAX_IPS } from '../common/bulk-lookup-limits.js';
import { resolveBulkLookupSource, DEFAULT_BULK_LOOKUP_SOURCE } from '../server/bulk-lookup-sources.js';
import { getSessionResult as dnsLeakGetResult } from '../api/dns-leak-test.js';
import ooniBlockingHandler from '../api/ooni-blocking.js';
import globalpingProbesHandler from '../api/globalping-probes.js';
import serviceStatusHandler, {
    detailHandler as serviceStatusDetailHandler,
} from '../api/service-status.js';
import createReportHandler, { getReport as getReportHandler, normalizeTtlDays } from '../api/share-report.js';
import { modifyJsonForIPAPI } from '../api/ipapi-is.js';
import { modifyJsonForIPSB } from '../api/ip-sb.js';
import { modifyJson as modifyJsonForIpinfoio } from '../api/ipinfo-io.js';
import { REPORT_VERSION } from '../common/report-schema.js';
import logger from '../server/logger.js';

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

// Visitor headers: the listed ones reach the IPCheck.ing API, the rest
// (plus createRequest's referer) never do.
const FORWARDED_VISITOR_HEADERS = {
    'accept-language': 'de-DE',
    'user-agent': 'VisitorBrowser/1.0',
    'cf-connecting-ip': '203.0.113.7',
    'x-forwarded-for': '203.0.113.7',
};
const DROPPED_VISITOR_HEADERS = {
    authorization: 'Bearer t',
    host: 'myip.example', cookie: 'session=1', origin: 'https://myip.example',
    'content-length': '999', 'content-type': 'application/json',
};

const withVisitorHeaders = (req) => {
    Object.assign(req.headers, FORWARDED_VISITOR_HEADERS, DROPPED_VISITOR_HEADERS);
    return req;
};

// The exact header set sent upstream: the listed visitor headers plus `extra`.
const assertForwardedHeaders = (headers, extra = {}) => {
    assert.deepEqual(headers, { ...FORWARDED_VISITOR_HEADERS, ...extra });
    for (const name of ['host', 'cookie', 'referer', 'content-length', 'authorization']) assert.equal(name in headers, false, name);
};

// The user id the sign-in guards put on res.locals, and the header carrying it.
const USER_ID = 'user-123';
const END_USER = { 'x-end-user-id': USER_ID };
const signedIn = (res) => {
    res.locals.userId = USER_ID;
    return res;
};

// IPCheck.ing API failure bodies as it sends them, and the coded bodies the
// tool routes answer with.
const UPSTREAM_SIGN_IN_REQUIRED = { error: 'Sign in required', message: 'Authorization header is missing.', code: 'sign_in_required' };
const UPSTREAM_INVALID_TOKEN = { error: 'Invalid token', message: 'Firebase ID token has expired.', code: 'invalid_token' };
const UPSTREAM_QUOTA = { error: 'Monthly quota exceeded', code: 'quota_exceeded' };
const UPSTREAM_SERVICE_LIMIT = { error: 'Service limit reached', code: 'service_limit' };
const CODED_SIGN_IN_REQUIRED = { error: 'Sign in required', code: 'auth', reason: 'sign_in_required' };
const CODED_INVALID_TOKEN = { error: 'Invalid token', code: 'auth', reason: 'invalid_token' };
const CODED_QUOTA = { error: 'Monthly quota exceeded', code: 'quota' };
const upstreamAnswer = (status, body) => async () => new Response(JSON.stringify(body), { status });

function createResponse() {
    return {
        statusCode: 200,
        body: undefined,
        locals: {},
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        send(payload) { this.body = payload; return this; },
    };
}

// Back up env keys touched by any test here; restore after each case.
const ENV_KEYS = [
    'IPCHECKING_API_KEY', 'IPCHECKING_API_ENDPOINT',
    'IPAPIIS_API_KEY',
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

    it('returns exactly the boolean config flags plus the bulk lookup source', () => {
        const res = createResponse();
        configsHandler(createRequest(), res);
        assert.equal(res.statusCode, 200);
        const flags = ['map', 'ipinfoio', 'ipChecking', 'ip2locationio', 'cloudFlare', 'ipapiis', 'reportSharing', 'userStorage'];
        for (const key of flags) {
            assert.equal(typeof res.body[key], 'boolean');
        }
        assert.deepEqual(Object.keys(res.body).sort(), [...flags, 'bulkLookupSource'].sort());
    });

    it('names the bulk lookup source as a string', () => {
        const res = createResponse();
        configsHandler(createRequest(), res);
        assert.equal(res.body.bulkLookupSource, 'maxmind');
    });

    it('ipChecking needs both the API key and the endpoint', () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        delete process.env.IPCHECKING_API_ENDPOINT;
        const keyOnly = createResponse();
        configsHandler(createRequest(), keyOnly);
        assert.equal(keyOnly.body.ipChecking, false);

        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        const both = createResponse();
        configsHandler(createRequest(), both);
        assert.equal(both.body.ipChecking, true);
    });

    it('honors the pre-rename env spellings as fallbacks', () => {
        delete process.env.IPINFO_API_KEY;
        delete process.env.CLOUDFLARE_API_KEY;
        process.env.IPINFO_API_TOKEN = 'legacy-token';
        process.env.CLOUDFLARE_API = 'legacy-key';
        const res = createResponse();
        configsHandler(createRequest(), res);
        assert.equal(res.body.ipinfoio, true);
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

    it('passes region-tagged UI locales through to Static Maps', async () => {
        for (const language of ['zh-TW', 'pt-BR']) {
            let upstreamUrl;
            globalThis.fetch = async (url) => {
                upstreamUrl = new URL(String(url));
                return jpegUpstream({ start(controller) { controller.close(); } })();
            };
            const res = createStreamResponse();
            await googleMapHandler(createRequest({
                query: { latitude: '1', longitude: '2', language },
            }), res);
            assert.equal(res.statusCode, undefined);
            assert.deepEqual(upstreamUrl.searchParams.getAll('language'), [language]);
        }
    });

    it('rejects a language that is not tag-shaped without calling the external API', () => {
        let fetchCalled = false;
        globalThis.fetch = async () => { fetchCalled = true; };
        for (const language of ['', 'en&zoom=20', 'en-', 'x'.repeat(40), ['en', 'fr'], undefined]) {
            const res = createResponse();
            googleMapHandler(createRequest({
                query: { latitude: '1', longitude: '2', language },
            }), res);
            assert.equal(res.statusCode, 400, `language=${JSON.stringify(language)}`);
        }
        assert.equal(fetchCalled, false);
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

    it('carries each row\'s status, and the failure code on N/A rows', async (t) => {
        t.mock.method(Resolver.prototype, 'resolve4', async () => {
            throw Object.assign(new Error('servfail'), { code: 'ESERVFAIL' });
        });
        globalThis.fetch = async () => new Response(JSON.stringify({
            Status: 0, Answer: [{ type: 1, data: '192.0.2.1' }],
        }), { status: 200 });
        const res = createResponse();
        await dnsResolverHandler(createRequest({ query: { hostname: 'example.test', type: 'A' } }), res);
        assert.equal(res.statusCode, 200);
        const udp = res.body.results.find((row) => row.type === 'udp');
        const doh = res.body.results.find((row) => row.type === 'doh');
        assert.deepEqual(
            { result: udp.result, status: udp.status, code: udp.code },
            { result: 'N/A', status: 'servfail', code: 'SERVFAIL' },
        );
        assert.deepEqual({ result: doh.result, status: doh.status }, { result: ['192.0.2.1'], status: 'ok' });
        assert.equal('code' in doh, false);
        for (const key of ['id', 'provider', 'country']) assert.ok(udp[key] && doh[key], key);
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

    // ASN path (query already canonicalized to AS<n> by normalizeAsnQuery).
    // The first case fetches IANA's asn.json bootstrap through the stub; the
    // module caches it for the rest of the file.
    const ASN_BOOTSTRAP = { services: [[['13335', '64496-64511'], ['https://rdap.arin.net/registry/']]] };
    const stubAutnum = (autnum) => async (url) => (new URL(String(url)).hostname === 'data.iana.org'
        ? new Response(JSON.stringify(ASN_BOOTSTRAP))
        : autnum(String(url)));

    it('answers an ASN query with parsed RDAP autnum fields plus __raw', async () => {
        const urls = [];
        globalThis.fetch = stubAutnum((url) => {
            urls.push(url);
            return new Response(JSON.stringify({
                handle: 'AS13335', startAutnum: 13335, endAutnum: 13335, name: 'CLOUDFLARENET',
                status: ['active'],
                events: [{ eventAction: 'registration', eventDate: '2010-07-14T18:35:57-04:00' }],
            }));
        });
        const res = createResponse();
        await getWhoisHandler(createRequest({ query: { q: 'AS13335' } }), res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(urls, ['https://rdap.arin.net/registry/autnum/13335']);
        assert.equal(res.body.asn, 13335);
        assert.equal(res.body.name, 'CLOUDFLARENET');
        assert.equal(res.body.rir, 'ARIN');
        assert.equal(res.body.registered, '2010-07-14T18:35:57-04:00');
        assert.match(res.body.__raw, /^ASNumber: 13335\nASName: CLOUDFLARENET/);
    });

    it('answers 404 for an ASN the registry does not know', async () => {
        globalThis.fetch = stubAutnum(() => new Response('', { status: 404 }));
        const res = createResponse();
        await getWhoisHandler(createRequest({ query: { q: 'AS64500' } }), res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { error: 'ASN not found: AS64500' });
    });

    it('answers 404 for an ASN outside every registry range', async () => {
        globalThis.fetch = stubAutnum(() => { throw new Error('unexpected autnum call'); });
        const res = createResponse();
        await getWhoisHandler(createRequest({ query: { q: 'AS64512' } }), res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { error: 'No RDAP endpoint for AS64512' });
    });

    // normalizeAsnQuery passes a bare number through untouched (the `AS`
    // prefix is required), so the handler sees it raw and rejects it.
    for (const q of ['13335', '0', '99999999999']) {
        it(`rejects the bare number ${q} as neither IP nor domain, before any lookup`, async () => {
            globalThis.fetch = async () => { throw new Error('unexpected upstream call'); };
            const res = createResponse();
            await getWhoisHandler(createRequest({ query: { q } }), res);
            assert.equal(res.statusCode, 400);
            assert.deepEqual(res.body, { error: 'Invalid IP or address' });
        });
    }

    it('answers 500 when the registry fails', async () => {
        globalThis.fetch = stubAutnum(() => new Response('busy', { status: 503 }));
        const originalError = logger.error;
        logger.error = () => {};
        try {
            const res = createResponse();
            await getWhoisHandler(createRequest({ query: { q: 'AS13335' } }), res);
            assert.equal(res.statusCode, 500);
            assert.deepEqual(res.body, { error: 'RDAP autnum query failed: 503' });
        } finally {
            logger.error = originalError;
        }
    });
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

        const req = withVisitorHeaders(createRequest({ method: 'POST', body: { persona: { country: 'JP' } } }));
        const res = signedIn(createResponse());
        await personaEvaluateHandler(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.grade, 'B');
        // The visitor's own Accept-Language is one of the things being checked,
        // so it has to reach the evaluator untouched. The body is re-serialized
        // here: exactly one content-type goes along (two would arrive as
        // "application/json, application/json" and be refused with 415), and
        // no content-length.
        assertForwardedHeaders(requested.options.headers, { 'content-type': 'application/json', ...END_USER });
        assert.equal(requested.options.body, JSON.stringify({ persona: { country: 'JP' } }));
        assert.match(requested.url, /\/persona\/evaluate\?key=test-key$/);
    });

    it('answers an upstream failure with its status and the coded body', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        for (const [status, upstream, coded] of [
            [403, UPSTREAM_SIGN_IN_REQUIRED, CODED_SIGN_IN_REQUIRED],
            [403, UPSTREAM_INVALID_TOKEN, CODED_INVALID_TOKEN],
            [429, UPSTREAM_QUOTA, CODED_QUOTA],
            [429, UPSTREAM_SERVICE_LIMIT, { error: 'Service limit reached' }],
            [400, { error: 'Invalid country' }, { error: 'Invalid country' }],
        ]) {
            globalThis.fetch = upstreamAnswer(status, upstream);
            const res = createResponse();
            await personaEvaluateHandler(
                createRequest({ method: 'POST', body: { persona: { country: 'JP' } } }), res);
            assert.equal(res.statusCode, status);
            assert.deepEqual(res.body, coded);
        }
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
// view's guards from server/guards.js, so per-view checks here only cover
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

    for (const asn of ['AS0', '0', '4294967296', '00000000013335']) {
        it(`runs the asn view's guard: out-of-range or overlong ASN ${asn}`, async () => {
            const res = createResponse();
            await cfRadarHandler(createRequest({ query: { view: 'asn', asn } }), res);
            assert.equal(res.statusCode, 400);
            assert.deepEqual(res.body, { error: 'Invalid ASN' });
        });
    }

    it("runs the bgp-prefixes view's guard: non-numeric ASN", async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'bgp-prefixes', asn: 'nope' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'Invalid ASN' });
    });

    it('serves bgp-prefixes from pfx2as with a countries list', async () => {
        process.env.CLOUDFLARE_API_KEY = 'test-key';
        const urls = [];
        globalThis.fetch = async (url) => {
            urls.push(String(url));
            return new Response(JSON.stringify({ result: { prefix_origins: [
                { origin: 13335, peer_count: 76, prefix: '104.22.21.0/24', rpki_validation: 'Valid' },
            ] } }));
        };
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'bgp-prefixes', asn: 'AS13335' } }), res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(urls, ['https://api.cloudflare.com/client/v4/radar/bgp/routes/pfx2as?origin=13335']);
        assert.deepEqual(res.body.prefixes, [{ prefix: '104.22.21.0/24', rpki: 'Valid', peers: 76 }]);
        // No MaxMind database is loaded in tests — countries degrade to [].
        assert.deepEqual(res.body.countries, []);
    });

    it('answers 500, not an empty list, when pfx2as lacks prefix_origins', async () => {
        process.env.CLOUDFLARE_API_KEY = 'test-key';
        globalThis.fetch = async () => new Response(JSON.stringify({ success: true, result: {} }));
        const originalError = logger.error;
        logger.error = () => {};
        try {
            const res = createResponse();
            await cfRadarHandler(createRequest({ query: { view: 'bgp-prefixes', asn: '13335' } }), res);
            assert.equal(res.statusCode, 500);
        } finally {
            logger.error = originalError;
        }
    });

    it("runs the country-traffic view's guard: missing ?country", async () => {
        const res = createResponse();
        await cfRadarHandler(createRequest({ query: { view: 'country-traffic' } }), res);
        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { error: 'No country provided' });
    });

    // Leaves the module-level outage feed empty: no other case here reads it.
    it('answers 500 when an empty outage feed cannot fill on demand', async () => {
        process.env.CLOUDFLARE_API_KEY = 'test-key';
        const asked = [];
        globalThis.fetch = async (url) => {
            asked.push(new URL(String(url)).pathname);
            return new Response('busy', { status: 503 });
        };
        const originalError = logger.error;
        const logged = [];
        logger.error = (ctx, msg) => logged.push(msg);
        try {
            const res = createResponse();
            await cfRadarHandler(createRequest({ query: { view: 'outages' } }), res);
            assert.equal(res.statusCode, 500);
            assert.deepEqual(res.body, { error: 'Internal server error' });
            assert.deepEqual(logged, ['cf-radar view failed']);
            assert.deepEqual(asked.sort(), [
                '/client/v4/radar/annotations/outages',
                '/client/v4/radar/traffic_anomalies',
            ]);
        } finally {
            logger.error = originalError;
        }
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

    it('passes upstream sign-in and quota rejections through with their status and code', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        for (const [status, upstream, coded] of [
            [403, UPSTREAM_SIGN_IN_REQUIRED, CODED_SIGN_IN_REQUIRED],
            [403, UPSTREAM_INVALID_TOKEN, CODED_INVALID_TOKEN],
            [429, UPSTREAM_QUOTA, CODED_QUOTA],
        ]) {
            globalThis.fetch = upstreamAnswer(status, upstream);
            const res = createResponse();
            await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
            assert.equal(res.statusCode, status);
            assert.deepEqual(res.body, coded);
        }
    });

    it('answers a not-yet-computed upstream 404 as pending', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        globalThis.fetch = upstreamAnswer(404, { error: 'Data not found' });
        const res = createResponse();
        await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { status: 'pending' });
    });

    it('reports missing API key when only the endpoint is unset', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        delete process.env.IPCHECKING_API_ENDPOINT;
        globalThis.fetch = async () => assert.fail('no upstream call');
        const res = createResponse();
        await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('asks /getpdresult with the apikey and the listed caller headers; a 202 body passes through', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        let called;
        globalThis.fetch = async (url, init) => {
            called = { url: new URL(String(url)), init };
            return new Response(JSON.stringify({ status: 'pending' }), { status: 202 });
        };
        const res = signedIn(createResponse());
        await invisibilityHandler(withVisitorHeaders(createRequest({ query: { id: 'a'.repeat(28) } })), res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { status: 'pending' });
        assert.equal(called.url.pathname, `/getpdresult/${'a'.repeat(28)}`);
        assert.equal(called.url.searchParams.get('apikey'), 'test-key');
        assertForwardedHeaders(called.init.headers, END_USER);
    });

    it('answers a service limit with its status and no quota code', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        globalThis.fetch = upstreamAnswer(429, UPSTREAM_SERVICE_LIMIT);
        const res = createResponse();
        await invisibilityHandler(createRequest({ query: { id: 'a'.repeat(28) } }), res);
        assert.equal(res.statusCode, 429);
        assert.deepEqual(res.body, { error: 'Service limit reached' });
    });
});

// -- ip-blocklist handler -------------------------------------------------

describe('ip-blocklist handler', () => {
    const configure = () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
    };

    it('reports a missing API key before any upstream call', async () => {
        delete process.env.IPCHECKING_API_KEY;
        globalThis.fetch = async () => assert.fail('no upstream call');
        const res = createResponse();
        await ipBlocklistHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('asks /iphitlist for the ip with the system key and the listed caller headers', async () => {
        configure();
        let called;
        globalThis.fetch = async (url, init) => {
            called = { url: new URL(url), init };
            return { status: 200, ok: true, json: async () => ({ ip: '1.1.1.1', summary: { listed: 0 } }) };
        };
        const req = withVisitorHeaders(createRequest({ query: { ip: '1.1.1.1' } }));
        const res = signedIn(createResponse());
        await ipBlocklistHandler(req, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { ip: '1.1.1.1', summary: { listed: 0 } });
        assert.equal(called.url.pathname, '/iphitlist');
        assert.equal(called.url.searchParams.get('ip'), '1.1.1.1');
        assert.equal(called.url.searchParams.get('key'), 'test-key');
        assertForwardedHeaders(called.init.headers, END_USER);

        await ipBlocklistHandler(withVisitorHeaders(createRequest({ query: { ip: '1.1.1.1' } })), createResponse());
        assertForwardedHeaders(called.init.headers);
    });

    it('passes an upstream sign-in rejection through as 403 with the auth code', async () => {
        configure();
        for (const [upstream, coded] of [
            [{ error: 'Sign in required' }, CODED_SIGN_IN_REQUIRED],
            [UPSTREAM_INVALID_TOKEN, CODED_INVALID_TOKEN],
        ]) {
            globalThis.fetch = upstreamAnswer(403, upstream);
            const res = createResponse();
            await ipBlocklistHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, coded);
        }
    });

    it('passes an exhausted monthly quota through as 429 with the quota code', async () => {
        configure();
        globalThis.fetch = upstreamAnswer(429, UPSTREAM_QUOTA);
        const res = createResponse();
        await ipBlocklistHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        assert.equal(res.statusCode, 429);
        assert.deepEqual(res.body, CODED_QUOTA);
    });

    it('passes a service limit through as 429 without the quota code', async () => {
        configure();
        globalThis.fetch = upstreamAnswer(429, UPSTREAM_SERVICE_LIMIT);
        const res = createResponse();
        await ipBlocklistHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        assert.equal(res.statusCode, 429);
        assert.deepEqual(res.body, { error: 'Service limit reached' });
    });

    it('turns any other upstream failure into a 500', async () => {
        configure();
        globalThis.fetch = async () => ({ status: 502, ok: false, json: async () => ({}) });
        const res = createResponse();
        const restore = logger.level;
        logger.level = 'silent';
        try {
            await ipBlocklistHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        } finally {
            logger.level = restore;
        }
        assert.equal(res.statusCode, 500);
    });

    it('waits well past the default 8s upstream timeout', () => {
        assert.ok(IP_BLOCKLIST_TIMEOUT_MS >= 30000);
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

    it('rejects a prefix shorter than 24 bits', async () => {
        const res = createResponse();
        await macCheckerHandler(createRequest({ query: { mac: '3C:5A' } }), res);
        assert.equal(res.statusCode, 400);
    });

    // Over fixture registries, so the answer doesn't depend on a download.
    const fixtureBlocks = new Map([
        ['3C5AB4', { registry: 'MA-L', company: 'Google, Inc.', address: 'Mountain View US 94043', country: 'US' }],
    ]);

    it('answers a vendor prefix in any notation from the registries', async () => {
        const handler = createMacChecker((hex) => describeMac(fixtureBlocks, hex));
        const res = createResponse();
        await handler(createRequest({ query: { mac: '3c5a.b4' } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.found, true);
        assert.equal(res.body.company, 'Google, Inc.');
        assert.equal(res.body.blockSize, 16777216);
    });

    it('answers 503 when no registries are loaded', async () => {
        const res = createResponse();
        await createMacChecker(() => null)(createRequest({ query: { mac: '3C:5A:B4' } }), res);
        assert.equal(res.statusCode, 503);
        assert.deepEqual(res.body, { error: 'MAC database unavailable' });
    });
});

// -- bulk-lookup handler --------------------------------------------------

describe('bulk-lookup handler', () => {
    // A fixture source, so no dataset needs to be loaded.
    const lookups = [];
    const fixtureSource = {
        id: 'fixture',
        build: () => '2026-10-20',
        lookup: (ip, lang) => {
            lookups.push([ip, lang]);
            if (ip === '9.9.9.9') throw new Error('corrupt record');
            return {
                ip, city: 'Mountain View', region: 'California', country: 'US', country_name: 'United States',
                country_code: 'US', latitude: 37.4, longitude: -122.1, asn: 'AS15169', org: 'GOOGLE',
            };
        },
    };
    const handler = createBulkLookup(() => fixtureSource);
    const post = (body) => {
        const res = createResponse();
        handler(createRequest({ method: 'POST', body }), res);
        return res;
    };
    beforeEach(() => { lookups.length = 0; });

    it('rejects non-POST with 405', () => {
        const res = createResponse();
        handler(createRequest(), res);
        assert.equal(res.statusCode, 405);
    });

    it('rejects a missing body, a non-array or an empty ips', () => {
        assert.equal(post(undefined).statusCode, 400);
        assert.equal(post({ ips: '8.8.8.8' }).statusCode, 400);
        assert.equal(post({ ips: [] }).statusCode, 400);
    });

    it(`rejects more than ${BULK_LOOKUP_MAX_IPS} entries`, () => {
        const ips = Array.from({ length: BULK_LOOKUP_MAX_IPS + 1 }, (_, i) => `8.8.8.${i + 1}`);
        assert.equal(BULK_LOOKUP_MAX_IPS, 200);
        assert.equal(post({ ips }).statusCode, 400);
        assert.equal(lookups.length, 0);
    });

    it('rejects the whole request over one bad entry', () => {
        for (const bad of [42, null, { ip: '8.8.8.8' }, `8.8.8.8${' '.repeat(40)}`, 'not-an-ip', '10.0.0.1', '2001:db8::1', ' 8.8.8.8']) {
            assert.equal(post({ ips: ['1.1.1.1', bad] }).statusCode, 400, `accepted ${JSON.stringify(bad)}`);
        }
        assert.equal(lookups.length, 0);
    });

    it('rejects a non-string or overlong lang', () => {
        assert.equal(post({ ips: ['8.8.8.8'], lang: 7 }).statusCode, 400);
        assert.equal(post({ ips: ['8.8.8.8'], lang: 'x'.repeat(36) }).statusCode, 400);
        assert.equal(lookups.length, 0);
    });

    it(`accepts exactly ${BULK_LOOKUP_MAX_IPS} distinct IPs`, () => {
        const ips = Array.from({ length: BULK_LOOKUP_MAX_IPS }, (_, i) => `8.8.8.${i + 1}`);
        assert.equal(post({ ips }).statusCode, 200);
        assert.deepEqual(lookups.map(([ip]) => ip), ips);
    });

    it(`accepts ${BULK_LOOKUP_MAX_IPS} IPv6 in their longest canonical form`, () => {
        const ips = Array.from({ length: BULK_LOOKUP_MAX_IPS }, (_, i) => `2a00:1450:4001:abcd:1234:5678:9abc:${(0x1000 + i).toString(16)}`);
        assert.ok(ips.every((ip) => ip.length === 39));
        assert.equal(post({ ips, lang: 'pt-BR' }).statusCode, 200);
        assert.equal(lookups.length, BULK_LOOKUP_MAX_IPS);
    });

    it('a full request fits the route\'s own body limit in backend-server.js', () => {
        const server = fs.readFileSync(new URL('../backend-server.js', import.meta.url), 'utf8');
        const match = /'\/api\/bulk-lookup', express\.json\(\{ limit: '(\d+)kb' \}\)/.exec(server);
        assert.ok(match, 'bulk-lookup body parser not found');
        // Even at the handler's per-entry maximum, with the longest lang.
        const body = JSON.stringify({ ips: Array(BULK_LOOKUP_MAX_IPS).fill('f'.repeat(45)), lang: 'x'.repeat(35) });
        assert.ok(Buffer.byteLength(body) < Number(match[1]) * 1024, `${Buffer.byteLength(body)} bytes over ${match[1]}kb`);
    });

    it('rejects a repeated entry instead of deduping it', () => {
        assert.equal(post({ ips: ['8.8.8.8', '1.1.1.1', '8.8.8.8'] }).statusCode, 400);
        assert.equal(lookups.length, 0);
    });

    it('passes lang through raw and answers the compact shape', () => {
        const res = post({ ips: ['8.8.8.8'], lang: 'zh' });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(lookups, [['8.8.8.8', 'zh']]);
        assert.deepEqual(res.body, {
            source: { id: 'fixture', build: '2026-10-20' },
            results: [{
                ip: '8.8.8.8', country: 'US', city: 'Mountain View', region: 'California',
                latitude: 37.4, longitude: -122.1, asn: 'AS15169', org: 'GOOGLE',
            }],
        });
    });

    it('leaves out an IP whose lookup throws, keeping the rest', () => {
        const res = post({ ips: ['9.9.9.9', '1.1.1.1'] });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.results.map((r) => r.ip), ['1.1.1.1']);
    });

    it('answers 503 when the source has no data loaded', () => {
        const notReady = createBulkLookup(() => ({
            id: 'fixture',
            lookup: () => { const e = new Error('not ready'); e.statusCode = 503; throw e; },
        }));
        const res = createResponse();
        notReady(createRequest({ method: 'POST', body: { ips: ['8.8.8.8'] } }), res);
        assert.equal(res.statusCode, 503);
    });

    it('resolves BULK_LOOKUP_SOURCE, falling back to maxmind on unknown values', () => {
        assert.equal(resolveBulkLookupSource(undefined).source.id, DEFAULT_BULK_LOOKUP_SOURCE);
        assert.deepEqual(
            { ...resolveBulkLookupSource(' MaxMind '), source: undefined },
            { name: 'maxmind', known: true, source: undefined },
        );
        const unknown = resolveBulkLookupSource('ipinfo');
        assert.equal(unknown.known, false);
        assert.equal(unknown.source.id, 'maxmind');
        assert.equal(resolveBulkLookupSource('constructor').known, false);
    });
});

// -- achievements handlers ------------------------------------------------

describe('achievements handlers', () => {
    // The route's chain: requireUser(), requireUserStorage(), then the handler.
    const route = async (handler, req, { verify = async () => ({ id: USER_ID }), storage }) => {
        const res = createResponse();
        for (const step of [requireUser(verify), requireUserStorage(storage), handler]) {
            let advanced = false;
            await step(req, res, () => { advanced = true; });
            if (step !== handler && !advanced) break;
        }
        return res;
    };
    const setup = (times = [1000, 2000, 3000]) => {
        const stamps = times.map((ms) => new Date(ms));
        const db = fakeUserDb({ now: () => stamps.shift() ?? new Date(9999) });
        return { db, storage: fakeStorage(db), handlers: createAchievementHandlers(fakeStorage(db)) };
    };
    const put = (body) => createRequest({ method: 'PUT', body });

    it('rejects the wrong method with 405', async () => {
        const { handlers } = setup();
        const res = signedIn(createResponse());
        await handlers.list(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        const res2 = signedIn(createResponse());
        await handlers.unlock(createRequest({ method: 'GET' }), res2);
        assert.equal(res2.statusCode, 405);
    });

    it('signed out → 403 auth, before storage is touched', async () => {
        const { db, storage, handlers } = setup();
        const verify = async () => ({ reason: AUTH_REASON.SIGN_IN_REQUIRED });
        for (const [handler, req] of [[handlers.list, createRequest()], [handlers.unlock, put({ name: 'IAmHuman' })]]) {
            const res = await route(handler, req, { verify, storage });
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, CODED_SIGN_IN_REQUIRED);
        }
        assert.equal(db.calls.length, 0);
    });

    it('storage off or not ready → 503', async () => {
        const { db, handlers } = setup();
        for (const options of [{ configured: false }, { ready: false }]) {
            const storage = fakeStorage(db, options);
            for (const [handler, req] of [[handlers.list, createRequest()], [handlers.unlock, put({ name: 'IAmHuman' })]]) {
                const res = await route(handler, req, { storage });
                assert.equal(res.statusCode, 503);
                assert.deepEqual(res.body, { error: 'User storage unavailable' });
            }
        }
        assert.equal(db.calls.length, 0);
    });

    it('PUT with an unknown, missing or non-string name → 400, nothing stored', async () => {
        const { db, storage, handlers } = setup();
        for (const body of [{ name: 'NoSuchBadge' }, {}, undefined, { name: 42 }, { name: 'constructor' }, { achievement: 'IAmHuman' }]) {
            const res = await route(handlers.unlock, put(body), { storage });
            assert.equal(res.statusCode, 400, JSON.stringify(body));
            assert.deepEqual(res.body, { error: 'Unknown achievement' });
        }
        assert.equal(db.calls.length, 0);
    });

    it('a new user lists nothing, with zero uses, and gets a users row', async () => {
        const { db, storage, handlers } = setup();
        const res = await route(handlers.list, createRequest(), { storage });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { achievements: {}, totalUses: 0 });
        assert.ok(db.users.has(USER_ID));
    });

    it('PUT unlocks once; a repeat keeps the first time; GET lists it with the summed uses', async () => {
        const { db, storage, handlers } = setup([1000, 2000, 3000, 4000]);
        const first = await route(handlers.unlock, put({ name: 'IAmHuman' }), { storage });
        assert.equal(first.statusCode, 200);
        assert.equal(first.body.name, 'IAmHuman');
        const again = await route(handlers.unlock, put({ name: 'IAmHuman' }), { storage });
        assert.deepEqual(again.body, first.body);
        await route(handlers.unlock, put({ name: 'CuriousCat' }), { storage });
        await recordFeatureUse(db.query, USER_ID, FEATURE_USES.persona);
        await recordFeatureUse(db.query, USER_ID, FEATURE_USES.persona);
        await recordFeatureUse(db.query, USER_ID, FEATURE_USES.ipchecking);
        await recordFeatureUse(db.query, 'someone-else', FEATURE_USES.ipchecking);

        const res = await route(handlers.list, createRequest(), { storage });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, {
            achievements: {
                IAmHuman: { achieved: true, achievedTime: first.body.achievedTime },
                CuriousCat: { achieved: true, achievedTime: res.body.achievements.CuriousCat.achievedTime },
            },
            totalUses: 3,
        });
        assert.equal(typeof first.body.achievedTime, 'number');
        assert.ok(res.body.achievements.CuriousCat.achievedTime > first.body.achievedTime);
    });

    it('a storage failure answers 500 without its details', async () => {
        const storage = fakeStorage({ query: async () => { throw new Error('relation "x" does not exist'); } });
        const handlers = createAchievementHandlers(storage);
        const listRes = await route(handlers.list, createRequest(), { storage });
        assert.equal(listRes.statusCode, 500);
        assert.deepEqual(listRes.body, { error: 'Achievements unavailable' });
        const putRes = await route(handlers.unlock, put({ name: 'IAmHuman' }), { storage });
        assert.equal(putRes.statusCode, 500);
        assert.deepEqual(putRes.body, { error: 'Achievement not saved' });
    });
});

// -- sync handlers --------------------------------------------------------

describe('sync handlers', () => {
    const NOW = 1_000_000;
    const { preferences, connectivity } = SYNC_COLLECTIONS;
    // A stand-in collection with deletes and small pages, exercising the generic engine.
    const ticks = Object.freeze({
        id: 'ticks', version: 1,
        isValidItemId: (id) => typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id),
        isValidValue: (id, value) => value === 'checked' || value === 'ignored',
        maxItems: 100, maxItemBytes: 64, allowDelete: true, pageSize: 3,
    });
    const COLLECTIONS = Object.freeze({ ...SYNC_COLLECTIONS, ticks });
    // The route's chain: requireValidSyncCollection(), requireUser(), requireUserStorage(), then the handler.
    const route = async (handler, req, { verify = async () => ({ id: USER_ID }), storage, collections = COLLECTIONS }) => {
        const res = createResponse();
        for (const step of [requireValidSyncCollection('collection', collections), requireUser(verify), requireUserStorage(storage), handler]) {
            let advanced = false;
            await step(req, res, () => { advanced = true; });
            if (step !== handler && !advanced) break;
        }
        return res;
    };
    const enable = (db, user = USER_ID, ids = ['ticks', 'preferences', 'connectivity']) =>
        db.syncSettings.set(user, { collections: ids, updated_at: new Date() });
    const setup = ({ enabled = true } = {}) => {
        const db = fakeUserDb();
        if (enabled) for (const user of [USER_ID, 'alice', 'bob']) enable(db, user);
        const storage = fakeStorage(db);
        return { db, storage, handlers: createSyncHandlers(storage, { now: () => NOW }) };
    };
    const get = (collection, query = {}) => ({ ...createRequest({ query }), params: { collection } });
    const put = (collection, body) => ({ ...createRequest({ method: 'PUT', body }), params: { collection } });
    const as = (id) => async () => ({ id });
    const tick = (id, updatedAt, value = 'checked') => ({ id, updatedAt, deleted: false, value });
    const v = String(ticks.version);
    const SYNC_OFF = { error: 'Sync is off for this collection', code: SYNC_OFF_CODE };

    it('rejects the wrong method with 405', async () => {
        const { handlers } = setup();
        const res = signedIn(createResponse());
        res.locals.syncCollection = ticks;
        await handlers.read(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        const res2 = signedIn(createResponse());
        res2.locals.syncCollection = ticks;
        await handlers.write(createRequest({ method: 'GET' }), res2);
        assert.equal(res2.statusCode, 405);
    });

    it('an unknown collection → 404 before sign-in or storage; snapshots and checklist are not collections', async () => {
        const { db, storage, handlers } = setup();
        let verified = false;
        const verify = async () => { verified = true; return { id: USER_ID }; };
        for (const name of ['nope', 'snapshots', 'checklist', 'constructor', '__proto__', '']) {
            for (const req of [get(name, { v: '1' }), put(name, { version: 1, items: [] })]) {
                const res = await route(req.method === 'PUT' ? handlers.write : handlers.read, req, { verify, storage, collections: SYNC_COLLECTIONS });
                assert.equal(res.statusCode, 404, name);
                assert.deepEqual(res.body, { error: 'Unknown collection' });
            }
        }
        assert.equal(verified, false);
        assert.equal(db.calls.length, 0);
    });

    it('signed out → 403 auth; storage off or not ready → 503; storage untouched either way', async () => {
        const { db, storage, handlers } = setup();
        const signedOut = async () => ({ reason: AUTH_REASON.SIGN_IN_REQUIRED });
        for (const [handler, req] of [[handlers.read, get('ticks', { v })], [handlers.write, put('ticks', { version: 1, items: [] })]]) {
            const res = await route(handler, req, { verify: signedOut, storage });
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, CODED_SIGN_IN_REQUIRED);
            for (const options of [{ configured: false }, { ready: false }]) {
                const off = await route(handler, req, { storage: fakeStorage(db, options) });
                assert.equal(off.statusCode, 503);
            }
        }
        assert.equal(db.calls.length, 0);
    });

    it('a collection the account has not enabled → 409 sync_off, nothing read or written', async () => {
        const { db, storage, handlers } = setup({ enabled: false });
        const attempt = async () => {
            db.calls.length = 0;
            const read = await route(handlers.read, get('preferences', { v: String(preferences.version) }), { storage });
            const write = await route(handlers.write, put('preferences', {
                version: preferences.version, items: [{ id: 'theme', updatedAt: 1, value: 'dark' }],
            }), { storage });
            return [read, write];
        };
        for (const ids of [null, [], ['connectivity']]) {
            if (ids) enable(db, USER_ID, ids);
            for (const res of await attempt()) {
                assert.equal(res.statusCode, 409, JSON.stringify(ids));
                assert.deepEqual(res.body, SYNC_OFF);
            }
            assert.ok(db.calls.every(({ text }) => !text.includes('synced_items')), 'synced_items untouched');
            assert.equal(db.syncedItems.size, 0);
        }
        enable(db, USER_ID, ['preferences']);
        const [read, write] = await attempt();
        assert.equal(read.statusCode, 200);
        assert.deepEqual(write.body, { base: 0, cursor: 1, conflicts: [], refused: [] });
    });

    it('GET with a bad v or since → 400, storage untouched', async () => {
        const { db, storage, handlers } = setup();
        for (const query of [{}, { v: '0' }, { v: '-1' }, { v: '1.5' }, { v: 'x' }, { v: '01' }, { v: '9999999999' }, { v: ['1', '2'] },
            { v, since: '-1' }, { v, since: '1.5' }, { v, since: 'abc' }, { v, since: '99999999999999999' }, { v, since: ['1'] }]) {
            const res = await route(handlers.read, get('ticks', query), { storage });
            assert.equal(res.statusCode, 400, JSON.stringify(query));
            assert.equal(typeof res.body.error, 'string');
        }
        assert.equal(db.calls.length, 0);
    });

    it('GET with nothing stored → an empty page at the given cursor, and a users row', async () => {
        const { db, storage, handlers } = setup();
        const res = await route(handlers.read, get('ticks', { v }), { storage });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { cursor: 0, more: false, items: [] });
        assert.ok(db.users.has(USER_ID));
        const later = await route(handlers.read, get('ticks', { v, since: '42' }), { storage });
        assert.deepEqual(later.body, { cursor: 42, more: false, items: [] });
    });

    it('PUT then GET round-trips; base / cursor tell whether the device missed anything', async () => {
        const { storage, handlers } = setup();
        const first = await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 10), tick('b', 20, 'ignored')] }), { storage });
        assert.equal(first.statusCode, 200);
        assert.deepEqual(first.body, { base: 0, cursor: 2, conflicts: [], refused: [] });
        const second = await route(handlers.write, put('ticks', { version: 1, items: [{ id: 'a', updatedAt: 30, deleted: true }] }), { storage });
        assert.deepEqual(second.body, { base: 2, cursor: 3, conflicts: [], refused: [] });
        const all = await route(handlers.read, get('ticks', { v }), { storage });
        assert.deepEqual(all.body, { cursor: 3, more: false, items: [tick('b', 20, 'ignored'), { id: 'a', updatedAt: 30, deleted: true }] });
        const since = await route(handlers.read, get('ticks', { v, since: '2' }), { storage });
        assert.deepEqual(since.body, { cursor: 3, more: false, items: [{ id: 'a', updatedAt: 30, deleted: true }] });
    });

    it('the Connectivity lists and default list id round-trip', async () => {
        const { storage, handlers } = setup();
        const lists = sanitizeLists(null, null, []);
        const items = [
            { id: 'lists', updatedAt: 5, deleted: false, value: lists },
            { id: 'defaultListId', updatedAt: 5, deleted: false, value: 'mine' },
        ];
        const saved = await route(handlers.write, put('connectivity', { version: connectivity.version, items }), { storage });
        assert.deepEqual(saved.body, { base: 0, cursor: 2, conflicts: [], refused: [] });
        const listed = await route(handlers.read, get('connectivity', { v: String(connectivity.version) }), { storage });
        assert.deepEqual(listed.body, { cursor: 2, more: false, items });
        const bad = await route(handlers.write, put('connectivity', { version: connectivity.version, items: [
            { id: 'lists', updatedAt: 6, value: { ...lists, extra: 1 } }, { id: 'defaultListId', updatedAt: 6, value: '' },
        ] }), { storage });
        assert.deepEqual(bad.body.refused, [{ id: 'lists', reason: 'invalid' }, { id: 'defaultListId', reason: 'invalid' }]);
        const unknown = await route(handlers.write, put('connectivity', { version: connectivity.version, items: [
            { id: 'connectivityLists', updatedAt: 6, value: lists },
        ] }), { storage });
        assert.equal(unknown.statusCode, 400);
    });

    it('GET pages by the collection\'s pageSize with `more`', async () => {
        const { storage, handlers } = setup();
        const count = ticks.pageSize + 2;
        const items = Array.from({ length: count }, (_, i) => tick(`s${i}`, i + 1));
        const saved = await route(handlers.write, put('ticks', { version: 1, items }), { storage });
        assert.deepEqual(saved.body, { base: 0, cursor: count, conflicts: [], refused: [] });
        const page1 = await route(handlers.read, get('ticks', { v }), { storage });
        assert.equal(page1.body.items.length, ticks.pageSize);
        assert.equal(page1.body.more, true);
        assert.equal(page1.body.cursor, ticks.pageSize);
        assert.deepEqual(page1.body.items[0], tick('s0', 1));
        const page2 = await route(handlers.read, get('ticks', { v, since: String(page1.body.cursor) }), { storage });
        assert.deepEqual(page2.body.items.map(({ id }) => id), Array.from({ length: 2 }, (_, i) => `s${ticks.pageSize + i}`));
        assert.equal(page2.body.more, false);
        assert.equal(page2.body.cursor, count);
    });

    it('a stored edit as new or newer stays and comes back in conflicts; a future time is clamped', async () => {
        const { storage, handlers } = setup();
        await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 100), tick('b', NOW * 3)] }), { storage });
        const res = await route(handlers.write, put('ticks', {
            version: 1, items: [tick('a', 100, 'ignored'), tick('b', NOW + 5, 'ignored'), tick('c', 1)],
        }), { storage });
        assert.deepEqual(res.body, { base: 2, cursor: 3, conflicts: [tick('a', 100), tick('b', NOW)], refused: [] });
    });

    it('refuses an item per reason and stores the rest', async () => {
        const { storage, handlers } = setup();
        const small = { ...COLLECTIONS, ticks: { ...ticks, maxItems: 1 } };
        const res = await route(handlers.write, put('ticks', { version: 1, items: [
            tick('bad', 1, 'maybe'), tick('ok', 1), tick('over', 1), { id: 'big', updatedAt: 1, value: 'x'.repeat(100) },
        ] }), { storage, collections: small });
        assert.deepEqual(res.body.refused, [
            { id: 'bad', reason: 'invalid' }, { id: 'over', reason: 'full' }, { id: 'big', reason: 'too_large' },
        ]);
        const prefs = await route(handlers.write, put('preferences', { version: preferences.version, items: [
            { id: 'theme', updatedAt: 1, deleted: true }, { id: 'lang', updatedAt: 1, value: 'fr' },
        ] }), { storage });
        assert.deepEqual(prefs.body.refused, [{ id: 'theme', reason: 'no_delete' }]);
        const listed = await route(handlers.read, get('preferences', { v: String(preferences.version) }), { storage });
        assert.deepEqual(listed.body.items, [{ id: 'lang', updatedAt: 1, deleted: false, value: 'fr' }]);
    });

    it('PUT with a bad shape or another version → 400, nothing written', async () => {
        const { db, storage, handlers } = setup();
        const many = Array.from({ length: 501 }, (_, i) => tick(`s-${i}`, 1));
        for (const body of [
            undefined, [], 'x', {}, { version: 1 }, { version: 1, items: {} },
            { version: 2, items: [] }, { version: 0, items: [] }, { version: '1', items: [] },
            { version: 1, items: many },
            { version: 1, items: [null] },
            { version: 1, items: [{ updatedAt: 1, value: 'checked' }] },
            { version: 1, items: [tick('Not A Slug', 1)] },
            { version: 1, items: [tick('a', 0)] },
            { version: 1, items: [tick('a', -5)] },
            { version: 1, items: [tick('a', 1.5)] },
            { version: 1, items: [tick('a', '5')] },
            { version: 1, items: [{ ...tick('a', 5), deleted: 'yes' }] },
            { version: 1, items: [tick('a', 1), tick('a', 2)] },
        ]) {
            const res = await route(handlers.write, put('ticks', body), { storage });
            assert.equal(res.statusCode, 400, JSON.stringify(body)?.slice(0, 80));
            assert.equal(typeof res.body.error, 'string');
        }
        assert.equal(db.calls.length, 0);
        const prefs = await route(handlers.write, put('preferences', { version: 1, items: [{ id: 'theme', updatedAt: 1, value: 'dark' }] }), { storage });
        assert.equal(prefs.statusCode, 400);
        const unknownKey = await route(handlers.write, put('preferences', { version: preferences.version, items: [{ id: 'nope', updatedAt: 1, value: 1 }] }), { storage });
        assert.equal(unknownKey.statusCode, 400);
        assert.equal(db.syncedItems.size, 0);
    });

    it('a write to version N+1 never touches version N rows; GET serves each version its own rows', async () => {
        const { db, storage, handlers } = setup();
        await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 1), tick('b', 1)] }), { storage });
        const next = { ...COLLECTIONS, ticks: { ...ticks, version: 2 } };
        const stale = await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 5, 'ignored')] }), { storage, collections: next });
        assert.equal(stale.statusCode, 400);
        const res = await route(handlers.write, put('ticks', { version: 2, items: [tick('a', 5, 'ignored')] }), { storage, collections: next });
        assert.deepEqual(res.body, { base: 0, cursor: 3, conflicts: [], refused: [] });
        const v1 = await route(handlers.read, get('ticks', { v: '1' }), { storage, collections: next });
        assert.deepEqual(v1.body.items, [tick('a', 1), tick('b', 1)]);
        const v2 = await route(handlers.read, get('ticks', { v: '2' }), { storage, collections: next });
        assert.deepEqual(v2.body.items, [tick('a', 5, 'ignored')]);
        assert.deepEqual([...db.syncedItems.values()].filter((row) => row.schema_version === 1).map((row) => row.data), ['checked', 'checked']);
    });

    it('a user never sees another user\'s items', async () => {
        const { storage, handlers } = setup();
        await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 1)] }), { verify: as('alice'), storage });
        const bob = await route(handlers.read, get('ticks', { v }), { verify: as('bob'), storage });
        assert.deepEqual(bob.body, { cursor: 0, more: false, items: [] });
        const bobPut = await route(handlers.write, put('ticks', { version: 1, items: [tick('a', 2, 'ignored')] }), { verify: as('bob'), storage });
        assert.deepEqual(bobPut.body, { base: 0, cursor: 2, conflicts: [], refused: [] });
        const alice = await route(handlers.read, get('ticks', { v }), { verify: as('alice'), storage });
        assert.deepEqual(alice.body.items, [tick('a', 1)]);
    });

    it('a storage failure answers 500 without its details', async () => {
        const storage = fakeStorage({ query: async () => { throw new Error('relation "x" does not exist'); } });
        const handlers = createSyncHandlers(storage);
        const readRes = await route(handlers.read, get('ticks', { v }), { storage });
        assert.equal(readRes.statusCode, 500);
        assert.deepEqual(readRes.body, { error: 'Sync unavailable' });
        const putRes = await route(handlers.write, put('ticks', { version: 1, items: [] }), { storage });
        assert.equal(putRes.statusCode, 500);
        assert.deepEqual(putRes.body, { error: 'Sync not saved' });
    });
});

// -- sync settings handlers -----------------------------------------------

describe('sync settings handlers', () => {
    // The route's chain: requireUser(), requireUserStorage(), then the handler.
    const route = async (handler, req, { verify = async () => ({ id: USER_ID }), storage }) => {
        const res = createResponse();
        for (const step of [requireUser(verify), requireUserStorage(storage), handler]) {
            let advanced = false;
            await step(req, res, () => { advanced = true; });
            if (step !== handler && !advanced) break;
        }
        return res;
    };
    const setup = () => {
        const db = fakeUserDb();
        const storage = fakeStorage(db);
        return { db, storage, handlers: createSyncSettingsHandlers(storage) };
    };
    const put = (body) => createRequest({ method: 'PUT', body });
    const itemsOf = (db, user) => [...db.syncedItems.values()].filter((row) => row.user_id === user).map((row) => row.collection).sort();
    const putRow = (db, user, collection, version, item) => db.syncedItems.set([user, collection, version, item].join('\u0000'), {
        user_id: user, collection, schema_version: version, item_id: item, updated_at: 1, deleted: false, data: 'v', seq: db.syncedItems.size + 1,
    });

    it('rejects the wrong method with 405', async () => {
        const { handlers } = setup();
        const res = signedIn(createResponse());
        await handlers.read(createRequest({ method: 'POST' }), res);
        assert.equal(res.statusCode, 405);
        const res2 = signedIn(createResponse());
        await handlers.write(createRequest({ method: 'GET' }), res2);
        assert.equal(res2.statusCode, 405);
    });

    it('signed out → 403 auth; storage off or not ready → 503; storage untouched either way', async () => {
        const { db, storage, handlers } = setup();
        const signedOut = async () => ({ reason: AUTH_REASON.SIGN_IN_REQUIRED });
        for (const [handler, req] of [[handlers.read, createRequest()], [handlers.write, put({ collections: [] })]]) {
            const res = await route(handler, req, { verify: signedOut, storage });
            assert.equal(res.statusCode, 403);
            assert.deepEqual(res.body, CODED_SIGN_IN_REQUIRED);
            for (const options of [{ configured: false }, { ready: false }]) {
                assert.equal((await route(handler, req, { storage: fakeStorage(db, options) })).statusCode, 503);
            }
        }
        assert.equal(db.calls.length, 0);
    });

    it('GET for a user who never decided → undecided, nothing enabled, and a users row', async () => {
        const { db, storage, handlers } = setup();
        const res = await route(handlers.read, createRequest(), { storage });
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { decided: false, collections: [] });
        assert.ok(db.users.has(USER_ID));
    });

    it('PUT with anything but an array of distinct registry ids → 400, nothing written', async () => {
        const { db, storage, handlers } = setup();
        for (const body of [
            undefined, null, [], 'x', {}, { collections: 'preferences' }, { collections: {} }, { collections: null },
            { collections: ['nope'] }, { collections: ['snapshots'] }, { collections: ['checklist'] },
            { collections: ['preferences', 'preferences'] }, { collections: [1] }, { collections: [null] },
            { collections: ['constructor'] }, { collections: ['__proto__'] },
        ]) {
            const res = await route(handlers.write, put(body), { storage });
            assert.equal(res.statusCode, 400, JSON.stringify(body));
            assert.equal(typeof res.body.error, 'string');
        }
        assert.equal(db.calls.length, 0);
    });

    it('PUT decides: nothing, then both, in registry order; GET reads it back', async () => {
        const { db, storage, handlers } = setup();
        const none = await route(handlers.write, put({ collections: [] }), { storage });
        assert.equal(none.statusCode, 200);
        assert.deepEqual(none.body, { decided: true, collections: [] });
        assert.deepEqual((await route(handlers.read, createRequest(), { storage })).body, { decided: true, collections: [] });
        const both = await route(handlers.write, put({ collections: ['connectivity', 'preferences'] }), { storage });
        assert.deepEqual(both.body, { decided: true, collections: ['preferences', 'connectivity'] });
        assert.deepEqual((await route(handlers.read, createRequest(), { storage })).body, both.body);
        assert.ok(db.users.has(USER_ID));
    });

    it('turning a collection off deletes exactly its rows, in every version; other users keep theirs', async () => {
        const { db, storage, handlers } = setup();
        await route(handlers.write, put({ collections: ['preferences', 'connectivity'] }), { storage });
        for (const user of [USER_ID, 'other']) {
            putRow(db, user, 'preferences', 7, 'theme');
            putRow(db, user, 'preferences', 6, 'lang');
            putRow(db, user, 'connectivity', 1, 'lists');
        }
        await route(handlers.write, put({ collections: ['connectivity'] }), { storage });
        assert.deepEqual(itemsOf(db, USER_ID), ['connectivity']);
        await route(handlers.write, put({ collections: [] }), { storage });
        assert.deepEqual(itemsOf(db, USER_ID), []);
        assert.deepEqual(itemsOf(db, 'other'), ['connectivity', 'preferences', 'preferences']);
    });

    it('GET leaves out stored ids the registry no longer has', async () => {
        const { db, storage, handlers } = setup();
        db.syncSettings.set(USER_ID, { collections: ['snapshots', 'preferences', 'checklist'], updated_at: new Date() });
        assert.deepEqual((await route(handlers.read, createRequest(), { storage })).body, { decided: true, collections: ['preferences'] });
    });

    it('a storage failure answers 500 without its details', async () => {
        const storage = fakeStorage({ query: async () => { throw new Error('relation "x" does not exist'); } });
        const handlers = createSyncSettingsHandlers(storage);
        const readRes = await route(handlers.read, createRequest(), { storage });
        assert.equal(readRes.statusCode, 500);
        assert.deepEqual(readRes.body, { error: 'Sync settings unavailable' });
        const putRes = await route(handlers.write, put({ collections: [] }), { storage });
        assert.equal(putRes.statusCode, 500);
        assert.deepEqual(putRes.body, { error: 'Sync settings not saved' });
    });
});

// -- usage handler --------------------------------------------------------

describe('usage handler', () => {
    it('reports missing API key before fetch', async () => {
        delete process.env.IPCHECKING_API_KEY;
        const res = createResponse();
        await usageHandler(createRequest(), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('reports missing API key when only the endpoint is unset', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        delete process.env.IPCHECKING_API_ENDPOINT;
        globalThis.fetch = async () => assert.fail('no upstream call');
        const res = createResponse();
        await usageHandler(createRequest(), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    // Fields beyond { userLevel, quota } (an older upstream's) are not relayed.
    const upstreamSummary = {
        userLevel: 'Standard',
        quota: { month: '2026-11', isSponsor: false, features: {} },
        functionUses: { total: 9 },
        achievements: { IAmHuman: { achieved: true, achievedTime: 1 } },
    };

    it('asks /usage with the system key and the listed caller headers, relaying { userLevel, quota }', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        let called;
        globalThis.fetch = async (url, init) => {
            called = { url: new URL(String(url)), init };
            return new Response(JSON.stringify(upstreamSummary), { status: 200 });
        };
        const res = signedIn(createResponse());
        await usageHandler(withVisitorHeaders(createRequest()), res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, { userLevel: 'Standard', quota: upstreamSummary.quota });
        assert.equal(called.url.pathname, '/usage');
        assert.equal(called.url.searchParams.get('key'), 'test-key');
        assertForwardedHeaders(called.init.headers, END_USER);
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

    it('forwards the listed caller headers and passes the upstream status through', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        let called;
        globalThis.fetch = async (url, init) => {
            called = { url: new URL(String(url)), init };
            return new Response(JSON.stringify(UPSTREAM_SIGN_IN_REQUIRED), { status: 403 });
        };
        const res = signedIn(createResponse());
        const req = withVisitorHeaders({ method: 'GET', headers: { referer: 'http://localhost/' }, query: {}, params: { token: 'a'.repeat(32) } });
        await dnsLeakGetResult(req, res);
        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, CODED_SIGN_IN_REQUIRED);
        assert.equal(called.url.pathname, `/dnsleaktest/session/${'a'.repeat(32)}`);
        assertForwardedHeaders(called.init.headers, END_USER);
    });

    it('answers invalid-token and quota rejections with their status and code', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        for (const [status, upstream, coded] of [
            [403, UPSTREAM_INVALID_TOKEN, CODED_INVALID_TOKEN],
            [429, UPSTREAM_QUOTA, CODED_QUOTA],
            [429, UPSTREAM_SERVICE_LIMIT, { error: 'Service limit reached' }],
        ]) {
            globalThis.fetch = upstreamAnswer(status, upstream);
            const res = createResponse();
                await dnsLeakGetResult({ method: 'GET', headers: {}, query: {}, params: { token: 'a'.repeat(32) } }, res);
            assert.equal(res.statusCode, status);
            assert.deepEqual(res.body, coded);
        }
    });

    it('answers a malformed session token with 400 and no auth code', async () => {
        const res = createResponse();
        await dnsLeakGetResult({ method: 'GET', headers: {}, query: {}, params: { token: 'abc' } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal('code' in res.body, false);
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
            const res = createResponse();
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

    const geo = { ip: '1.1.1.1', country: 'AU', latitude: -33.86, longitude: 151.2, asn: 'AS13335', org: 'Cloudflare' };
    const callWith = async (upstream) => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.test';
        globalThis.fetch = upstream;
        const res = createResponse();
        await ipcheckIngHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        return res;
    };
    const answering = (body) => async () => new Response(JSON.stringify(body), { status: 200 });
    const silenced = async (run) => {
        const originalError = logger.error;
        logger.error = () => {};
        try { return await run(); } finally { logger.error = originalError; }
    };

    it('answers the geo fields and the extended block, without the advanced data', async () => {
        const advancedData = { score: 88, operatorType: 'Business', tags: { isNative: true } };
        const res = await callWith(answering({ ...geo, advancedData }));
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, {
            ...geo,
            extended: {
                anonymity: { code: 'none' }, lineType: 'business', native: true, score: 88,
                flags: advancedData.tags,
            },
        });
    });

    it('answers a gated block without the advanced data', async () => {
        const gated = 'sign_in_required';
        const advancedData = { score: gated, operatorType: gated, anonymityProvider: gated, anonymityProtocol: gated, tags: gated };
        const res = await callWith(answering({ ...geo, advancedData }));
        assert.deepEqual(res.body, { ...geo, extended: { gate: 'auth' } });
    });

    it('drops advanced data with no usable block', async () => {
        const res = await callWith(answering({ ...geo, advancedData: { score: 88 } }));
        assert.deepEqual(res.body, geo);
    });

    it('answers the geo fields alone when there is no advanced data', async () => {
        const res = await callWith(answering(geo));
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body, geo);
    });

    it('answers 500 when the upstream fails or is unreachable', async () => {
        const failing = await silenced(() => callWith(async () => new Response('busy', { status: 503 })));
        assert.equal(failing.statusCode, 500);
        assert.deepEqual(failing.body, { error: 'API responded with status: 503' });
        const limited = await silenced(() => callWith(upstreamAnswer(429, UPSTREAM_SERVICE_LIMIT)));
        assert.equal(limited.statusCode, 500);
        assert.equal('code' in limited.body, false);
        const down = await silenced(() => callWith(async () => { throw new Error('network down'); }));
        assert.equal(down.statusCode, 500);
        assert.match(down.body.error, /network down/);
    });

    it('reports missing API key when only the endpoint is unset', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        delete process.env.IPCHECKING_API_ENDPOINT;
        globalThis.fetch = async () => assert.fail('no upstream call');
        const res = createResponse();
        await ipcheckIngHandler(createRequest({ query: { ip: '1.1.1.1' } }), res);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { error: 'API key is missing' });
    });

    it('encodes lang and sends the listed caller headers', async () => {
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.test';
        let called;
        globalThis.fetch = async (url, init) => {
            called = { url: new URL(String(url)), init };
            return new Response(JSON.stringify(geo), { status: 200 });
        };
        const res = signedIn(createResponse());
        await ipcheckIngHandler(withVisitorHeaders(createRequest({ query: { ip: '1.1.1.1', lang: 'en&ip=10.0.0.1' } })), res);
        assert.equal(res.statusCode, 200);
        assert.equal(called.url.pathname, '/ipinfo');
        assert.equal(called.url.searchParams.get('key'), 'test-key');
        assert.deepEqual(called.url.searchParams.getAll('ip'), ['1.1.1.1']);
        assert.equal(called.url.searchParams.get('lang'), 'en&ip=10.0.0.1');
        assertForwardedHeaders(called.init.headers, END_USER);

        await ipcheckIngHandler(withVisitorHeaders(createRequest({ query: { ip: '1.1.1.1' } })), createResponse());
        assertForwardedHeaders(called.init.headers);
    });
});

// -- asn-profile handler ---------------------------------------------------
// Composition and deadlines are covered in tests/asn-profile-aggregate.test.js;
// here: unconfigured sources read as disabled, failing upstreams as error,
// a partial Radar answer, the local PeeringDB section, and the reputation
// request to the IPCheck.ing API, which carries no visitor header.

describe('asn-profile handler', () => {
    it('answers 200 with per-section statuses when only some sources work', async () => {
        delete process.env.CLOUDFLARE_API_KEY;
        delete process.env.CLOUDFLARE_API;
        delete process.env.IPCHECKING_API_KEY;
        delete process.env.IPCHECKING_API_ENDPOINT;
        globalThis.fetch = async () => { throw new Error('network down'); };
        const res = createResponse();
        await asnProfileHandler(createRequest({ query: { asn: '64511' } }), res);

        // With the network down, the local CAIDA graph is the one source that
        // can answer — when this checkout has an as-rel snapshot. Without one
        // (CI, a fresh checkout) connectivity is an error too, every
        // configured source has failed, and the answer is a 502.
        if (!isAsRelLoaded()) {
            assert.equal(res.statusCode, 502);
            assert.equal(res.body.status.connectivity, 'error');
            return;
        }
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.asn, 64511);
        assert.equal(res.body.status.radar, 'disabled');
        assert.equal(res.body.status.prefixes, 'disabled');
        assert.equal(res.body.status.reputation, 'disabled');
        assert.equal(res.body.status.whois, 'error');
        assert.equal(res.body.status.rank, 'error');
        assert.ok(['ok', 'empty'].includes(res.body.status.connectivity));
        assert.equal(res.body.whois, null);
        assert.equal(res.body.rank, null);
        // No Cloudflare key: PeeringDB isn't configured here.
        assert.equal(res.body.status.peeringdb, 'disabled');
    });

    it('PeeringDB: disabled only when unconfigured; configured but not loaded is an error', () => {
        assert.equal(peeringdbReadiness({ configured: () => false, loaded: () => false })(), false);
        assert.equal(peeringdbReadiness({ configured: () => true, loaded: () => true })(), true);
        assert.throws(() => peeringdbReadiness({ configured: () => true, loaded: () => false })(), /not loaded/);
    });

    it('connectivity: no as-rel snapshot is an error; as2org matters only while loading', async () => {
        const fetch = async () => 'graph';
        const missingRel = connectivityReadiness({ relLoaded: () => false, orgLoaded: () => true, fetch });
        assert.throws(() => missingRel(13335), /as-rel snapshot not loaded/);
        // as2org failed after boot: RIPEstat names the nodes, the graph is served.
        const noOrg = connectivityReadiness({ relLoaded: () => true, orgLoaded: () => false, fetch });
        assert.equal(await noOrg(13335), 'graph');
    });

    it('shows a partial Radar summary but flags it incomplete (not cacheable)', async () => {
        process.env.CLOUDFLARE_API_KEY = 'test-key';
        delete process.env.IPCHECKING_API_KEY;
        delete process.env.IPCHECKING_API_ENDPOINT;
        globalThis.fetch = async (url) => {
            const { hostname, pathname } = new URL(String(url));
            if (hostname !== 'api.cloudflare.com') throw new Error('network down');
            if (pathname.endsWith('/radar/entities/asns/64511')) {
                return new Response(JSON.stringify({ result: { asn: { name: 'EXAMPLE-NET' } } }));
            }
            if (pathname.endsWith('/radar/bgp/routes/pfx2as')) {
                return new Response(JSON.stringify({ result: { prefix_origins: [] } }));
            }
            return new Response('busy', { status: 503 });
        };
        const originalWarn = logger.warn;
        logger.warn = () => {};
        try {
            const res = createResponse();
            await asnProfileHandler(createRequest({ query: { asn: '64511' } }), res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.status.radar, 'ok');
            assert.equal(res.body.radar.asnName, 'EXAMPLE-NET');
            assert.equal(res.body.status.prefixes, 'empty');
            assert.deepEqual(res.body.incomplete, ['radar']);
            assert.equal(isCompleteProfile(res.body), false);
        } finally {
            logger.warn = originalWarn;
        }
    });

    it('asks the IPCheck.ing API for reputation without any visitor header', async () => {
        delete process.env.CLOUDFLARE_API_KEY;
        delete process.env.CLOUDFLARE_API;
        process.env.IPCHECKING_API_KEY = 'test-key';
        process.env.IPCHECKING_API_ENDPOINT = 'https://upstream.invalid';
        const payload = {
            found: true, ratio: { abuse: 1.2, vpn: 0.4 }, level: 'none',
            dropListed: false, proxy: 0, updatedAt: '2026-10-03T11:54:33.740Z',
        };
        let requested;
        globalThis.fetch = async (url, options) => {
            const { hostname, pathname } = new URL(String(url));
            if (hostname === 'upstream.invalid' && pathname === '/asnreputation') {
                requested = { url: new URL(String(url)), options };
                return { status: 200, ok: true, json: async () => payload };
            }
            throw new Error('network down');
        };
        const req = withVisitorHeaders(createRequest({ query: { asn: '64511' } }));
        const res = createResponse();
        await asnProfileHandler(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.status.reputation, 'ok');
        assert.deepEqual(res.body.reputation, payload);
        assert.equal(requested.url.searchParams.get('asn'), '64511');
        assert.equal(requested.url.searchParams.get('key'), 'test-key');
        assert.deepEqual(requested.options.headers, {});
    });
});

// -- ip-sb normalizer -----------------------------------------------------
// Pure transform, no fetch involved.

describe('ip-sb normalize', () => {
    it('prefixes the ASN', () => {
        assert.equal(modifyJsonForIPSB({ ip: '203.0.113.7', asn: 64500 }).asn, 'AS64500');
    });

    it('answers N/A when the upstream sends no ASN', () => {
        assert.equal(modifyJsonForIPSB({ ip: '203.0.113.7' }).asn, 'N/A');
        assert.equal(modifyJsonForIPSB({ ip: '203.0.113.7', asn: null }).asn, 'N/A');
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
        const out = modifyJsonForIpinfoio({
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
        const out = modifyJsonForIpinfoio({
            ip: '104.28.212.153', city: 'Los Angeles', country: 'US', org: 'AS13335 Cloudflare, Inc.',
        });
        assert.equal(out.latitude, null);
        assert.equal(out.longitude, null);
        assert.equal(out.asn, 'AS13335');
    });

    it('degrades a partial or non-numeric loc to null', () => {
        assert.equal(modifyJsonForIpinfoio({ loc: '37.4056' }).longitude, null);
        assert.equal(modifyJsonForIpinfoio({ loc: '' }).latitude, null);
        assert.equal(modifyJsonForIpinfoio({ loc: 'unknown,unknown' }).latitude, null);
        assert.equal(modifyJsonForIpinfoio({ loc: ',-122.0775' }).latitude, null);
        // 0 is a real coordinate, not a blank one.
        assert.equal(modifyJsonForIpinfoio({ loc: '0,0' }).latitude, 0);
    });

    it('empties asn / org when the upstream omits org', () => {
        const out = modifyJsonForIpinfoio({ ip: '8.8.8.8', country: 'US', loc: '37.4,-122.0' });
        assert.equal(out.asn, '');
        assert.equal(out.org, '');
    });

    it('uses ICU country names and accepts lowercase upstream codes', () => {
        assert.equal(modifyJsonForIpinfoio({ country: 'TR' }).country_name, 'Türkiye');
        assert.equal(modifyJsonForIpinfoio({ country: 'us' }).country_name, 'United States');
    });

    it('falls back to Unknown Country for absent, unknown or malformed codes', () => {
        for (const country of [undefined, null, '', 'XX', 'ZZ', 'T1', 'USA', 123, {}]) {
            assert.equal(modifyJsonForIpinfoio({ country }).country_name, 'Unknown Country');
        }
    });

    it('survives a bogon payload and still emits the canonical shape', () => {
        // ipinfo.io answers {"ip":…,"bogon":true} — no loc, org or country.
        const out = modifyJsonForIpinfoio({ ip: '192.0.2.1', bogon: true });
        assert.equal(out.ip, '192.0.2.1');
        for (const key of CANONICAL_KEYS) {
            assert.ok(key in out, `${key} must stay present in the response`);
        }
    });

    it('survives an empty or null upstream body', () => {
        for (const payload of [{}, null, undefined]) {
            const out = modifyJsonForIpinfoio(payload);
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
        assert.equal(out.extended.lineType, 'hosting');
        assert.equal('isHosting' in out, false);
        assert.equal('isProxy' in out, false);
    });

    it('falls back to N/A when the upstream places no location', () => {
        // Anycast / bogon addresses come back 200 with location: null.
        const out = modifyJsonForIPAPI({ ip: '104.28.212.153', location: null });
        assert.equal(out.ip, '104.28.212.153');
        for (const key of ['city', 'region', 'country', 'country_name', 'country_code', 'latitude', 'longitude']) {
            assert.equal(out[key], 'N/A', `${key} should degrade to N/A`);
        }
        assert.equal(out.asn, 'N/A');
        assert.equal(out.extended, undefined);
    });

    it('sums the vpn / tor bits up as a plain anonymizer yes', () => {
        const detected = { anonymity: { code: 'detected' } };
        assert.deepEqual(modifyJsonForIPAPI({ location: {}, is_vpn: true }).extended, detected);
        assert.deepEqual(modifyJsonForIPAPI({ location: {}, is_tor: true }).extended, detected);
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
