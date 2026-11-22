// Tests for api/iplocate.js — the base geo fields and the `extended` block, on invented answers in the upstream's shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import { modifyJsonForIPLocate } from '../api/iplocate.js';

const PRIVACY = {
    is_abuser: false, is_anonymous: false, is_bogon: false, is_hosting: false,
    is_icloud_relay: false, is_proxy: false, is_tor: false, is_vpn: false,
};

const full = {
    ip: '203.0.113.10',
    country: 'Exampleland',
    country_code: 'XE',
    is_eu: false,
    city: 'Sampleton',
    continent: 'Europe',
    latitude: 12.5,
    longitude: 34.25,
    time_zone: 'Etc/UTC',
    postal_code: '00000',
    subdivision: 'North Example',
    currency_code: 'XTS',
    calling_code: '99',
    is_anycast: false,
    is_satellite: false,
    asn: {
        asn: 'AS64500', route: '203.0.113.0/24', netname: 'EXAMPLE-NET', name: 'Example Net Ltd',
        country_code: 'XE', domain: 'example.net', type: 'isp', rir: 'RIPE',
    },
    privacy: { ...PRIVACY, is_anonymous: true, is_hosting: true, is_vpn: true },
    company: { name: 'Example Cloud', domain: 'example.com', country_code: 'XE', type: 'business' },
    abuse: { address: '1 Example Street', country_code: 'XE', email: 'abuse@example.net', name: 'Abuse Desk', network: '203.0.113.0/24', phone: '+99 555 0100' },
    hosting: { provider: 'Example Hosting', domain: 'hosting.example', network: '203.0.113.0/24' },
};

const residential = {
    ip: '198.51.100.30',
    country: 'Exampleland',
    country_code: 'XE',
    city: 'Sampleton',
    latitude: 1.5,
    longitude: 2.5,
    subdivision: 'South Example',
    asn: { asn: 'AS64501', name: 'Example Broadband', type: 'isp' },
    privacy: { ...PRIVACY },
    company: { name: 'Example Broadband', type: 'isp' },
};

describe('iplocate adapter — base fields', () => {
    it('maps a full answer to the ten base fields', () => {
        const { extended, ...base } = modifyJsonForIPLocate(full);
        assert.deepEqual(base, {
            ip: '203.0.113.10', city: 'Sampleton', region: 'North Example', country: 'XE',
            country_name: 'Exampleland', country_code: 'XE', latitude: 12.5, longitude: 34.25,
            asn: 'AS64500', org: 'Example Net Ltd',
        });
        assert.ok(extended);
    });

    it('keeps the AS prefix single and accepts a bare number', () => {
        const asnOf = (asn) => modifyJsonForIPLocate({ ...residential, asn: { asn } }).asn;
        assert.equal(asnOf('AS64500'), 'AS64500');
        assert.equal(asnOf('as64500'), 'AS64500');
        assert.equal(asnOf(64500), 'AS64500');
        assert.equal(asnOf('64500'), 'AS64500');
        for (const value of [undefined, null, '', 'ASX', {}]) assert.equal(asnOf(value), 'N/A', JSON.stringify(value));
    });

    it('answers a minimal payload with N/A and no extended block', () => {
        const out = modifyJsonForIPLocate({ ip: '203.0.113.40' });
        assert.equal(out.ip, '203.0.113.40');
        for (const key of ['city', 'region', 'country', 'country_name', 'country_code', 'latitude', 'longitude', 'asn', 'org']) {
            assert.equal(out[key], 'N/A', key);
        }
        assert.equal('extended' in out, false);
    });

    it('tolerates null nested objects', () => {
        const out = modifyJsonForIPLocate({ ...full, asn: null, privacy: null, company: null, hosting: null });
        assert.equal(out.asn, 'N/A');
        assert.equal(out.org, 'N/A');
        assert.equal(out.city, 'Sampleton');
        assert.equal('extended' in out, false);
    });

    it('keeps a coordinate of 0', () => {
        const out = modifyJsonForIPLocate({ ...full, latitude: 0, longitude: 0 });
        assert.equal(out.latitude, 0);
        assert.equal(out.longitude, 0);
    });
});

describe('iplocate adapter — extended', () => {
    it('maps a hosting VPN answer to what the card shows', () => {
        const { extended } = modifyJsonForIPLocate(full);
        assert.deepEqual(extended, { lineType: 'hosting', anonymity: { code: 'detected' }, abuse: 'none' });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a residential answer with every privacy bit off', () => {
        const { extended } = modifyJsonForIPLocate(residential);
        assert.deepEqual(extended, { lineType: 'residential', anonymity: { code: 'none' }, abuse: 'none' });
        assert.equal(isValidExtended(extended), true);
    });

    it('reads company.type first, then asn.type', () => {
        const typed = (company, asn) => modifyJsonForIPLocate({ ...residential, company, asn }).extended?.lineType;
        assert.equal(typed({ type: 'business' }, { type: 'isp' }), 'business');
        assert.equal(typed({ type: 'something-new' }, { type: 'hosting' }), 'hosting');
        assert.equal(typed(null, { type: 'isp' }), 'residential');
        for (const type of ['education', 'government']) assert.equal(typed({ type }, null), 'business');
        assert.equal(typed({ type: 'something-new' }, { type: '' }), undefined);
    });

    it('answers yes for any anonymizer bit', () => {
        for (const bit of ['is_vpn', 'is_proxy', 'is_tor', 'is_icloud_relay', 'is_anonymous']) {
            const { extended } = modifyJsonForIPLocate({ ...residential, privacy: { ...PRIVACY, [bit]: true } });
            assert.equal(extended.anonymity.code, 'detected', bit);
            assert.ok(isValidExtended(extended));
        }
    });

    it('reads abuse as a plain yes / no from is_abuser', () => {
        const yes = modifyJsonForIPLocate({ ...residential, privacy: { ...PRIVACY, is_abuser: true } }).extended;
        assert.equal(yes.abuse, 'detected');
        assert.ok(isValidExtended(yes));
    });

    it('skips empty strings and nulls everywhere', () => {
        const out = modifyJsonForIPLocate({
            ip: '203.0.113.50', country: '', country_code: '', city: '', subdivision: '',
            latitude: null, longitude: null,
            asn: { asn: '', name: '', type: '' },
            privacy: { is_vpn: null, is_hosting: '', is_abuser: null },
            company: { name: '', type: '' },
        });
        for (const key of ['city', 'region', 'country', 'country_name', 'country_code', 'latitude', 'longitude', 'asn', 'org']) {
            assert.equal(out[key], 'N/A', key);
        }
        assert.equal('extended' in out, false);
    });
});
