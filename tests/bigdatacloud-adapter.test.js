// Tests for api/bigdatacloud.js — the base geo fields and the `extended` block, on invented answers in the upstream's shape.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidExtended } from '../common/ip-extended.js';
import { modifyJsonForBigDataCloud } from '../api/bigdatacloud.js';

const HAZARD = {
    isKnownAsTorServer: false, isKnownAsVpn: false, isKnownAsProxy: false,
    isSpamhausDrop: false, isSpamhausEdrop: false, isSpamhausAsnDrop: false,
    isBlacklistedUceprotect: false, isBlacklistedBlocklistDe: false,
    isKnownAsMailServer: false, isKnownAsPublicRouter: false, isBogon: false, isUnreachable: false,
    hostingLikelihood: 0, isHostingAsn: false, isCellular: false, iCloudPrivateRelay: false,
};

const full = {
    ip: '203.0.113.10',
    localityLanguageRequested: 'en',
    isReachableGlobally: true,
    country: {
        isoAlpha2: 'XE', isoAlpha3: 'XEX', m49Code: 999, name: 'Republic of Exampleland',
        isoName: 'Exampleland', isoNameFull: 'the Republic of Exampleland', isIndependent: true,
        currency: { numericCode: 999, code: 'XTS', minorUnits: 2 }, wbRegion: { id: 'XX', value: 'Example' },
    },
    location: {
        principalSubdivision: 'North Example', principalSubdivisionCode: 'XE-NE', city: 'Sampleton',
        localityName: 'Sampleton Centre', postcode: '00000', latitude: 12.5, longitude: 34.25,
        plusCode: '0000+00', timeZone: { ianaTimeId: 'Etc/UTC' }, localityInfo: { administrative: [] },
    },
    lastUpdated: '2026-01-01T00:00:00.000Z',
    network: {
        registry: 'RIPE', registryStatus: 'assigned', registeredCountry: 'XE',
        registeredCountryName: 'Exampleland', organisation: 'Example Cloud Ltd Datacenter dc1',
        isReachableGlobally: true, isBogon: false, bgpPrefix: '203.0.113.0/24',
        bgpPrefixNetworkAddress: '203.0.113.0', bgpPrefixLastAddress: '203.0.113.255', totalAddresses: 256,
        carriers: [{
            asn: 'AS64500', asnNumeric: 64500, organisation: 'Example Cloud Ltd', name: 'EXAMPLE-AS',
            registry: 'RIPE', registeredCountry: 'XE', registeredCountryName: 'Exampleland',
            registrationDate: '2010-01-02', registrationLastChange: '2025-03-04', totalIpv4Addresses: 4096,
            totalIpv4Prefixes: 4, totalIpv4BogonPrefixes: 0, rank: 1000, rankText: '#1,000',
        }],
        viaCarriers: [],
    },
    confidence: 'high',
    confidenceArea: [],
    securityThreat: 'hosting - high probability',
    hazardReport: { ...HAZARD, isKnownAsVpn: true, isHostingAsn: true, hostingLikelihood: 8 },
};

const cellular = {
    ip: '198.51.100.30',
    country: { isoAlpha2: 'XE', name: 'Republic of Exampleland' },
    location: { principalSubdivision: 'South Example', city: 'Mobileton', latitude: 1.5, longitude: 2.5 },
    network: { organisation: 'Example Mobile', carriers: [{ asn: 'AS64501', asnNumeric: 64501, organisation: 'Example Mobile Ltd' }] },
    hazardReport: { ...HAZARD, isCellular: true, hostingLikelihood: 9 },
};

// Unroutable space: 200 with nulls and no carriers.
const empty = {
    ip: '203.0.113.40',
    country: { isoAlpha2: null, name: null },
    location: { principalSubdivision: '', city: null, latitude: null, longitude: null },
    network: { organisation: null, carriers: [] },
    hazardReport: null,
};

