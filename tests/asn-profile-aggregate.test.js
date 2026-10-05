// Tests for common/asn-profile.js — the /api/asn-profile composition:
// per-section classification, deadlines, the all-failed verdict and the
// edge-cache veto (error and incomplete sections). Loaders are injected; nothing touches the network.
// The frontend's request budget comes from frontend/utils/asn-profile-view.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SECTIONS, DEADLINES, INNER_TIMEOUTS, SOURCE_TIMEOUTS, withDeadline, hasMeaningfulField,
  classifyRadar, classifyPrefixes, classifyConnectivity, classifyRank, classifyReputation, classifyPeeringdb,
  buildSectionLoaders, composeAsnProfile, allSourcesFailed, isCompleteProfile,
} from '../common/asn-profile.js';
import { ASN_PROFILE_TIMEOUT_MS } from '../frontend/utils/asn-profile-view.js';

const sleep = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

// loadAsnSummary's shape.
const radarAnswer = (summary, { failed = [] } = {}) => ({ summary, failedSegments: failed });

describe('deadlines', () => {
  it('every deadline sits above the inner timeouts of the source it wraps', () => {
    for (const section of SECTIONS) {
      assert.ok(Number.isFinite(INNER_TIMEOUTS[section]), section);
      assert.ok(DEADLINES[section] > INNER_TIMEOUTS[section], section);
    }
    assert.equal(INNER_TIMEOUTS.whois, 8000 + SOURCE_TIMEOUTS.autnum, 'IANA bootstrap, then autnum');
  });

  it('the page waits longer than the slowest section, with headroom', () => {
    const slowest = Math.max(...SECTIONS.map((section) => DEADLINES[section]));
    assert.ok(ASN_PROFILE_TIMEOUT_MS >= slowest + 5000, `${ASN_PROFILE_TIMEOUT_MS} vs ${slowest}`);
  });

  it('withDeadline passes a fast result through and rejects a slow one', async () => {
    assert.equal(await withDeadline(sleep(1, 'fast'), 50), 'fast');
    await assert.rejects(withDeadline(sleep(100, 'slow'), 10), (err) => err.code === 'deadline');
  });
});

describe('classification', () => {
  it('radar: names or non-zero figures are data, all-zero stats are empty', () => {
    assert.equal(hasMeaningfulField({ asnName: 'X' }), true);
    assert.equal(hasMeaningfulField({ prefixesV4: '0', rpkiValid: 0, IPv6_Pct: '0.00%' }), false);
    assert.equal(hasMeaningfulField({ prefixesV4: '2,346' }), true);
    assert.deepEqual(classifyRadar(radarAnswer({})), { status: 'empty', data: null });
    assert.deepEqual(classifyRadar(radarAnswer({ asnName: 'X' })), { status: 'ok', data: { asnName: 'X' } });
  });

  it('radar: failed segments make data incomplete, and no data an error', () => {
    assert.deepEqual(classifyRadar(radarAnswer({ asnName: 'X' }, { failed: ['quality'] })),
      { status: 'ok', data: { asnName: 'X' }, incomplete: true });
    assert.throws(() => classifyRadar(radarAnswer({}, { failed: ['asnInfo'] })), /Radar segments failed: asnInfo/);
  });

  it('prefixes: empty list is empty, a malformed body throws', () => {
    assert.equal(classifyPrefixes({ prefixes: [], countries: [] }).status, 'empty');
    assert.equal(classifyPrefixes({ prefixes: [{ prefix: '192.0.2.0/24' }], countries: [] }).status, 'ok');
    assert.throws(() => classifyPrefixes({}));
  });

  it('connectivity: a lone origin with no neighbours is empty', () => {
    const lone = { origin: 1, nodes: [{ asn: 1 }], edges: [], neighbours: { counts: { providers: 0, peers: 0, customers: 0 } } };
    assert.equal(classifyConnectivity(lone).status, 'empty');
    assert.equal(classifyConnectivity({ ...lone, edges: [{}] }).status, 'ok');
    assert.equal(classifyConnectivity({ ...lone, neighbours: { counts: { peers: 2 } } }).status, 'ok');
  });

  it('rank: null record or null rank is empty', () => {
    assert.equal(classifyRank(null).status, 'empty');
    assert.equal(classifyRank({ rank: null }).status, 'empty');
    assert.equal(classifyRank({ rank: 64 }).status, 'ok');
  });

  it('reputation: unconfigured is disabled, found:false empty, non-200 throws', () => {
    assert.deepEqual(classifyReputation(null), { status: 'disabled', data: null });
    assert.equal(classifyReputation({ status: 200, data: { found: false } }).status, 'empty');
    const found = { found: true, ratio: { abuse: 2, vpn: 0.5 }, level: 'low', dropListed: false, proxy: 0, updatedAt: '2026-10-03T11:54:33.740Z' };
    assert.deepEqual(classifyReputation({ status: 200, data: found }), { status: 'ok', data: found });
    assert.throws(() => classifyReputation({ status: 503, data: { error: 'ASN data not loaded' } }));
  });

  it('reputation: an error status or a malformed 200 is never empty', () => {
    for (const status of [400, 404, 500, 502, 503]) {
      assert.throws(() => classifyReputation({ status, data: null }), new RegExp(String(status)));
      assert.throws(() => classifyReputation({ status, data: { found: false } }), new RegExp(String(status)));
    }
    for (const data of [null, {}, [], { found: 'no' }, { error: 'x' }]) {
      assert.throws(() => classifyReputation({ status: 200, data }), /malformed/, JSON.stringify(data));
    }
  });

  it('peeringdb: no index is disabled, no record empty, a record ok', () => {
    assert.deepEqual(classifyPeeringdb(false, null), { status: 'disabled', data: null });
    assert.deepEqual(classifyPeeringdb(true, null), { status: 'empty', data: null });
    const record = { policy: 'Open', types: [], ixs: [], facilities: [] };
    assert.deepEqual(classifyPeeringdb(true, record), { status: 'ok', data: record });
  });
});

