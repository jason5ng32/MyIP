// Tests for server/ipcheck-ing-extended.js — the IPCheck.ing API answer → `extended` block.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toExtended, anonymityCodeOf, lineTypeOf, scenariosOf } from '../server/ipcheck-ing-extended.js';
import { isValidExtended, EXTENDED_GATES } from '../common/ip-extended.js';
import { IP_TYPE_CODES } from '../common/codes/ip.js';

const GATE_VALUES = { sign_in_required: 'auth', quota_exceeded: 'quota', cooldown: 'cooldown' };

// v3 tags with nothing flagged.
const cleanTags = {
    isBogon: false, isMobile: false, isResidential: false, isSatellite: false,
    isCrawler: false, isBenignBot: false, isDatacenter: false, isTor: false,
    isProxy: false, isVPN: false, isAnyAnonymizer: false, isRelay: false,
    isResidentialProxy: false, isAbuser: false, isNative: true,
};

const geo = {
    ip: '203.0.113.7', country: 'JP', country_name: 'Japan', region: 'Tokyo', city: 'Shinjuku',
    latitude: 35.6938, longitude: 139.7034, asn: 'AS12345', org: 'Example Telecom',
};

const dimensions = {
    reputation: { level: 'low', lastSeen: null },
    anonymity: { class: 'vpn', sources: 'multi', firstSeen: null, lastSeen: null },
    network: { level: 'low', asn: 12345 },
};

const complete = {
    ...geo,
    advancedData: {
        score: 72, scoreVersion: 3, operatorType: 'Hosting',
        anonymityProvider: 'Acme VPN', anonymityProtocol: 'wireguard',
        tags: { ...cleanTags, isVPN: true, isAnyAnonymizer: true, isNative: false },
        dimensions,
        scenarios: { version: 1, items: [{ id: 'email', level: 'high' }, { id: 'signup', level: 'medium' }] },
    },
};

const gatedAnswer = (value) => ({
    ...geo,
    advancedData: { score: value, operatorType: value, anonymityProvider: value, anonymityProtocol: value, tags: value },
});

// Every string anywhere inside a value.
const stringsIn = (value) => {
    if (typeof value === 'string') return [value];
    if (value && typeof value === 'object') return Object.values(value).flatMap(stringsIn);
    return [];
};

// The strings of a block, its `gate` aside ('cooldown' is both a gate and an upstream value).
const dataStrings = ({ gate, ...rest } = {}) => stringsIn(rest);

