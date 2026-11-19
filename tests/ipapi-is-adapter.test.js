// Tests for api/ipapi-is.js — the base geo fields and the `extended` block, on invented answers in the upstream's shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import { modifyJsonForIPAPI } from '../api/ipapi-is.js';

const BASE_FLAGS = {
    is_bogon: false, is_mobile: false, is_satellite: false, is_anycast: false, is_crawler: false,
    is_datacenter: false, is_tor: false, is_proxy: false, is_vpn: false, is_abuser: false,
};

const location = (extra = {}) => ({
    is_eu_member: false, calling_code: '99', currency_code: 'XTS', continent: 'EU',
    country: 'Exampleland', country_code: 'XE', state: 'North Example', city: 'Sampleton',
    latitude: 12.5, longitude: 34.25, zip: '00000', timezone: 'Etc/UTC',
    local_time: '2026-01-01T00:00:00+00:00', local_time_unix: 1767225600, is_dst: false, utcoffset: '+00:00',
    ...extra,
});

const asn = (extra = {}) => ({
    asn: 64500, abuser_score: '0.001 (Low)', route: '203.0.113.0/24', descr: 'EXAMPLE-AS - Example Net, XE',
    country: 'xe', active: true, org: 'Example Net', domain: 'example.net', abuse: 'abuse@example.net',
    type: 'hosting', created: '2010-01-02', updated: '2025-03-04', rir: 'RIPE',
    ...extra,
});

const full = {
    ip: '203.0.113.10',
    rir: 'RIPE',
    ...BASE_FLAGS,
    is_datacenter: true,
    is_proxy: true,
    datacenter: { datacenter: 'Example Cloud', domain: 'example.com', network: '203.0.113.0 - 203.0.113.255' },
    company: {
        name: 'Example Cloud Ltd', abuser_score: '0.002 (Low)', domain: 'example.com', type: 'hosting',
        network: '203.0.113.0 - 203.0.113.127', netname: 'EXAMPLE-NET',
    },
    abuse: { name: 'Example Cloud Ltd', address: '1 Example Street, Sampleton', email: 'abuse@example.com', phone: '' },
    asn: asn(),
    location: location({ accuracy: 'MEDIUM' }),
};

const vpn = {
    ip: '203.0.113.20',
    rir: 'RIPE',
    ...BASE_FLAGS,
    is_datacenter: true,
    is_vpn: true,
    vpn: {
        ip: '203.0.113.20', service: 'Example VPN', url: 'https://vpn.example', type: 'exit_node',
        last_seen: 1767225600000, last_seen_str: '2026-01-01T00:00:00.000Z', exit_node_region: 'Exampleland',
        country_code: 'XE', city_name: 'Sampleton', latitude: 12.5, longitude: 34.25,
    },
    datacenter: { datacenter: 'example.org', network: '203.0.113.0/24', country: 'XE', region: 'XE-01', city: 'Sampleton' },
    company: {
        name: 'Example Lines', abuser_score: '0.04 (High)', domain: 'example.org', type: 'isp',
        network: '203.0.113.0 - 203.0.113.255', netname: 'EXAMPLE-LINES',
    },
    abuse: { name: 'Example Abuse Desk', address: '2 Example Road', email: 'report@example.org', phone: '+99 555 0100' },
    asn: asn({ asn: 64501 }),
    location: location({ accuracy: 'VERY_HIGH' }),
};

const mobile = {
    ip: '198.51.100.30',
    rir: 'ARIN',
    ...BASE_FLAGS,
    is_mobile: true,
    company: {
        name: 'Example Mobile', abuser_score: '0 (Very Low)', domain: 'mobile.example', type: 'isp',
        network: '198.51.100.0 - 198.51.100.255', netname: 'EXAMPLE-MOBILE',
    },
    abuse: { name: 'Example Mobile', address: '3 Example Avenue', email: 'abuse@mobile.example', phone: '+99 555 0101' },
    asn: asn({ asn: 64502, type: 'isp', route: '198.51.100.0/24', domain: 'mobile.example', rir: 'ARIN' }),
    location: location(),
};

describe('ipapi-is adapter — base fields', () => {
    it('keeps the ten base fields and nothing legacy', () => {
        const out = modifyJsonForIPAPI(full);
        const { extended, ...base } = out;
        assert.deepEqual(base, {
            ip: '203.0.113.10', city: 'Sampleton', region: 'North Example', country: 'XE',
            country_name: 'Exampleland', country_code: 'XE', latitude: 12.5, longitude: 34.25,
            asn: 'AS64500', org: 'Example Net',
        });
        assert.ok(extended);
    });

    it('answers a key-less, bare payload with the base fields only', () => {
        const out = modifyJsonForIPAPI({ ip: '203.0.113.40', location: null });
        assert.equal(out.asn, 'N/A');
        assert.equal(out.city, 'N/A');
        assert.equal('extended' in out, false);
    });
});