const deps = (overrides = {}) => ({
  hasRadarKey: () => true,
  fetchRadarAsn: async () => radarAnswer({ asnName: 'EXAMPLE' }),
  fetchRadarPrefixes: async () => ({ prefixes: [{ prefix: '192.0.2.0/24' }], countries: [] }),
  getConnectivity: async (asn) => ({ origin: asn, nodes: [], edges: [{ from: asn, to: 174 }], neighbours: { counts: {} } }),
  rdapAutnum: async (asn) => ({ asn, name: 'EXAMPLE', __raw: 'ASNumber: 1' }),
  isAutnumMissing: (err) => err.message.startsWith('ASN not found'),
  queryAsRank: async () => ({ rank: 10 }),
  requestReputation: async () => null,
  isPeeringdbLoaded: () => true,
  lookupPeeringdb: (asn) => (asn === 13335 ? { policy: 'Open', types: ['Content'], ixs: [], facilities: [] } : null),
  ...overrides,
});

describe('buildSectionLoaders', () => {
  it('a prefixes answer the source calls partial is ok but incomplete', async () => {
    const partial = buildSectionLoaders(deps({ isPartialPrefixes: () => true }));
    assert.equal((await partial.prefixes(1)).incomplete, true);
    assert.equal((await buildSectionLoaders(deps()).prefixes(1)).incomplete, undefined);
    // An empty list stays a cacheable 'empty' whatever the flag says.
    const empty = buildSectionLoaders(deps({
      isPartialPrefixes: () => true, fetchRadarPrefixes: async () => ({ prefixes: [], countries: [] }),
    }));
    assert.deepEqual(await empty.prefixes(1), { status: 'empty', data: null });
  });

  it('Radar sections are disabled without a key', async () => {
    const loaders = buildSectionLoaders(deps({ hasRadarKey: () => false }));
    assert.deepEqual(await loaders.radar(1), { status: 'disabled', data: null });
    assert.deepEqual(await loaders.prefixes(1), { status: 'disabled', data: null });
  });

  it('an unregistered ASN is an empty whois, other RDAP faults throw', async () => {
    const missing = buildSectionLoaders(deps({ rdapAutnum: async () => { throw new Error('ASN not found: AS1'); } }));
    assert.deepEqual(await missing.whois(1), { status: 'empty', data: null });
    const broken = buildSectionLoaders(deps({ rdapAutnum: async () => { throw new Error('RDAP 500'); } }));
    await assert.rejects(broken.whois(1));
  });
});