describe('toExtended()', () => {
    it('maps a complete answer onto every field', () => {
        const out = toExtended(complete);
        assert.deepEqual(out, {
            anonymity: { code: 'vpn', provider: 'Acme VPN', protocol: 'wireguard' },
            lineType: 'hosting',
            native: false,
            score: 72,
            abuse: 'low',
            scenarios: [{ id: 'email', level: 'high' }, { id: 'signup', level: 'medium' }],
            scoreDetails: { tags: complete.advancedData.tags, dimensions },
        });
        assert.ok(isValidExtended(out));
    });

    it('carries tags and dimensions through as the same objects', () => {
        const out = toExtended(complete);
        assert.equal(out.scoreDetails.tags, complete.advancedData.tags);
        assert.equal(out.scoreDetails.dimensions, dimensions);
    });

    for (const [value, gate] of Object.entries(GATE_VALUES)) {
        it(`a ${value} answer is the ${gate} gate and nothing else`, () => {
            const out = toExtended(gatedAnswer(value));
            assert.deepEqual(out, { gate });
            assert.ok(isValidExtended(out));
        });
    }

    it('gates when any one field holds a gate value, and drops the rest', () => {
        for (const [value, gate] of Object.entries(GATE_VALUES)) {
            for (const field of ['score', 'operatorType', 'anonymityProvider', 'anonymityProtocol', 'tags', 'scenarios']) {
                const answer = { ...complete, advancedData: { ...complete.advancedData, [field]: value } };
                const out = toExtended(answer);
                assert.deepEqual(out, { gate }, `${field}=${value}`);
                assert.ok(!dataStrings(out).some((s) => s in GATE_VALUES), `${field}=${value}`);
            }
        }
    });

    it('never lets a gate value through as data', () => {
        for (const value of Object.keys(GATE_VALUES)) {
            for (const answer of [gatedAnswer(value), { ...complete, advancedData: { ...complete.advancedData, score: value } }]) {
                assert.ok(!dataStrings(toExtended(answer)).some((s) => s in GATE_VALUES), value);
            }
        }
        assert.deepEqual([...new Set(Object.values(GATE_VALUES))], [...EXTENDED_GATES]);
    });

    it('builds a normal block from the degraded default answer', () => {
        const tags = Object.fromEntries(Object.keys(cleanTags).map((key) => [key, false]));
        const out = toExtended({
            ...geo,
            advancedData: { score: 100, operatorType: 'unknown', anonymityProvider: null, anonymityProtocol: null, tags },
        });
        assert.deepEqual(out, {
            anonymity: { code: 'none' },
            lineType: 'unknown',
            native: false,
            score: 100,
            scoreDetails: { tags },
        });
        assert.ok(isValidExtended(out));
    });

    it('has no block without advanced data or without tags, and never throws', () => {
        assert.equal(toExtended(geo), null);
        assert.equal(toExtended({ ...geo, advancedData: null }), null);
        assert.equal(toExtended({ ...geo, advancedData: 'oops' }), null);
        assert.equal(toExtended({ ...geo, advancedData: { score: 90, operatorType: 'Business' } }), null);
        assert.equal(toExtended({ ...geo, advancedData: { score: 90, tags: [true] } }), null);
        for (const answer of [null, undefined, 'text', 42, [], { error: true }]) {
            assert.equal(toExtended(answer), null);
        }
    });

    it('maps an unknown operator type onto lineType unknown', () => {
        const withType = (operatorType) => toExtended({
            ...geo, advancedData: { tags: { ...cleanTags }, score: 50, operatorType },
        }).lineType;
        assert.equal(withType('Satellite'), 'unknown');
        assert.equal(withType('hosting'), 'unknown');
        assert.equal(withType(undefined), 'unknown');
        assert.equal(withType('constructor'), 'unknown');
    });

    it('keeps provider and protocol absent when the answer named no service', () => {
        const out = toExtended({ ...geo, advancedData: { tags: { ...cleanTags }, score: 80, anonymityProvider: null, anonymityProtocol: '' } });
        assert.deepEqual(out.anonymity, { code: 'none' });
    });

    it('keeps the score only when it is 0–100 or unknown', () => {
        const scoreOf = (score) => toExtended({ ...geo, advancedData: { tags: { ...cleanTags }, score } }).score;
        assert.equal(scoreOf(0), 0);
        assert.equal(scoreOf(100), 100);
        assert.equal(scoreOf('unknown'), 'unknown');
        for (const bad of [undefined, null, '90', -1, 101, Number.NaN]) assert.equal(scoreOf(bad), undefined, String(bad));
    });

    it('reads abuse from the reputation dimension, known levels only', () => {
        const abuseOf = (reputation) => toExtended({
            ...geo, advancedData: { tags: { ...cleanTags }, score: 50, dimensions: { reputation } },
        }).abuse;
        assert.equal(abuseOf({ level: 'high' }), 'high');
        assert.equal(abuseOf({ level: 'severe' }), undefined);
        assert.equal(abuseOf(null), undefined);
    });

    it('keeps native only when it is a boolean', () => {
        const out = toExtended({ ...geo, advancedData: { tags: { ...cleanTags, isNative: 'yes' }, score: 50 } });
        assert.equal('native' in out, false);
    });

    it('leaves out non-object dimensions from the score details', () => {
        const out = toExtended({ ...geo, advancedData: { tags: { ...cleanTags }, score: 50, dimensions: 'x' } });
        assert.deepEqual(Object.keys(out.scoreDetails), ['tags']);
    });

    it('omits scenarios when they are invalid', () => {
        const withScenarios = (scenarios) => toExtended({
            ...geo, advancedData: { tags: { ...cleanTags }, score: 50, scenarios },
        });
        for (const scenarios of [
            undefined, null, 'x', [], { version: '1', items: [{ id: 'email', level: 'high' }] },
            { version: 0, items: [{ id: 'email', level: 'high' }] }, { version: 1, items: 'x' },
            { version: 1, items: [] }, { version: 1, items: [{ id: 'nope', level: 'high' }, { id: 'email', level: 'severe' }] },
        ]) {
            const out = withScenarios(scenarios);
            assert.equal('scenarios' in out, false, JSON.stringify(scenarios));
            assert.ok(isValidExtended(out));
        }
    });
});

