// Tests for frontend/utils/ip-score-details.js — the score-details panel's
// explanation sentences (i18n keys + params) and attribute rows, including
// responses without dimensions and gated ones.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    isSuspectedResidentialProxy,
    SCORE_TAG_KEYS,
    listScoreTags,
    scoreRiskTier,
    buildScoreExplanation,
} from '../frontend/utils/ip-score-details.js';

const t = (key) => `<${key}>`;
const P = 'ipInfos.scoreDetails.explain.';

const v3Tags = {
    isBogon: false, isMobile: false, isResidential: false, isSatellite: false,
    isCrawler: false, isBenignBot: false, isDatacenter: false, isTor: false,
    isProxy: false, isVPN: false, isAnyAnonymizer: false, isRelay: false, isResidentialProxy: true,
    isAbuser: false, isNative: true,
};

const card = (overrides = {}) => ({
    ip: '44.27.137.203',
    isp: 'Amateur Radio Digital Communications',
    asn: 'AS7377',
    qualityScore: 90,
    scoreTags: v3Tags,
    scoreDimensions: {
        reputation: { level: 'none', lastSeen: null },
        anonymity: { class: 'residential_proxy', sources: 'single', firstSeen: null, lastSeen: '2026-09-20' },
        network: { level: 'none', asn: 7377 },
    },
    ...overrides,
});

const keysOf = (sentences) => sentences.map((s) => s.key.replace(P, ''));