describe('ipapi-is adapter — extended', () => {
    it('maps a full data-centre answer to what the card shows', () => {
        const { extended } = modifyJsonForIPAPI(full);
        assert.deepEqual(extended, {
            lineType: 'hosting',
            anonymity: { code: 'detected' },
            abuse: 'none',
            metrics: [{ id: 'abuserScore', value: '0.002 (Low)' }],
        });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a VPN answer to a plain anonymizer yes, without the provider', () => {
        const { extended } = modifyJsonForIPAPI(vpn);
        assert.deepEqual(extended, {
            lineType: 'hosting',
            anonymity: { code: 'detected' },
            abuse: 'none',
            metrics: [{ id: 'abuserScore', value: '0.04 (High)' }],
        });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a mobile answer to wireless even when company.type says isp', () => {
        const { extended } = modifyJsonForIPAPI(mobile);
        assert.equal(isValidExtended(extended), true);
        assert.equal(extended.lineType, 'wireless');
        assert.deepEqual(extended.anonymity, { code: 'none' });
        assert.equal(extended.abuse, 'none');
    });

    it('reads company.type when neither data-centre nor mobile', () => {
        const typed = (type) => modifyJsonForIPAPI({ ...mobile, is_mobile: false, company: { type } }).extended.lineType;
        assert.equal(typed('isp'), 'residential');
        for (const type of ['business', 'education', 'government', 'banking']) assert.equal(typed(type), 'business');
        assert.equal(typed('hosting'), 'hosting');
        assert.equal(typed('something-new'), undefined);
    });

    it('answers yes for any of tor, vpn and proxy, no when all three say no', () => {
        for (const bit of ['is_tor', 'is_vpn', 'is_proxy']) {
            const { extended } = modifyJsonForIPAPI({ ...mobile, [bit]: true });
            assert.equal(extended.anonymity.code, 'detected', bit);
            assert.ok(isValidExtended(extended));
        }
        const { extended } = modifyJsonForIPAPI(mobile);
        assert.equal(extended.anonymity.code, 'none');
    });

    it('reads abuse as a plain yes / no from is_abuser', () => {
        const yes = modifyJsonForIPAPI({ ...mobile, is_abuser: true }).extended;
        assert.equal(yes.abuse, 'detected');
        assert.ok(isValidExtended(yes));
        assert.equal(modifyJsonForIPAPI(mobile).extended.abuse, 'none');
    });

    it('emits no code or abuse without the inputs, keeping the base answer', () => {
        const out = modifyJsonForIPAPI({ ip: '203.0.113.60', location: location(), asn: asn(), company: { type: 'isp' } });
        assert.equal(out.city, 'Sampleton');
        assert.equal(out.asn, 'AS64500');
        assert.equal('anonymity' in out.extended, false);
        assert.equal('abuse' in out.extended, false);
        assert.deepEqual(out.extended, { lineType: 'residential' });
        assert.ok(isValidExtended(out.extended));
    });

    it('takes the abuser score as worded, and drops it when missing or malformed', () => {
        const scored = (abuser_score) => modifyJsonForIPAPI({ ...mobile, company: { abuser_score } }).extended.metrics;
        assert.deepEqual(scored(' 0.5 (High) '), [{ id: 'abuserScore', value: '0.5 (High)' }]);
        for (const value of [undefined, '', null, {}, 'x'.repeat(200)]) {
            assert.equal(scored(value), undefined, JSON.stringify(value));
        }
    });

    it('skips empty strings, nulls and empty objects everywhere', () => {
        const out = modifyJsonForIPAPI({
            ip: '203.0.113.50',
            rir: '',
            is_datacenter: null,
            is_crawler: '',
            vpn: { service: '  ', type: '', url: null },
            datacenter: {},
            company: { name: '', type: '', abuser_score: '' },
            abuse: { name: '', email: '', phone: '', address: '' },
            asn: { asn: 64503, org: '', descr: '', route: null },
            location: { city: '', accuracy: '' },
        });
        assert.equal(out.city, 'N/A');
        assert.equal(out.org, 'N/A');
        assert.equal(out.asn, 'AS64503');
        assert.equal('extended' in out, false);
    });
});