describe('scenariosOf()', () => {
    it('flattens the version shell, keeping order and the first valid item per id', () => {
        assert.deepEqual(scenariosOf({
            version: 2,
            items: [
                { id: 'email', level: 'severe' }, { id: 'email', level: 'high' }, null, 'x',
                { id: 'signup', level: 'low' }, { id: 'signup', level: 'high' }, { id: 'unknownId', level: 'low' },
            ],
        }), [{ id: 'email', level: 'high' }, { id: 'signup', level: 'low' }]);
    });

    it('drops extra item keys', () => {
        assert.deepEqual(scenariosOf({ version: 1, items: [{ id: 'email', level: 'low', note: 'x' }] }), [{ id: 'email', level: 'low' }]);
    });
});

describe('anonymityCodeOf()', () => {
    const anon = (cls, sources = 'single') => ({ anonymity: { class: cls, sources, firstSeen: null, lastSeen: null } });

    it('Tor first, then iCloud Private Relay', () => {
        assert.equal(anonymityCodeOf({ ...cleanTags, isAnyAnonymizer: true, isTor: true, isProxy: true }, anon('tor', 'multi')), 'tor');
        assert.equal(anonymityCodeOf({ ...cleanTags, isAnyAnonymizer: true, isRelay: true }, anon('relay')), 'relay');
    });

    it('confirmed residential proxy', () => {
        const tags = { ...cleanTags, isProxy: true, isAnyAnonymizer: true, isResidentialProxy: true };
        assert.equal(anonymityCodeOf(tags, anon('residential_proxy', 'multi')), 'residential');
    });

    it('proxy class: multi → proxy, otherwise suspected', () => {
        const tags = { ...cleanTags, isProxy: true, isAnyAnonymizer: true };
        assert.equal(anonymityCodeOf(tags, anon('proxy', 'multi')), 'proxy');
        assert.equal(anonymityCodeOf(tags, anon('proxy', 'single')), 'proxy_suspected');
        assert.equal(anonymityCodeOf(tags, anon('proxy', null)), 'proxy_suspected');
    });

    it('vpn class: multi → vpn, otherwise suspected (isProxy may be true too)', () => {
        const tags = { ...cleanTags, isVPN: true, isProxy: true, isAnyAnonymizer: true };
        assert.equal(anonymityCodeOf(tags, anon('vpn', 'multi')), 'vpn');
        assert.equal(anonymityCodeOf(tags, anon('vpn', 'single')), 'vpn_suspected');
    });

    it('residential proxy only the sighting history reports → suspected', () => {
        assert.equal(anonymityCodeOf({ ...cleanTags, isResidentialProxy: true }, anon('residential_proxy')), 'suspected_residential');
    });

    it('nothing detected → none (also without dimensions)', () => {
        assert.equal(anonymityCodeOf(cleanTags, { anonymity: { class: null, sources: null } }), 'none');
        assert.equal(anonymityCodeOf(cleanTags, undefined), 'none');
        assert.equal(anonymityCodeOf(cleanTags, 'x'), 'none');
    });
});

describe('lineTypeOf()', () => {
    it('maps the four operator types onto the line type codes', () => {
        assert.deepEqual(['Business', 'Residential', 'Wireless', 'Hosting'].map(lineTypeOf), [...IP_TYPE_CODES]);
    });
});
