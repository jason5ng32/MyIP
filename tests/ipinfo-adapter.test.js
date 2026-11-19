// Tests for api/ipinfo-io.js — the lookup API's base fields and `extended` block, and the legacy-token fallback.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import handler, { modifyLookupJson } from '../api/ipinfo-io.js';
import logger from '../server/logger.js';

const NO_ANONYMITY = { is_proxy: false, is_relay: false, is_tor: false, is_vpn: false, is_res_proxy: false };

const geo = (extra = {}) => ({
    city: 'Sampleton', country: 'Singapore', country_code: 'SG', continent: 'Asia', continent_code: 'AS',
    latitude: 1.25, longitude: 103.5, timezone: 'Asia/Singapore', postal_code: '000000',
    geoname_id: '1000001', radius: 50, last_changed: '2026-01-02',
    ...extra,
});

const asOf = (extra = {}) => ({
    asn: 'AS64500', name: 'Example Cloud', domain: 'example.com', type: 'hosting', last_changed: '2025-03-04',
    ...extra,
});

const lookup = (extra = {}) => ({
    ip: '203.0.113.10', hostname: 'host.example.com', geo: geo(), place: {}, as: asOf(), mobile: {},
    anonymous: { ...NO_ANONYMITY }, is_place: false, is_anonymous: false, is_anycast: false,
    is_hosting: true, is_mobile: false, is_satellite: false,
    ...extra,
});

const vpn = lookup({
    ip: '203.0.113.20', hostname: undefined,
    geo: geo({ region: 'North Example', region_code: 'NE' }),
    as: asOf({ type: 'isp', name: 'Example Lines' }),
    anonymous: { name: 'Example VPN', last_seen: '2026-01-01', ...NO_ANONYMITY, is_vpn: true },
    is_anonymous: true, is_hosting: false,
});

const mobile = lookup({
    ip: '203.0.113.30', hostname: 'mobile.example.net',
    geo: geo({ region: 'North Example', region_code: 'NE', dma_code: '501' }),
    as: asOf({ type: 'isp', name: 'Example Mobile' }),
    mobile: { name: 'Example Mobile', mcc: '999', mnc: '01' },
    is_hosting: false, is_mobile: true,
});

const withoutExtended = ({ extended, ...rest }) => rest;

describe('ipinfo-io lookup normalize', () => {
    it('reads the base fields from geo and as', () => {
        const out = modifyLookupJson(lookup());
        assert.deepEqual(withoutExtended(out), {
            ip: '203.0.113.10', city: 'Sampleton', region: null, country: 'SG', country_name: 'Singapore',
            country_code: 'SG', latitude: 1.25, longitude: 103.5, asn: 'AS64500', org: 'Example Cloud',
        });
    });

    it('maps a hosting answer to what the card shows', () => {
        const out = modifyLookupJson(lookup());
        assert.deepEqual(out.extended, { lineType: 'hosting', anonymity: { code: 'none' } });
        assert.ok(isValidExtended(out.extended));
    });

    it('maps a VPN exit to a plain anonymizer yes on an ISP line, without the provider', () => {
        const out = modifyLookupJson(vpn);
        assert.equal(out.region, 'North Example');
        assert.equal(out.org, 'Example Lines');
        assert.deepEqual(out.extended, { lineType: 'residential', anonymity: { code: 'detected' } });
        assert.ok(isValidExtended(out.extended));
    });

    it('maps a mobile answer to a wireless line', () => {
        const out = modifyLookupJson(mobile);
        assert.deepEqual(out.extended, { lineType: 'wireless', anonymity: { code: 'none' } });
        assert.ok(isValidExtended(out.extended));
    });

    it('maps as.type to a line type after the hosting and mobile bits', () => {
        const typeOf = (type) => modifyLookupJson(lookup({ is_hosting: false, as: asOf({ type }) })).extended.lineType;
        assert.equal(typeOf('isp'), 'residential');
        assert.equal(typeOf('business'), 'business');
        assert.equal(typeOf('education'), 'business');
        assert.equal(typeOf('government'), 'business');
        assert.equal(typeOf('hosting'), 'hosting');
        assert.equal(typeOf('other'), undefined);
    });

    it('answers yes for is_anonymous or any anonymity bit, no when all say no', () => {
        for (const bit of ['is_vpn', 'is_proxy', 'is_tor', 'is_relay', 'is_res_proxy']) {
            const out = modifyLookupJson(lookup({ anonymous: { ...NO_ANONYMITY, [bit]: true } }));
            assert.equal(out.extended.anonymity.code, 'detected', bit);
            assert.ok(isValidExtended(out.extended));
        }
        const top = modifyLookupJson(lookup({ is_anonymous: true }));
        assert.equal(top.extended.anonymity.code, 'detected');
        assert.equal(modifyLookupJson(lookup()).extended.anonymity.code, 'none');
    });

    it('emits no anonymizer answer without the inputs, keeping the base answer', () => {
        const out = modifyLookupJson(lookup({ anonymous: undefined, is_anonymous: undefined }));
        assert.equal(out.asn, 'AS64500');
        assert.deepEqual(out.extended, { lineType: 'hosting' });
    });

    it('handles a minimal answer with no extras', () => {
        const out = modifyLookupJson({
            ip: '203.0.113.40', geo: { city: 'Sampleton', country_code: 'SG', latitude: 1.25, longitude: 103.5 },
            as: { asn: 'AS64500', name: 'Example Net' },
        });
        assert.deepEqual(out, {
            ip: '203.0.113.40', city: 'Sampleton', region: null, country: 'SG', country_name: 'Singapore',
            country_code: 'SG', latitude: 1.25, longitude: 103.5, asn: 'AS64500', org: 'Example Net',
        });
    });

    it('treats empty objects and empty strings as no value', () => {
        const out = modifyLookupJson({
            ip: '203.0.113.50', hostname: '', geo: {}, as: {}, place: {}, mobile: {}, anonymous: { name: '' },
        });
        assert.deepEqual(out, {
            ip: '203.0.113.50', city: null, region: null, country: null, country_name: 'Unknown Country',
            country_code: null, latitude: null, longitude: null, asn: '', org: '',
        });
    });

    it('survives an empty or null body', () => {
        for (const body of [{}, null, undefined, []]) {
            const out = modifyLookupJson(body);
            assert.equal(out.ip, null);
            assert.equal('extended' in out, false);
        }
    });
});