describe('composeAsnProfile', () => {
  it('assembles every section with its status', async () => {
    const body = await composeAsnProfile(13335, buildSectionLoaders(deps()));
    assert.deepEqual(body.status, {
      radar: 'ok', prefixes: 'ok', connectivity: 'ok', whois: 'ok', rank: 'ok', reputation: 'disabled', peeringdb: 'ok',
    });
    assert.equal(body.asn, 13335);
    assert.equal(body.peeringdb.policy, 'Open');
    assert.equal(body.radar.asnName, 'EXAMPLE');
    assert.equal(body.reputation, null);
    assert.deepEqual(body.incomplete, []);
    assert.equal(isCompleteProfile(body), true);
    assert.equal(allSourcesFailed(body), false);
  });

  it('a partial Radar answer is shown but keeps the profile off the cache', async () => {
    const loaders = buildSectionLoaders(deps({
      fetchRadarAsn: async () => radarAnswer({ asnName: 'EXAMPLE' }, { failed: ['ipVersion', 'quality'] }),
    }));
    const body = await composeAsnProfile(13335, loaders);
    assert.equal(body.status.radar, 'ok');
    assert.equal(body.radar.asnName, 'EXAMPLE');
    assert.deepEqual(body.incomplete, ['radar']);
    assert.equal(allSourcesFailed(body), false);
    assert.equal(isCompleteProfile(body), false);
  });

  it('a partial Radar answer without data is an error, never a cacheable empty', async () => {
    const loaders = buildSectionLoaders(deps({
      fetchRadarAsn: async () => radarAnswer({}, { failed: ['asnInfo'] }),
    }));
    const body = await composeAsnProfile(13335, loaders);
    assert.equal(body.status.radar, 'error');
    assert.equal(body.radar, null);
    assert.deepEqual(body.incomplete, []);
    assert.equal(isCompleteProfile(body), false);
  });

  it('upstream faults that used to read as "nothing here" are errors', async () => {
    const loaders = buildSectionLoaders(deps({
      queryAsRank: async () => { throw new Error('ASRank GraphQL error: timeout'); },
      requestReputation: async () => ({ status: 503, data: { error: 'ASN data not loaded' } }),
      fetchRadarPrefixes: async () => { throw new Error('malformed pfx2as payload'); },
    }));
    const body = await composeAsnProfile(13335, loaders);
    assert.equal(body.status.rank, 'error');
    assert.equal(body.status.reputation, 'error');
    assert.equal(body.status.prefixes, 'error');
    assert.equal(isCompleteProfile(body), false);
  });

  it('a failing or slow source is absent with status error; the rest still arrive', async () => {
    const loaders = buildSectionLoaders(deps({
      queryAsRank: async () => { throw new Error('ASRank responded 502'); },
      fetchRadarPrefixes: () => sleep(200, { prefixes: [] }),
    }));
    const started = Date.now();
    const body = await composeAsnProfile(1, loaders, { deadlines: { ...DEADLINES, prefixes: 20 } });
    assert.ok(Date.now() - started < 150, 'the slow source did not hold the answer');
    assert.equal(body.status.rank, 'error');
    assert.equal(body.rank, null);
    assert.equal(body.status.prefixes, 'error');
    assert.equal(body.status.radar, 'ok');
    assert.equal(isCompleteProfile(body), false);
  });

  it('peeringdb never makes an answer incomplete or failed', async () => {
    const missing = await composeAsnProfile(64500, buildSectionLoaders(deps()));
    assert.equal(missing.status.peeringdb, 'empty');
    assert.equal(isCompleteProfile(missing), true);
    const unloaded = await composeAsnProfile(13335, buildSectionLoaders(deps({ isPeeringdbLoaded: () => false })));
    assert.equal(unloaded.status.peeringdb, 'disabled');
    assert.equal(unloaded.peeringdb, null);
    assert.equal(isCompleteProfile(unloaded), true);
  });

  it('a loader that throws synchronously is contained', async () => {
    const loaders = { ...buildSectionLoaders(deps()), whois: () => { throw new Error('boom'); } };
    const body = await composeAsnProfile(1, loaders);
    assert.equal(body.status.whois, 'error');
  });
});

describe('allSourcesFailed / isCompleteProfile', () => {
  it('only every configured source in error counts as failed', () => {
    const status = { radar: 'error', prefixes: 'error', connectivity: 'error', whois: 'error', rank: 'error', reputation: 'disabled' };
    assert.equal(allSourcesFailed({ status }), true);
    assert.equal(allSourcesFailed({ status: { ...status, rank: 'empty' } }), false);
  });

  it('empty and disabled sections keep an answer cacheable', () => {
    const status = { radar: 'empty', prefixes: 'empty', connectivity: 'empty', whois: 'empty', rank: 'empty', reputation: 'disabled' };
    assert.equal(isCompleteProfile({ status }), true);
    assert.equal(isCompleteProfile({ status: { ...status, whois: 'error' } }), false);
    assert.equal(isCompleteProfile({ error: 'All sources failed' }), false);
  });

  it('an incomplete section vetoes the cache without counting as failed', () => {
    const allOk = { radar: 'ok', prefixes: 'ok', connectivity: 'ok', whois: 'ok', rank: 'ok', reputation: 'disabled' };
    assert.equal(isCompleteProfile({ status: allOk, incomplete: [] }), true);
    assert.equal(isCompleteProfile({ status: allOk, incomplete: ['radar'] }), false);
    const status = { radar: 'ok', prefixes: 'error', connectivity: 'error', whois: 'error', rank: 'error', reputation: 'disabled' };
    assert.equal(allSourcesFailed({ status, incomplete: ['radar'] }), false);
  });
});
