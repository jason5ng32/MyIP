// Tests for api/ipapi-com.js — the base geo fields and the `extended` block, on invented answers in the upstream's shape.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import handler, { modifyJsonForIpApiCom } from '../api/ipapi-com.js';

const answer = (extra = {}) => ({
    query: '203.0.113.10', status: 'success',
    country: 'Exampleland', countryCode: 'XE', regionName: 'North Example', city: 'Sampleton',
    lat: 12.5, lon: 34.25, isp: 'Example Net', as: 'AS64500 Example Net Ltd',
    mobile: false, proxy: false, hosting: true,
    ...extra,
});

const BASE = {
    ip: '203.0.113.10', city: 'Sampleton', region: 'North Example', country: 'XE',
    country_name: 'Exampleland', country_code: 'XE', latitude: 12.5, longitude: 34.25,
    asn: 'AS64500', org: 'Example Net',
};

const withoutExtended = ({ extended, ...rest }) => rest;

describe('ipapi-com normalize', () => {
    it('keeps the base fields and adds the full extended block', () => {
        const out = modifyJsonForIpApiCom(answer());
        assert.deepEqual(withoutExtended(out), BASE);
        assert.deepEqual(out.extended, { lineType: 'hosting', anonymity: { code: 'none' } });
        assert.ok(isValidExtended(out.extended));
    });

    it('reads a proxy exit as a proxy on a hosting line, and the anonymizer as a yes', () => {
        const out = modifyJsonForIpApiCom(answer({ proxy: true }));
        assert.deepEqual(out.extended, { lineType: 'hosting', anonymity: { code: 'detected' } });
        assert.ok(isValidExtended(out.extended));
    });

    it('reads a mobile answer as wireless', () => {
        const out = modifyJsonForIpApiCom(answer({ mobile: true, hosting: false }));
        assert.deepEqual(out.extended, { lineType: 'wireless', anonymity: { code: 'none' } });
    });

    it('puts hosting before mobile', () => {
        assert.equal(modifyJsonForIpApiCom(answer({ mobile: true, hosting: true })).extended.lineType, 'hosting');
    });

    it('sets no line type when neither bit is set', () => {
        const out = modifyJsonForIpApiCom(answer({ hosting: false }));
        assert.equal('lineType' in out.extended, false);
        assert.ok(isValidExtended(out.extended));
    });

    it('emits no anonymizer answer without the proxy bit, keeping the base answer', () => {
        const out = modifyJsonForIpApiCom(answer({ proxy: undefined }));
        assert.deepEqual(withoutExtended(out), BASE);
        assert.deepEqual(out.extended, { lineType: 'hosting' });
    });

    it('drops the block when the mobile, proxy and hosting bits are all missing', () => {
        const out = modifyJsonForIpApiCom(answer({ mobile: undefined, proxy: undefined, hosting: undefined }));
        assert.equal('extended' in out, false);
        assert.deepEqual(out, BASE);
    });

    it('keeps the failed-lookup handling with no extended block', () => {
        const out = modifyJsonForIpApiCom({ status: 'fail', message: 'reserved range', query: '203.0.113.10' });
        assert.equal(out.ip, '203.0.113.10');
        assert.equal(out.asn, '');
        assert.equal('extended' in out, false);
    });
});

describe('ipapi-com handler', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    const mockRes = () => ({
        statusCode: 200, body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    });

    it('requests the fields by name and forwards lang', async () => {
        let requested;
        globalThis.fetch = async (url) => { requested = new URL(String(url)); return Response.json(answer()); };
        const res = mockRes();
        await handler({ query: { ip: '203.0.113.10', lang: 'de' } }, res);
        assert.equal(requested.origin + requested.pathname, 'http://ip-api.com/json/203.0.113.10');
        assert.equal(requested.searchParams.get('lang'), 'de');
        const fields = requested.searchParams.get('fields').split(',');
        assert.deepEqual(fields.sort(), [
            'query', 'country', 'countryCode', 'regionName', 'city', 'lat', 'lon', 'isp', 'as',
            'status', 'message', 'mobile', 'proxy', 'hosting',
        ].sort());
        assert.deepEqual(withoutExtended(res.body), BASE);
    });
});