// -- handler: lookup API, legacy fallback ---------------------------------

describe('ipinfo-io handler', () => {
    const originalFetch = globalThis.fetch;
    const originalError = logger.error;
    const envBackup = {};
    let calls;
    let logged;
    let tokenCounter = 0;

    // A fresh token per test, so the remembered legacy set never leaks between tests.
    const useToken = () => {
        tokenCounter += 1;
        const token = `tok${tokenCounter}example`;
        process.env.IPINFO_API_KEY = token;
        return token;
    };

    const stubFetch = (respond) => {
        globalThis.fetch = async (url, init = {}) => {
            const call = { url: String(url), headers: init.headers || {} };
            calls.push(call);
            return respond(call);
        };
    };

    const mockRes = () => ({
        statusCode: 200, body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    });

    const run = async () => {
        const res = mockRes();
        await handler({ query: { ip: '203.0.113.10' } }, res);
        return res;
    };

    const LEGACY = { ip: '203.0.113.10', city: 'Sampleton', country: 'SG', loc: '1.25,103.5', org: 'AS64500 Example Net' };
    const isLookup = (call) => call.url.startsWith('https://api.ipinfo.io/lookup/');

    beforeEach(() => {
        for (const key of ['IPINFO_API_KEY', 'IPINFO_API_TOKEN']) envBackup[key] = process.env[key];
        delete process.env.IPINFO_API_TOKEN;
        calls = [];
        logged = [];
        logger.error = (...args) => { logged.push(args); };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        logger.error = originalError;
        for (const [key, value] of Object.entries(envBackup)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    it('asks the lookup API with the token in a Bearer header, not the URL', async () => {
        const token = useToken();
        stubFetch(() => Response.json(lookup()));
        const res = await run();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://api.ipinfo.io/lookup/203.0.113.10');
        assert.equal(calls[0].url.includes(token), false);
        assert.equal(calls[0].headers.Authorization, `Bearer ${token}`);
        assert.equal(res.body.asn, 'AS64500');
        assert.ok(isValidExtended(res.body.extended));
    });

    it('falls back to the legacy endpoint on 403 and remembers the token', async () => {
        const token = useToken();
        stubFetch((call) => (isLookup(call)
            ? Response.json({ error: 'refused' }, { status: 403 })
            : Response.json(LEGACY)));

        const first = await run();
        assert.equal(calls.length, 2);
        assert.ok(isLookup(calls[0]));
        assert.equal(calls[1].url, `https://ipinfo.io/203.0.113.10?token=${token}`);
        assert.equal(first.statusCode, 200);
        assert.equal(first.body.asn, 'AS64500');
        assert.equal(first.body.org, 'Example Net');
        assert.equal('extended' in first.body, false);

        calls = [];
        const second = await run();
        assert.equal(calls.length, 1);
        assert.equal(isLookup(calls[0]), false);
        assert.deepEqual(second.body, first.body);
        assert.equal(logged.length, 0);
    });

    for (const status of [500, 502, 429, 401]) {
        it(`does not fall back on ${status}`, async () => {
            useToken();
            stubFetch(() => new Response('nope', { status }));
            const res = await run();
            assert.equal(calls.length, 1);
            assert.ok(isLookup(calls[0]));
            assert.equal(res.statusCode, 500);
            assert.deepEqual(res.body, { error: `Upstream responded ${status}` });

            calls = [];
            await run();
            assert.ok(isLookup(calls[0]), 'the token is not remembered as legacy');
        });
    }

    it('does not fall back on a network error, and keeps the token out of the log', async () => {
        const token = useToken();
        stubFetch(() => { throw new Error('socket hang up'); });
        const res = await run();
        assert.equal(calls.length, 1);
        assert.equal(res.statusCode, 500);
        assert.equal(logged.length, 1);
        assert.equal(JSON.stringify(logged[0], (key, value) => (value instanceof Error ? value.message : value))
            .includes(token), false);
        assert.equal(logged[0][0].ip, '203.0.113.10');
    });

    it('keeps the token out of the log when the legacy endpoint fails', async () => {
        const token = useToken();
        stubFetch((call) => new Response('x', { status: isLookup(call) ? 403 : 503 }));
        const res = await run();
        assert.equal(calls.length, 2);
        assert.equal(res.statusCode, 500);
        assert.equal(JSON.stringify(logged[0], (key, value) => (value instanceof Error ? `${value.message} ${value.stack}` : value))
            .includes(token), false);
    });

    it('uses the legacy endpoint unauthenticated when no token is configured', async () => {
        delete process.env.IPINFO_API_KEY;
        stubFetch(() => Response.json(LEGACY));
        const res = await run();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, 'https://ipinfo.io/203.0.113.10');
        assert.equal(calls[0].headers.Authorization, undefined);
        assert.equal(res.body.country_name, 'Singapore');
    });
});