describe('bigdatacloud adapter — base fields', () => {
    it('maps a full answer to the ten base fields', () => {
        const { extended, ...base } = modifyJsonForBigDataCloud(full);
        assert.deepEqual(base, {
            ip: '203.0.113.10', city: 'Sampleton', region: 'North Example', country: 'XE',
            country_name: 'Republic of Exampleland', country_code: 'XE', latitude: 12.5, longitude: 34.25,
            asn: 'AS64500', org: 'Example Cloud Ltd',
        });
        assert.ok(extended);
    });

    it('falls back to the network organisation, then the numeric ASN', () => {
        const out = modifyJsonForBigDataCloud({
            ...cellular, network: { organisation: 'Example Mobile', carriers: [{ asnNumeric: 64501 }] },
        });
        assert.equal(out.org, 'Example Mobile');
        assert.equal(out.asn, 'AS64501');
    });

    it('answers an unroutable payload with N/A and no extended block', () => {
        const out = modifyJsonForBigDataCloud(empty);
        assert.equal(out.ip, '203.0.113.40');
        for (const key of ['city', 'region', 'country', 'country_name', 'country_code', 'latitude', 'longitude', 'asn', 'org']) {
            assert.equal(out[key], 'N/A', key);
        }
        assert.equal('extended' in out, false);
    });

    it('answers a minimal payload without any nested object', () => {
        const out = modifyJsonForBigDataCloud({ ip: '203.0.113.41' });
        assert.equal(out.city, 'N/A');
        assert.equal(out.asn, 'N/A');
        assert.equal('extended' in out, false);
        assert.equal(modifyJsonForBigDataCloud({ ip: '203.0.113.42', network: { carriers: null } }).asn, 'N/A');
    });

    it('keeps a coordinate of 0', () => {
        const out = modifyJsonForBigDataCloud({ ...full, location: { ...full.location, latitude: 0, longitude: 0 } });
        assert.equal(out.latitude, 0);
        assert.equal(out.longitude, 0);
    });
});

describe('bigdatacloud adapter — extended', () => {
    it('maps a hosting VPN answer to what the card shows', () => {
        const { extended } = modifyJsonForBigDataCloud(full);
        assert.deepEqual(extended, { lineType: 'hosting', anonymity: { code: 'detected' }, abuse: 'none' });
        assert.equal(isValidExtended(extended), true);
    });

    it('maps a cellular answer to wireless, whatever its hosting likelihood', () => {
        const { extended } = modifyJsonForBigDataCloud(cellular);
        assert.deepEqual(extended, { lineType: 'wireless', anonymity: { code: 'none' }, abuse: 'none' });
        assert.equal(isValidExtended(extended), true);
    });

    it('leaves the line type out when neither flag is set', () => {
        const { extended } = modifyJsonForBigDataCloud({ ...cellular, hazardReport: { ...HAZARD, hostingLikelihood: 10 } });
        assert.equal('lineType' in extended, false);
    });

    it('answers yes for any anonymizer flag', () => {
        for (const bit of ['isKnownAsTorServer', 'isKnownAsVpn', 'isKnownAsProxy', 'iCloudPrivateRelay']) {
            const { extended } = modifyJsonForBigDataCloud({ ...cellular, hazardReport: { ...HAZARD, [bit]: true } });
            assert.equal(extended.anonymity.code, 'detected', bit);
            assert.ok(isValidExtended(extended));
        }
    });

    it('answers abuse yes for any blocklist flag, never for mail servers or routers', () => {
        for (const bit of ['isSpamhausDrop', 'isSpamhausEdrop', 'isSpamhausAsnDrop', 'isBlacklistedUceprotect', 'isBlacklistedBlocklistDe']) {
            const { extended } = modifyJsonForBigDataCloud({ ...cellular, hazardReport: { ...HAZARD, [bit]: true } });
            assert.equal(extended.abuse, 'detected', bit);
        }
        const other = modifyJsonForBigDataCloud({
            ...cellular, hazardReport: { ...HAZARD, isKnownAsMailServer: true, isKnownAsPublicRouter: true },
        }).extended;
        assert.equal(other.abuse, 'none');
    });
});
