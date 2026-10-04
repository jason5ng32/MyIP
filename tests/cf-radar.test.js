// Unit tests for the pure transform pipeline in common/cf-radar.js:
// the outage feed (Radar payload → flat event shape, anomaly-vs-outage
// dedupe, sort and cap), the country-traffic matrix aggregation, the asn
// view's response shaping and partial-segment reporting (fetch stubbed), and
// the bgp-prefixes list + country shares.
// Fixtures mirror real /radar/annotations/outages and /radar/traffic_anomalies
// responses (see the field names — they are the upstream contract).
// Dispatch behavior of the /api/cfradar route lives in api-handlers.test.js.
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
    normalizeOutages,
    normalizeAnomalies,
    mergeEvents,
    buildTrafficMatrix,
    shapeAsnProfile,
    loadAsnSummary,
    isCompleteRadarAnswer,
    RADAR_VIEWS,
    normalizePrefixOrigins,
    buildCountryShares,
} from '../common/cf-radar.js';
import logger from '../common/logger.js';
import { parseCidr } from '../common/ip-math.js';

const outageFixture = {
    id: '1645',
    dataSource: 'ALL',
    description: 'A 7.4-magnitude earthquake in western Colombia',
    scope: null,
    startDate: '2026-08-10T12:30:00Z',
    endDate: null,
    locations: ['CO'],
    asns: [],
    eventType: 'OUTAGE',
    linkedUrl: null,
    asnsDetails: [],
    locationsDetails: [{ name: 'Colombia', code: 'CO' }],
    outage: { outageCause: 'NATURAL_DISASTER', outageType: 'NATIONWIDE' },
};

const anomalyFixture = {
    uuid: '7dbd7c69-6fe3-4090-ab64-de4194c283b7',
    type: 'LOCATION',
    status: 'VERIFIED',
    startDate: '2026-08-08T17:00:00Z',
    endDate: '2026-08-08T20:15:00Z',
    locationDetails: { code: 'GA', name: 'Gabon' },
    asnDetails: null,
    originDetails: null,
};

describe('normalizeOutages', () => {
    it('maps a Radar outage annotation to the flat event shape', () => {
        const [event] = normalizeOutages([outageFixture]);
        assert.deepEqual(event, {
            kind: 'outage',
            id: 'o-1645',
            startDate: '2026-08-10T12:30:00Z',
            endDate: null,
            locations: ['CO'],
            asns: [],
            cause: 'NATURAL_DISASTER',
            level: 'NATIONWIDE',
            description: 'A 7.4-magnitude earthquake in western Colombia',
            scope: null,
            linkedUrl: null,
        });
    });

    it('numbers stringly-typed ASNs and survives a missing outage object', () => {
        const [event] = normalizeOutages([{
            ...outageFixture,
            outage: undefined,
            asnsDetails: [{ asn: '27725', name: 'ETECSA' }],
        }]);
        assert.deepEqual(event.asns, [{ asn: 27725, name: 'ETECSA' }]);
        assert.equal(event.cause, 'UNKNOWN');
        assert.equal(event.level, null);
    });
});

describe('normalizeAnomalies', () => {
    it('maps a location anomaly, leaving outage-only fields null', () => {
        const [event] = normalizeAnomalies([anomalyFixture]);
        assert.equal(event.kind, 'anomaly');
        assert.equal(event.id, 'a-7dbd7c69-6fe3-4090-ab64-de4194c283b7');
        assert.deepEqual(event.locations, ['GA']);
        assert.deepEqual(event.asns, []);
        assert.equal(event.cause, null);
        assert.equal(event.level, null);
    });

    it('keeps every anomaly status (the exclusion blocklist ships empty)', () => {
        const events = normalizeAnomalies([
            { ...anomalyFixture, uuid: 'u-1', status: 'UNVERIFIED' },
            { ...anomalyFixture, uuid: 'u-2', status: 'TP' },
            { ...anomalyFixture, uuid: 'u-3', status: 'VERIFIED' },
        ]);
        assert.deepEqual(events.map((e) => e.id), ['a-u-1', 'a-u-2', 'a-u-3']);
    });

    it('maps an AS anomaly to an asns entry with no locations', () => {
        const [event] = normalizeAnomalies([{
            ...anomalyFixture,
            type: 'AS',
            locationDetails: null,
            asnDetails: { asn: 27653, name: 'Comteco' },
        }]);
        assert.deepEqual(event.locations, []);
        assert.deepEqual(event.asns, [{ asn: 27653, name: 'Comteco' }]);
    });
});

