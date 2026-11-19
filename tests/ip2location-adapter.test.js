// Tests for api/ip2location-io.js — the base geo fields and the `extended` block, on invented answers in the upstream's shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import { modifyJsonForIp2Location } from '../api/ip2location-io.js';

const BASE = {
    ip: '203.0.113.10',
    country_code: 'XE',
    country_name: 'Exampleland',
    region_name: 'North Example',
    city_name: 'Sampleton',
    latitude: 12.5,
    longitude: 34.25,
    zip_code: '00000',
    time_zone: '+00:00',
    asn: '64500',
    as: 'Example Net',
    is_proxy: false,
};

const proxy = (extra = {}) => ({
    last_seen: 1, proxy_type: 'DCH', threat: '-', provider: '-',
    is_vpn: false, is_tor: false, is_data_center: true, is_public_proxy: false, is_web_proxy: false,
    is_web_crawler: false, is_ai_crawler: false, is_residential_proxy: false,
    is_consumer_privacy_network: false, is_enterprise_private_network: false,
    is_spammer: false, is_scanner: false, is_botnet: false, is_bogon: false,
    ...extra,
});

const encyclopedic = {
    district: 'Sample District',
    idd_code: '99', area_code: '000', weather_station_code: 'XEXX0001', weather_station_name: 'Sampleton',
    elevation: 10,
    continent: { name: 'Example', code: 'EX' },
    country: { name: 'Exampleland', population: 1000 },
    region: { name: 'North Example' },
    city: { name: 'Sampleton' },
    time_zone_info: { olson: 'Etc/UTC', sunrise: '06:00' },
    geotargeting: { metro: null },
};

const full = {
    ...BASE,
    ...encyclopedic,
    as_info: {
        as_number: '64500', as_name: 'Example Net', as_domain: 'example.net', as_usage_type: 'DCH', as_cidr: '203.0.113.0/24',
    },
    isp: 'Example Hosting SRL', domain: 'example.com', net_speed: 'T1',
    mcc: '-', mnc: '-', mobile_brand: '-',
    usage_type: 'DCH', address_type: 'Unicast', ads_category: '622', ads_category_name: 'Web Hosting',
    fraud_score: 3,
    proxy: proxy(),
};

const vpn = {
    ...full,
    ip: '203.0.113.20',
    is_proxy: true,
    fraud_score: 99,
    ads_category: undefined,
    ads_category_name: undefined,
    proxy: proxy({ proxy_type: 'VPN', provider: 'Example VPN', is_vpn: true, is_data_center: false }),
};

const mobile = {
    ...full,
    ip: '198.51.100.30',
    as_info: { ...full.as_info, as_usage_type: 'ISP' },
    isp: 'Example Mobile', domain: 'mobile.example', net_speed: 'DSL',
    mcc: '999', mnc: '010/020/030', mobile_brand: 'examplemobi',
    usage_type: 'MOB', ads_category_name: 'Internet Service Providers',
    fraud_score: 0,
    proxy: proxy({ last_seen: 0, proxy_type: '-', is_data_center: false }),
};

describe('ip2location-io adapter — base fields', () => {
    it('keeps the base fields', () => {
        const { extended, ...base } = modifyJsonForIp2Location(full);
        assert.deepEqual(base, {
            ip: '203.0.113.10', city: 'Sampleton', region: 'North Example', country: 'XE',
            country_name: 'Exampleland', country_code: 'XE', latitude: 12.5, longitude: 34.25,
            asn: 'AS64500', org: 'Example Net',
        });
        assert.ok(extended);
    });

    it('never prints AS[object Object] for a missing or odd asn', () => {
        for (const asn of [undefined, null, '', '-', {}, 'AS64500x']) {
            assert.equal(modifyJsonForIp2Location({ ...BASE, asn }).asn, 'N/A', `asn ${JSON.stringify(asn)}`);
        }
        assert.equal(modifyJsonForIp2Location({ ...BASE, asn: 64501 }).asn, 'AS64501');
        assert.equal(modifyJsonForIp2Location({ ...BASE, asn: ' 64502 ' }).asn, 'AS64502');
    });

    it('answers the lowest-plan payload with the base fields and only the anonymizer answer', () => {
        const out = modifyJsonForIp2Location(BASE);
        assert.equal(out.asn, 'AS64500');
        assert.deepEqual(out.extended, { anonymity: { code: 'none' } });
        const bare = modifyJsonForIp2Location({ ip: '203.0.113.40' });
        assert.equal(bare.asn, 'N/A');
        assert.equal('extended' in bare, false);
    });
});