describe('listScoreTags()', () => {
    it('lists the attribute rows in display order, without isBogon / isAnyAnonymizer / isBenignBot', () => {
        const rows = listScoreTags(v3Tags);
        assert.deepEqual(rows.map((r) => r.key), SCORE_TAG_KEYS);
        assert.deepEqual(SCORE_TAG_KEYS, [
            'isDatacenter', 'isResidential', 'isMobile', 'isSatellite',
            'isProxy', 'isVPN', 'isResidentialProxy', 'isRelay', 'isTor',
            'isAbuser', 'isCrawler', 'isNative',
        ]);
        assert.ok(!rows.some((r) => ['isBogon', 'isAnyAnonymizer', 'isBenignBot'].includes(r.key)));
    });

    it('maps booleans to yes / no, and a sighting-only residential proxy to suspected', () => {
        const state = (tags, key) => listScoreTags(tags).find((r) => r.key === key).state;
        assert.equal(state(v3Tags, 'isResidentialProxy'), 'suspected');
        assert.equal(state({ ...v3Tags, isProxy: true, isAnyAnonymizer: true }, 'isResidentialProxy'), 'yes');
        assert.equal(state({ ...v3Tags, isResidentialProxy: false }, 'isResidentialProxy'), 'no');
        assert.equal(state(v3Tags, 'isNative'), 'yes');
        assert.equal(state(v3Tags, 'isTor'), 'no');
        // isProxy and isVPN can both be true.
        const both = listScoreTags({ ...v3Tags, isProxy: true, isVPN: true, isAnyAnonymizer: true });
        assert.equal(both.find((r) => r.key === 'isProxy').state, 'yes');
        assert.equal(both.find((r) => r.key === 'isVPN').state, 'yes');
    });

    it('skips missing tags and returns nothing for gated or absent tags', () => {
        const { isSatellite, ...partial } = v3Tags;
        assert.ok(!listScoreTags(partial).some((r) => r.key === 'isSatellite'));
        assert.deepEqual(listScoreTags('sign_in_required'), []);
        assert.deepEqual(listScoreTags('quota_exceeded'), []);
        assert.deepEqual(listScoreTags(undefined), []);
    });

    it('has a label for every row and every state in the en pack', () => {
        const en = JSON.parse(fs.readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
        const details = en.ipInfos.scoreDetails;
        assert.equal(typeof details.tagsTitle, 'string');
        for (const key of SCORE_TAG_KEYS) assert.equal(typeof details.tags[key], 'string', key);
        for (const state of ['yes', 'no', 'suspected']) assert.equal(typeof details.tagState[state], 'string', state);
    });
});

describe('isSuspectedResidentialProxy()', () => {
    it('is true only for a residential proxy no other source calls a proxy', () => {
        assert.equal(isSuspectedResidentialProxy(v3Tags), true);
        assert.equal(isSuspectedResidentialProxy({ ...v3Tags, isProxy: true, isAnyAnonymizer: true }), false);
        assert.equal(isSuspectedResidentialProxy({ ...v3Tags, isResidentialProxy: false }), false);
        assert.equal(isSuspectedResidentialProxy('sign_in_required'), false);
    });
});

describe('scoreRiskTier()', () => {
    it('matches the score bar tiers', () => {
        assert.equal(scoreRiskTier(100), 'lowRisk');
        assert.equal(scoreRiskTier(80), 'lowRisk');
        assert.equal(scoreRiskTier(79), 'mediumRisk');
        assert.equal(scoreRiskTier(50), 'mediumRisk');
        assert.equal(scoreRiskTier(49), 'highRisk');
    });
});

describe('buildScoreExplanation()', () => {
    it('builds one sentence per dimension for a v3 card', () => {
        const out = buildScoreExplanation(card(), { t, formatDate: (d) => `[${d}]` });
        assert.deepEqual(keysOf(out), [
            'summary.lowRisk', 'network.isp', 'anonymity.residentialProxySuspected',
            'reputation.none', 'asn.none',
        ]);
        assert.deepEqual(out[0].params, {
            ip: '44.27.137.203',
            operator: 'Amateur Radio Digital Communications (AS7377)',
            score: '90',
        });
        assert.deepEqual(out[2].params, { date: '[2026-09-20]' });
    });

    it('dates a suspected residential proxy in one sentence, or drops the date', () => {
        const undated = keysOf(buildScoreExplanation(card({
            scoreDimensions: { ...card().scoreDimensions, anonymity: { class: 'residential_proxy', sources: 'single', lastSeen: null } },
        }), { t }));
        assert.ok(undated.includes('anonymity.residentialProxySuspectedUndated'));
        assert.ok(!undated.includes('anonymityLastSeen'));
    });

    it('keeps the confirmed residential proxy sentence plus its last-observed day', () => {
        const out = buildScoreExplanation(card({
            qualityScore: 25,
            scoreTags: { ...v3Tags, isProxy: true, isAnyAnonymizer: true },
        }), { t, formatDate: (d) => d });
        assert.deepEqual(keysOf(out).slice(2, 4), ['anonymity.residentialProxy', 'anonymityLastSeen']);
        assert.deepEqual(out[3].params, { date: '2026-09-20' });
    });

    it('picks network variants from the tags', () => {
        const dc = buildScoreExplanation(card({ scoreTags: { ...v3Tags, isDatacenter: true, isMobile: true } }), { t });
        assert.ok(keysOf(dc).includes('network.datacenter'));
        const mobile = buildScoreExplanation(card({ scoreTags: { ...v3Tags, isMobile: true } }), { t });
        assert.ok(keysOf(mobile).includes('network.mobile'));
    });

    it('picks anonymity variants by class and source agreement', () => {
        const withAnon = (anonymity) => keysOf(buildScoreExplanation(card({
            scoreDimensions: { ...card().scoreDimensions, anonymity },
        }), { t }));
        assert.ok(withAnon({ class: null, sources: null, lastSeen: '2026-09-01' }).includes('anonymity.none'));
        assert.ok(!withAnon({ class: null, sources: null, lastSeen: '2026-09-01' }).includes('anonymityLastSeen'));
        assert.ok(withAnon({ class: 'tor', sources: 'multi', lastSeen: null }).includes('anonymity.tor'));
        assert.ok(withAnon({ class: 'relay', sources: 'single', lastSeen: null }).includes('anonymity.relay'));
        assert.ok(withAnon({ class: 'proxy', sources: 'multi', lastSeen: null }).includes('anonymity.proxyMulti'));
        assert.ok(withAnon({ class: 'proxy', sources: 'single', lastSeen: null }).includes('anonymity.proxySingle'));
        assert.ok(withAnon({ class: 'proxy', sources: null, lastSeen: null }).includes('anonymity.proxySingle'));
        assert.ok(withAnon({ class: 'vpn', sources: 'single', lastSeen: null }).includes('anonymity.vpnSingle'));
        assert.ok(withAnon({ class: 'vpn', sources: 'multi', lastSeen: null }).includes('anonymity.vpnMulti'));
        // Anything but 'multi' (missing, null, unknown) reads as a single source.
        assert.ok(withAnon({ class: 'vpn', lastSeen: null }).includes('anonymity.vpnSingle'));
        // VPN sentences carry no count.
        const vpn = buildScoreExplanation(card({
            scoreDimensions: { ...card().scoreDimensions, anonymity: { class: 'vpn', sources: 'multi', lastSeen: null } },
        }), { t });
        assert.deepEqual(vpn.find((s) => s.key === `${P}anonymity.vpnMulti`).params, {});
        // An unknown future class is skipped rather than mislabelled.
        assert.ok(!withAnon({ class: 'something_new', sources: 'single', lastSeen: null }).some((k) => k.startsWith('anonymity')));
    });

    it('dates reputation sentences only when there is abuse evidence and a report day', () => {
        const withRep = (reputation) => buildScoreExplanation(card({
            scoreDimensions: { ...card().scoreDimensions, reputation },
        }), { t, formatDate: (d) => d });
        const high = withRep({ level: 'high', lastSeen: '2026-09-25' });
        assert.deepEqual(high.find((s) => s.key === `${P}reputation.highDated`).params, { date: '2026-09-25' });
        assert.ok(keysOf(withRep({ level: 'medium', lastSeen: null })).includes('reputation.medium'));
        assert.ok(keysOf(withRep({ level: 'none', lastSeen: '2026-01-01' })).includes('reputation.none'));
    });

    it('maps the ASN level and the score tier', () => {
        const out = keysOf(buildScoreExplanation(card({
            qualityScore: 30,
            scoreDimensions: { ...card().scoreDimensions, network: { level: 'high', asn: 1 } },
        }), { t }));
        assert.equal(out[0], 'summary.highRisk');
        assert.ok(out.includes('asn.high'));
    });

    it('falls back on the operator name', () => {
        const asnOnly = buildScoreExplanation(card({ isp: '' }), { t });
        assert.equal(asnOnly[0].params.operator, 'AS7377');
        const none = buildScoreExplanation(card({ isp: '', asn: '' }), { t });
        assert.equal(none[0].params.operator, `<${P}unknownOperator>`);
    });

    it('is empty without dimensions, for gated data and unknown scores', () => {
        assert.deepEqual(buildScoreExplanation(card({ scoreDimensions: undefined }), { t }), []);
        assert.deepEqual(buildScoreExplanation(card({ qualityScore: 'sign_in_required', scoreDimensions: undefined }), { t }), []);
        assert.deepEqual(buildScoreExplanation(card({ qualityScore: 'unknown' }), { t }), []);
        assert.deepEqual(buildScoreExplanation(card({ qualityScore: null }), { t }), []);
        assert.deepEqual(buildScoreExplanation(undefined), []);
    });

    it('skips malformed dimensions instead of throwing', () => {
        const out = keysOf(buildScoreExplanation(card({
            scoreDimensions: { reputation: { level: 'bogus' }, anonymity: 'x', network: null },
        }), { t }));
        assert.deepEqual(out, ['summary.lowRisk', 'network.isp']);
    });

    it('only produces keys that exist in the en pack', () => {
        const en = JSON.parse(fs.readFileSync(new URL('../frontend/locales/en.json', import.meta.url), 'utf8'));
        const resolve = (key) => key.split('.').reduce((node, part) => node?.[part], en);
        const variants = [
            card(),
            card({ qualityScore: 60, scoreTags: { ...v3Tags, isDatacenter: true } }),
            card({ qualityScore: 10, scoreTags: { ...v3Tags, isMobile: true } }),
            card({ qualityScore: 25, scoreTags: { ...v3Tags, isProxy: true, isAnyAnonymizer: true } }),
        ];
        const dims = [
            { class: null }, { class: 'tor' }, { class: 'relay' }, { class: 'proxy', sources: 'single' }, { class: 'proxy', sources: 'multi' },
            { class: 'vpn', sources: 'single' }, { class: 'vpn', sources: 'multi', lastSeen: '2026-09-01' },
            { class: 'residential_proxy', lastSeen: '2026-09-01' }, { class: 'residential_proxy', lastSeen: null },
        ];
        for (const level of ['none', 'low', 'medium', 'high']) {
            for (const anonymity of dims) {
                for (const base of variants) {
                    for (const lastSeen of [null, '2026-09-02']) {
                        const out = buildScoreExplanation({
                            ...base,
                            scoreDimensions: { reputation: { level, lastSeen }, anonymity, network: { level } },
                        }, { t });
                        for (const { key } of out) assert.equal(typeof resolve(key), 'string', key);
                    }
                }
            }
        }
    });
});