describe('mergeEvents', () => {
    const outages = normalizeOutages([outageFixture]);

    it('drops an anomaly that shares a location and start window with an outage', () => {
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            locationDetails: { code: 'CO', name: 'Colombia' },
            startDate: '2026-08-10T12:30:00Z',
        }]);
        const merged = mergeEvents(outages, anomalies);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].kind, 'outage');
    });

    it('drops an anomaly that shares an ASN with an outage', () => {
        const cubaOutage = normalizeOutages([{
            ...outageFixture,
            id: '1611',
            locationsDetails: [{ name: 'Cuba', code: 'CU' }],
            asnsDetails: [{ asn: '27725', name: 'ETECSA' }],
            startDate: '2026-08-03T02:45:00Z',
        }]);
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            type: 'AS',
            locationDetails: null,
            asnDetails: { asn: 27725, name: 'ETECSA' },
            startDate: '2026-08-03T02:45:00Z',
        }]);
        const merged = mergeEvents(cubaOutage, anomalies);
        assert.equal(merged.length, 1);
        assert.equal(merged[0].kind, 'outage');
    });

    it('keeps an anomaly whose subject matches but starts outside the window', () => {
        const anomalies = normalizeAnomalies([{
            ...anomalyFixture,
            locationDetails: { code: 'CO', name: 'Colombia' },
            startDate: '2026-08-01T00:00:00Z',
        }]);
        assert.equal(mergeEvents(outages, anomalies).length, 2);
    });

    it('orders ongoing before ended, newest-first inside each group', () => {
        // Ended CO outage is newer than everything; the older ongoing events
        // must still lead, themselves in reverse start order.
        const endedOutage = normalizeOutages([{
            ...outageFixture, id: '1', endDate: '2026-08-10T18:00:00Z',
        }]);
        const ongoingOld = normalizeAnomalies([{
            ...anomalyFixture, uuid: 'u-old', startDate: '2026-08-01T00:00:00Z', endDate: null,
        }]);
        const ongoingNew = normalizeAnomalies([{
            ...anomalyFixture,
            uuid: 'u-new',
            locationDetails: { code: 'GN', name: 'Guinea' },
            startDate: '2026-08-05T00:00:00Z',
            endDate: null,
        }]);
        const merged = mergeEvents(endedOutage, [...ongoingOld, ...ongoingNew]);
        assert.deepEqual(merged.map((e) => e.id), ['a-u-new', 'a-u-old', 'o-1']);
    });

    it('caps the merged feed at 30 events', () => {
        const many = normalizeOutages(Array.from({ length: 40 }, (_, i) => ({
            ...outageFixture,
            id: String(i),
            startDate: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        })));
        assert.equal(mergeEvents(many, []).length, 30);
    });
});

describe('buildTrafficMatrix', () => {
    // 28 days of hourly points from Monday 2024-01-01T00:00Z, Radar-style
    // string values. `valueAt` receives the point's UTC date.
    const makeSerie = (valueAt) => {
        const start = Date.UTC(2024, 0, 1);
        const timestamps = [];
        const values = [];
        for (let i = 0; i < 28 * 24; i++) {
            const date = new Date(start + i * 60 * 60 * 1000);
            timestamps.push(date.toISOString());
            values.push(String(valueAt(date)));
        }
        return { timestamps, values };
    };

    it('returns null for a missing or malformed serie', () => {
        assert.equal(buildTrafficMatrix(undefined), null);
        assert.equal(buildTrafficMatrix({}), null);
        assert.equal(buildTrafficMatrix({ timestamps: [], values: [] }), null);
    });

    it('returns null when the serie covers less than a full week', () => {
        const serie = makeSerie(() => 0.5);
        serie.timestamps = serie.timestamps.slice(0, 100);
        serie.values = serie.values.slice(0, 100);
        assert.equal(buildTrafficMatrix(serie), null);
    });

    it('aggregates into a Monday-first 7×24 matrix scaled to a max of 1', () => {
        // Baseline 0.1 with a spike every Tuesday at 05:00 UTC.
        const serie = makeSerie((date) => (date.getUTCDay() === 2 && date.getUTCHours() === 5 ? 1 : 0.1));
        const matrix = buildTrafficMatrix(serie);
        assert.equal(matrix.length, 7);
        assert.ok(matrix.every((row) => row.length === 24));
        assert.equal(matrix[1][5], 1); // Tuesday is row 1 when Monday-first
        assert.equal(matrix[0][0], 0.1);
        assert.equal(Math.max(...matrix.flat()), 1);
    });

    it('skips unparsable points without breaking the aggregate', () => {
        const serie = makeSerie(() => 0.5);
        serie.values[0] = 'not-a-number';
        const matrix = buildTrafficMatrix(serie);
        assert.equal(matrix.length, 7);
        assert.equal(Math.max(...matrix.flat()), 1);
    });
});