describe('ip2location-io adapter — extended', () => {
    it('maps a full data-centre answer to what the card shows', () => {
        const { extended } = modifyJsonForIp2Location(full);
        assert.deepEqual(extended, {
            lineType: 'hosting',
            anonymity: { code: 'none' },
            abuse: 'none',
            metrics: [{ id: 'fraudScore', value: 3, max: 100 }],
        });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a VPN answer to a plain anonymizer yes, without the provider', () => {
        const { extended } = modifyJsonForIp2Location(vpn);
        assert.deepEqual(extended, {
            lineType: 'hosting',
            anonymity: { code: 'detected' },
            abuse: 'none',
            metrics: [{ id: 'fraudScore', value: 99, max: 100 }],
        });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a mobile answer to wireless', () => {
        const { extended } = modifyJsonForIp2Location(mobile);
        assert.deepEqual(extended, {
            lineType: 'wireless',
            anonymity: { code: 'none' },
            abuse: 'none',
            metrics: [{ id: 'fraudScore', value: 0, max: 100 }],
        });
        assert.equal(isValidExtended(extended), true);
    });

    it('reads usage_type for the line type, combined codes included', () => {
        const typed = (usage_type) => modifyJsonForIp2Location({ ...BASE, usage_type }).extended?.lineType;
        assert.equal(typed('ISP'), 'residential');
        assert.equal(typed('ISP/MOB'), 'wireless');
        assert.equal(typed('CDN'), 'hosting');
        assert.equal(typed('SES'), 'hosting');
        for (const code of ['COM', 'ORG', 'GOV', 'MIL', 'EDU', 'LIB']) assert.equal(typed(code), 'business');
        assert.equal(typed('RSV'), undefined);
        assert.equal(typed('-'), undefined);
    });

    it('answers yes for the top-level is_proxy or any anonymizer bit, never for proxy_type', () => {
        const bits = ['is_vpn', 'is_tor', 'is_public_proxy', 'is_web_proxy', 'is_residential_proxy', 'is_consumer_privacy_network'];
        for (const bit of bits) {
            const { extended } = modifyJsonForIp2Location({ ...full, proxy: proxy({ [bit]: true }) });
            assert.equal(extended.anonymity.code, 'detected', bit);
            assert.ok(isValidExtended(extended));
        }
        const top = modifyJsonForIp2Location({ ...full, is_proxy: true }).extended;
        assert.equal(top.anonymity.code, 'detected');
        const typed = modifyJsonForIp2Location({ ...full, proxy: proxy({ proxy_type: 'VPN' }) }).extended;
        assert.equal(typed.anonymity.code, 'none');
    });

    it('reads abuse as a yes / no from spammer, scanner and botnet', () => {
        for (const bit of ['is_spammer', 'is_scanner', 'is_botnet']) {
            const { extended } = modifyJsonForIp2Location({ ...full, proxy: proxy({ [bit]: true }) });
            assert.equal(extended.abuse, 'detected', bit);
            assert.ok(isValidExtended(extended));
        }
        assert.equal(modifyJsonForIp2Location(full).extended.abuse, 'none');
    });

    it('emits no anonymizer or abuse answer without the inputs, keeping the base answer', () => {
        const out = modifyJsonForIp2Location({ ...full, is_proxy: undefined, proxy: undefined });
        assert.equal(out.city, 'Sampleton');
        assert.deepEqual(out.extended, { lineType: 'hosting', metrics: [{ id: 'fraudScore', value: 3, max: 100 }] });
        assert.ok(isValidExtended(out.extended));
    });

    it('takes fraud_score as a number out of 100, and drops it when missing or malformed', () => {
        const scored = (fraud_score) => modifyJsonForIp2Location({ ...full, fraud_score }).extended.metrics;
        assert.deepEqual(scored(42), [{ id: 'fraudScore', value: 42, max: 100 }]);
        for (const value of [undefined, null, '42', -1, 101, Number.NaN, '-']) {
            assert.equal(scored(value), undefined, String(value));
        }
    });

    it('skips placeholders, empty strings and empty objects everywhere', () => {
        const out = modifyJsonForIp2Location({
            ip: '203.0.113.50',
            asn: '-', as: '',
            as_info: {}, isp: '-', domain: '', net_speed: '-', usage_type: '-', address_type: '',
            mcc: '-', mnc: '-', mobile_brand: '-', ads_category_name: '-', fraud_score: null,
            proxy: { proxy_type: '-', threat: '-', provider: '-' },
        });
        assert.equal(out.asn, 'N/A');
        assert.equal(out.org, 'N/A');
        assert.equal('extended' in out, false);
    });
});