describe('shapeAsnProfile', () => {
    it('shapes the Radar segments and drops what Radar left out', () => {
        const body = shapeAsnProfile({
            asnInfo: { result: { asn: { name: 'CLOUDFLARENET', estimatedUsers: { estimatedUsers: 1200 } } } },
            ipVersion: { result: { summary_0: { IPv4: '61.5', IPv6: '38.5' } } },
        });
        assert.equal(body.asnName, 'CLOUDFLARENET');
        assert.equal(body.estimatedUsers, (1200).toLocaleString());
        assert.equal(body.IPv4_Pct, '61.50%');
        for (const key of ['speedDownload', 'latency', 'Bot_Pct']) {
            assert.equal(Object.hasOwn(body, key), false, key);
        }
    });

    it('carries no prefix or relationship counts (those live in the ASN Profile)', () => {
        const body = shapeAsnProfile({
            routesStats: { result: { stats: { distinct_prefixes_ipv4: 2346 } } },
        });
        for (const key of ['prefixesV4', 'prefixesV6', 'upstreamCount', 'downstreamCount', 'peerCount']) {
            assert.equal(Object.hasOwn(body, key), false, key);
        }
    });
});

describe('loadAsnSummary / asn view', () => {
    const originalFetch = globalThis.fetch;
    const originalWarn = logger.warn;
    afterEach(() => {
        globalThis.fetch = originalFetch;
        logger.warn = originalWarn;
    });

    // Radar segment bodies keyed by API path (after /client/v4); a path
    // mapped to a number answers with that HTTP status.
    const stubRadar = (byPath) => {
        logger.warn = () => {};
        globalThis.fetch = async (url) => {
            const { hostname, pathname } = new URL(String(url));
            assert.equal(hostname, 'api.cloudflare.com');
            const answer = byPath[pathname.replace('/client/v4', '')];
            if (typeof answer === 'number') return new Response('busy', { status: answer });
            return new Response(JSON.stringify(answer ?? { result: {} }));
        };
    };
    const KNOWN = {
        '/radar/entities/asns/13335': { result: { asn: { name: 'CLOUDFLARENET', country: 'US' } } },
    };

    it('reports a complete answer, without asking routes/stats', async () => {
        const asked = [];
        stubRadar(KNOWN);
        const stubbed = globalThis.fetch;
        globalThis.fetch = async (url) => { asked.push(new URL(String(url)).pathname); return stubbed(url); };
        const { summary, failedSegments } = await loadAsnSummary('13335');
        assert.deepEqual(failedSegments, []);
        assert.equal(summary.asnName, 'CLOUDFLARENET');
        assert.equal(asked.length, 6);
        assert.equal(asked.some((path) => path.includes('/bgp/routes/stats')), false);
    });

    it('names the failed segments and still shapes the rest', async () => {
        stubRadar({ ...KNOWN, '/radar/http/summary/ip_version': 503, '/radar/quality/speed/summary': 500 });
        const { summary, failedSegments } = await loadAsnSummary('13335');
        assert.deepEqual(failedSegments.sort(), ['ipVersion', 'quality']);
        assert.equal(summary.asnName, 'CLOUDFLARENET');
    });

    it("a 404 is Radar's \"no such AS\", not a failed segment", async () => {
        stubRadar({ '/radar/entities/asns/64511': 404 });
        const { failedSegments } = await loadAsnSummary('64511');
        assert.equal(failedSegments.includes('asnInfo'), false);
    });

    it('throws when every segment failed', async () => {
        stubRadar(new Proxy({}, { get: () => 502 }));
        await assert.rejects(loadAsnSummary('13335'), /Radar responded 502/);
    });

    it('the asn view serves a partial answer unchanged but marks it uncacheable', async () => {
        stubRadar(KNOWN);
        const complete = await RADAR_VIEWS.asn.fetch({ asn: '13335' });
        assert.equal(isCompleteRadarAnswer(complete), true);

        stubRadar({ ...KNOWN, '/radar/http/summary/bot_class': 503 });
        const partial = await RADAR_VIEWS.asn.fetch({ asn: '13335' });
        assert.equal(partial.asnName, 'CLOUDFLARENET');
        assert.equal(isCompleteRadarAnswer(partial), false);
        assert.equal(JSON.stringify(partial), JSON.stringify({ ...partial }), 'no marker in the payload');
        assert.deepEqual(Object.getOwnPropertySymbols(partial), []);
        // Other views' answers and non-objects stay cacheable.
        assert.equal(isCompleteRadarAnswer({ ...partial }), true);
        assert.equal(isCompleteRadarAnswer(null), true);
    });

    it('the bgp-prefixes view is partial when MaxMind could not answer, complete when it did', async () => {
        stubRadar({ '/radar/bgp/routes/pfx2as': { result: { prefix_origins: [{ prefix: '192.0.2.0/24' }] } } });
        const missing = await RADAR_VIEWS['bgp-prefixes'].fetch({ asn: '64500' }, { lookupRange: () => null });
        assert.deepEqual(missing.prefixes.map((row) => row.prefix), ['192.0.2.0/24']);
        assert.deepEqual(missing.countries, []);
        assert.equal(isCompleteRadarAnswer(missing), false);
        const ready = await RADAR_VIEWS['bgp-prefixes'].fetch({ asn: '64500' },
            { lookupRange: () => ({ country: 'US', prefixLength: 24 }) });
        assert.deepEqual(ready.countries, [{ country: 'US', share: 1 }]);
        assert.equal(isCompleteRadarAnswer(ready), true);
    });

    it('the bgp-prefixes view caches an AS with no prefixes even without MaxMind', async () => {
        stubRadar({ '/radar/bgp/routes/pfx2as': { result: { prefix_origins: [] } } });
        const empty = await RADAR_VIEWS['bgp-prefixes'].fetch({ asn: '64500' }, { lookupRange: () => null });
        assert.deepEqual(empty, { prefixes: [], countries: [] });
        assert.equal(isCompleteRadarAnswer(empty), true);
    });
});

describe('normalizePrefixOrigins', () => {
    it('maps pfx2as rows to the prefix/rpki/peers shape', () => {
        assert.deepEqual(normalizePrefixOrigins({
            prefix_origins: [
                { origin: 13335, peer_count: 76, prefix: '104.22.21.0/24', rpki_validation: 'Valid' },
                { origin: 13335, peer_count: 71, prefix: '2606:4700::/32', rpki_validation: 'Unknown' },
            ],
        }), [
            { prefix: '104.22.21.0/24', rpki: 'Valid', peers: 76 },
            { prefix: '2606:4700::/32', rpki: 'Unknown', peers: 71 },
        ]);
    });

    it('defaults a missing peer_count to 0', () => {
        const [row] = normalizePrefixOrigins({
            prefix_origins: [{ origin: 13335, prefix: '104.22.21.0/24', rpki_validation: 'Invalid' }],
        });
        assert.deepEqual(row, { prefix: '104.22.21.0/24', rpki: 'Invalid', peers: 0 });
    });

    it('returns [] only for a real empty list', () => {
        assert.deepEqual(normalizePrefixOrigins({ prefix_origins: [] }), []);
    });

    it('throws on malformed or missing results instead of reading them as empty', () => {
        for (const result of [undefined, null, {}, { prefix_origins: 'nope' }, { prefix_origins: null }]) {
            assert.throws(() => normalizePrefixOrigins(result), /malformed pfx2as/, JSON.stringify(result));
        }
    });
});

describe('buildCountryShares', () => {
    // A stand-in for MaxMind: the most specific listed network holding the
    // address answers; anything else is an unknown /24.
    const rangeLookup = (networks) => {
        const parsed = Object.entries(networks).map(([cidr, country]) => ({ ...parseCidr(cidr), country }))
            .sort((a, b) => b.prefix - a.prefix);
        return (ip) => {
            const value = parseCidr(`${ip}/32`).network;
            const hit = parsed.find((n) => value >= n.network && value < n.network + 2n ** BigInt(32 - n.prefix));
            return hit ? { country: hit.country, prefixLength: hit.prefix } : { country: null, prefixLength: 24 };
        };
    };
    const lookup = rangeLookup({ '8.8.8.0/24': 'US', '8.8.4.0/24': 'US', '1.0.0.0/22': 'AU', '81.0.0.0/22': 'DE' });
    const rows = (...prefixes) => prefixes.map((prefix) => ({ prefix }));
    // Shares of a walk that must have completed.
    const shares = (prefixes, lookupRange) => {
        const result = buildCountryShares(prefixes, lookupRange);
        assert.equal(result.complete, true);
        return result.shares;
    };

    it('weights countries by address count, not prefix count', () => {
        // Two US /24s vs one AU /22 → AU holds twice the addresses.
        assert.deepEqual(shares(rows('8.8.8.0/24', '8.8.4.0/24', '1.0.0.0/22'), lookup), [
            { country: 'AU', share: 0.6667 },
            { country: 'US', share: 0.3333 },
        ]);
    });

    it('splits a prefix spanning several MaxMind networks among their countries', () => {
        // One /15: its first /16 in SG, the second in US — not all SG.
        const split = rangeLookup({ '3.0.0.0/16': 'SG', '3.1.0.0/16': 'US' });
        assert.deepEqual(shares(rows('3.0.0.0/15'), split), [
            { country: 'SG', share: 0.5 },
            { country: 'US', share: 0.5 },
        ]);
        // A network wider than the prefix answers for the whole prefix in one lookup.
        let calls = 0;
        const wide = () => { calls++; return { country: 'US', prefixLength: 8 }; };
        assert.deepEqual(shares(rows('52.4.0.0/14'), wide), [{ country: 'US', share: 1 }]);
        assert.equal(calls, 1);
    });

    it('stops at the lookup budget, across blocks, and reports the walk incomplete', () => {
        // Every address its own /32: a /14 alone needs 262144 lookups.
        let calls = 0;
        const perAddress = () => { calls++; return { country: 'US', prefixLength: 32 }; };
        const result = buildCountryShares(rows('10.0.0.0/14', '192.0.2.0/24'), perAddress);
        assert.equal(calls, 100000, 'the cap holds; the later block is not looked up');
        assert.equal(result.complete, false);
        assert.deepEqual(result.shares, [{ country: 'US', share: 1 }]);
    });

    it('a lookup without an answer (no database, failed lookup) is incomplete, not "no countries"', () => {
        assert.deepEqual(buildCountryShares(rows('8.8.8.0/24'), () => null), { shares: [], complete: false });
        let calls = 0;
        const failsSecond = () => (++calls === 1 ? { country: 'US', prefixLength: 24 } : null);
        assert.deepEqual(buildCountryShares(rows('8.8.8.0/24', '8.8.9.0/24'), failsSecond), { shares: [], complete: false });
    });

    it('sorts largest first and ignores IPv6 prefixes', () => {
        assert.deepEqual(shares(rows('2606:4700::/32', '8.8.8.0/24', '81.0.0.0/22'), lookup), [
            { country: 'DE', share: 0.8 },
            { country: 'US', share: 0.2 },
        ]);
    });

    it('skips more-specifics of a covering announced prefix', () => {
        // 1.0.0.0/23 covers 1.0.0.0/24 and 1.0.1.0/24 — counted once, so the
        // US /24 pair still balances it.
        const result = shares(rows('1.0.0.0/24', '1.0.1.0/24', '1.0.0.0/23', '8.8.8.0/24', '8.8.4.0/24'), lookup);
        assert.deepEqual(result.map((row) => row.share), [0.5, 0.5]);
        assert.deepEqual(result.map((row) => row.country).sort(), ['AU', 'US']);
    });

    it('leaves unresolvable addresses out of the denominator', () => {
        assert.deepEqual(shares(rows('8.8.8.0/24', '9.9.9.0/24'), lookup), [
            { country: 'US', share: 1 },
        ]);
    });

    it('is complete and empty with no IPv4 prefixes, no resolvable country, or junk rows', () => {
        const noLookups = () => { throw new Error('no lookup expected'); };
        assert.deepEqual(shares([], noLookups), []);
        assert.deepEqual(shares(undefined, noLookups), []);
        assert.deepEqual(shares(rows('2606:4700::/32'), noLookups), []);
        assert.deepEqual(shares([{ prefix: 'nope' }, null, {}], noLookups), []);
        assert.deepEqual(shares(rows('9.9.9.0/24'), lookup), []);
    });

    it('caps the response at 50 countries', () => {
        const many = Array.from({ length: 60 }, (_, i) => ({ prefix: `10.${i}.0.0/16` }));
        const result = shares(many, (ip) => ({ country: `C${ip.split('.')[1]}`, prefixLength: 16 }));
        assert.equal(result.length, 50);
    });
});
