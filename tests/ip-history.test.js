// Tests for the pure IP-history helpers behind the local (browser-only)
// IP detection history: parsing/sanitizing the localStorage payload, per-day
// merge with field back-fill, retention pruning, aggregation, facets and filtering.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    IP_HISTORY_RETENTION_DAYS,
    localDayKey,
    clampRetentionDays,
    createEmptyHistory,
    parseHistory,
    mergeIntoHistory,
    pruneHistory,
    sortedHistoryDays,
    groupHistoryByIP,
    countryFacets,
    distinctCountryCount,
    ipVersionCounts,
    filterHistoryDays,
} from '../frontend/utils/ip-history.js';

const entry = (ip, extra = {}) => ({ ip, country: '', location: '', asn: '', org: '', ...extra });

describe('localDayKey', () => {
    it('formats a date as local YYYY-MM-DD', () => {
        assert.equal(localDayKey(new Date(2026, 6, 8)), '2026-07-08');
        assert.equal(localDayKey(new Date(2026, 0, 1)), '2026-01-01');
    });
});

describe('clampRetentionDays', () => {
    it('clamps to [1, 90] and rounds to whole days', () => {
        assert.equal(clampRetentionDays(30), 30);
        assert.equal(clampRetentionDays(0), 1);
        assert.equal(clampRetentionDays(-5), 1);
        assert.equal(clampRetentionDays(365), 90);
        assert.equal(clampRetentionDays(7.6), 8);
    });

    it('falls back to the default for non-numeric input', () => {
        assert.equal(clampRetentionDays(undefined), IP_HISTORY_RETENTION_DAYS);
        assert.equal(clampRetentionDays('abc'), IP_HISTORY_RETENTION_DAYS);
        assert.equal(clampRetentionDays(NaN), IP_HISTORY_RETENTION_DAYS);
    });
});

describe('parseHistory', () => {
    it('returns an empty history for null / empty input', () => {
        assert.deepEqual(parseHistory(null), createEmptyHistory());
        assert.deepEqual(parseHistory(''), createEmptyHistory());
    });

    it('returns an empty history for malformed JSON', () => {
        assert.deepEqual(parseHistory('{not json'), createEmptyHistory());
    });

    it('returns an empty history for wrong top-level shapes', () => {
        assert.deepEqual(parseHistory('"a string"'), createEmptyHistory());
        assert.deepEqual(parseHistory('{"version":1}'), createEmptyHistory());
        assert.deepEqual(parseHistory('{"days":[]}').days, {});
    });

    it('keeps well-formed entries and drops junk ones', () => {
        const raw = JSON.stringify({
            version: 1,
            days: {
                '2026-07-08': [
                    { ip: '1.1.1.1', country: 'us', location: 'United States', asn: 'AS13335', org: 'Cloudflare' },
                    { ip: 'not-an-ip' },
                    { country: 'de' },
                    null,
                ],
                'garbage-key': [{ ip: '8.8.8.8' }],
                '2026-07-07': 'not an array',
            },
        });
        const history = parseHistory(raw);
        assert.deepEqual(Object.keys(history.days), ['2026-07-08']);
        // country comes back uppercased — sanitizeEntry normalizes case
        assert.deepEqual(history.days['2026-07-08'], [
            { ip: '1.1.1.1', country: 'US', location: 'United States', asn: 'AS13335', org: 'Cloudflare' },
        ]);
    });

    it('normalizes missing detail fields to empty strings', () => {
        const history = parseHistory(JSON.stringify({ days: { '2026-07-08': [{ ip: '1.1.1.1' }] } }));
        assert.deepEqual(history.days['2026-07-08'], [entry('1.1.1.1')]);
    });
});

describe('mergeIntoHistory', () => {
    it('adds new IPs to the given day', () => {
        const { history, changed } = mergeIntoHistory(
            createEmptyHistory(),
            [{ ip: '1.1.1.1', country: 'us' }],
            '2026-07-08',
        );
        assert.equal(changed, true);
        assert.deepEqual(history.days['2026-07-08'], [entry('1.1.1.1', { country: 'US' })]);
    });

    it('dedupes by IP within a day and back-fills empty fields', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-08'));
        const { history, changed } = mergeIntoHistory(
            state,
            [{ ip: '1.1.1.1', country: 'us', asn: 'AS13335' }],
            '2026-07-08',
        );
        assert.equal(changed, true);
        assert.deepEqual(history.days['2026-07-08'], [
            entry('1.1.1.1', { country: 'US', asn: 'AS13335' }),
        ]);
    });

    it('does not overwrite fields that already have a value', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1', org: 'First ISP' }], '2026-07-08'));
        const { history } = mergeIntoHistory(state, [{ ip: '1.1.1.1', org: 'Second ISP' }], '2026-07-08');
        assert.equal(history.days['2026-07-08'][0].org, 'First ISP');
    });

    it('reports changed=false when nothing new lands', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1', country: 'us' }], '2026-07-08'));
        const { history, changed } = mergeIntoHistory(state, [{ ip: '1.1.1.1', country: 'us' }], '2026-07-08');
        assert.equal(changed, false);
        assert.equal(history, state); // same reference — no needless persist
    });

    it('ignores invalid IPs and empty payloads', () => {
        const empty = createEmptyHistory();
        assert.equal(mergeIntoHistory(empty, [], '2026-07-08').changed, false);
        assert.equal(mergeIntoHistory(empty, [{ ip: 'Fetch Failed' }], '2026-07-08').changed, false);
        assert.equal(mergeIntoHistory(empty, null, '2026-07-08').changed, false);
    });

    it('keeps the same IP as separate records on different days', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-07'));
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-08'));
        assert.deepEqual(Object.keys(state.days).sort(), ['2026-07-07', '2026-07-08']);
    });

    it('does not mutate the input history', () => {
        const original = createEmptyHistory();
        mergeIntoHistory(original, [{ ip: '1.1.1.1' }], '2026-07-08');
        assert.deepEqual(original, createEmptyHistory());
    });
});

describe('pruneHistory', () => {
    it('keeps days inside the retention window, today included', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-08'));
        ({ history: state } = mergeIntoHistory(state, [{ ip: '8.8.8.8' }], '2026-04-10')); // 89 days before
        ({ history: state } = mergeIntoHistory(state, [{ ip: '9.9.9.9' }], '2026-04-09')); // 90 days before
        const { history, changed } = pruneHistory(state, '2026-07-08', IP_HISTORY_RETENTION_DAYS);
        assert.equal(changed, true);
        assert.deepEqual(Object.keys(history.days).sort(), ['2026-04-10', '2026-07-08']);
    });

    it('reports changed=false when nothing expires', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-08'));
        const { history, changed } = pruneHistory(state, '2026-07-08');
        assert.equal(changed, false);
        assert.equal(history, state);
    });

    it('handles a window crossing a year boundary', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2025-12-31'));
        const { history } = pruneHistory(state, '2026-01-05', 30);
        assert.deepEqual(Object.keys(history.days), ['2025-12-31']);
    });
});

describe('sortedHistoryDays', () => {
    it('returns day groups newest-first', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [{ ip: '1.1.1.1' }], '2026-07-06'));
        ({ history: state } = mergeIntoHistory(state, [{ ip: '8.8.8.8' }], '2026-07-08'));
        ({ history: state } = mergeIntoHistory(state, [{ ip: '9.9.9.9' }], '2026-07-07'));
        assert.deepEqual(sortedHistoryDays(state).map((g) => g.day), ['2026-07-08', '2026-07-07', '2026-07-06']);
    });
});

describe('groupHistoryByIP', () => {
    it('collapses 90 days of one stable IP to one summary without modifying records', () => {
        const days = Array.from({ length: 90 }, (_, i) => ({
            day: localDayKey(new Date(2026, 6, 1 + i)),
            entries: [entry('192.0.2.1')],
        }));
        const before = structuredClone(days);
        const result = groupHistoryByIP(days);
        assert.equal(result.length, 1);
        assert.equal(result[0].dayCount, 90);
        assert.equal(result[0].firstSeen, days[0].day);
        assert.equal(result[0].lastSeen, days[89].day);
        assert.deepEqual(result[0].dates, days.map(({ day }) => day).reverse());
        assert.deepEqual(days, before);
    });

    it('counts distinct observed dates, not duplicates or unobserved days in the span', () => {
        const days = [
            { day: '2026-07-01', entries: [entry('192.0.2.1'), entry('192.0.2.1')] },
            { day: '2026-07-09', entries: [entry('192.0.2.1')] },
        ];
        assert.deepEqual(groupHistoryByIP(days)[0], {
            ...entry('192.0.2.1'),
            dates: ['2026-07-09', '2026-07-01'],
            firstSeen: '2026-07-01', lastSeen: '2026-07-09', dayCount: 2,
        });
    });

    it('sorts by last seen descending with a stable IP tie-breaker, regardless of input order', () => {
        const days = [
            { day: '2026-07-01', entries: [entry('192.0.2.1')] },
            { day: '2026-07-09', entries: [entry('2001:db8::1'), entry('192.0.2.2')] },
        ];
        assert.deepEqual(groupHistoryByIP(days).map(({ ip }) => ip), [
            '192.0.2.2', '2001:db8::1', '192.0.2.1',
        ]);
        assert.deepEqual(groupHistoryByIP([...days].reverse()), groupHistoryByIP(days));
    });

    it('uses the latest matching snapshot without borrowing older geographic details', () => {
        const days = [
            { day: '2026-07-01', entries: [entry('192.0.2.1', { country: 'US', location: 'New York', asn: 'AS1' })] },
            { day: '2026-07-09', entries: [entry('192.0.2.1', { country: 'SG', asn: 'AS2' })] },
        ];
        const [summary] = groupHistoryByIP(days);
        assert.equal(summary.country, 'SG');
        assert.equal(summary.location, '');
        assert.equal(summary.asn, 'AS2');
        const [historical] = groupHistoryByIP(filterHistoryDays(days, { countries: ['US'] }));
        assert.equal(historical.country, 'US');
        assert.equal(historical.location, 'New York');
        assert.equal(historical.lastSeen, '2026-07-01');
        assert.equal(historical.dayCount, 1);
    });

    it('derives first seen and counts from retained records only', () => {
        const history = { version: 1, days: {
            '2026-07-01': [entry('192.0.2.1')],
            '2026-07-09': [entry('192.0.2.1')],
        } };
        const retained = pruneHistory(history, '2026-07-09', 1).history;
        const [summary] = groupHistoryByIP(sortedHistoryDays(retained));
        assert.equal(summary.firstSeen, '2026-07-09');
        assert.equal(summary.lastSeen, '2026-07-09');
        assert.equal(summary.dayCount, 1);
        assert.deepEqual(groupHistoryByIP([]), []);
    });
});

describe('unique IP facets', () => {
    const days = [
        { day: '2026-07-09', entries: [entry('192.0.2.1', { country: 'SG' }), entry('2001:db8::1')] },
        { day: '2026-07-08', entries: [entry('192.0.2.1', { country: 'SG' }), entry('2001:db8::1')] },
        { day: '2026-07-01', entries: [entry('192.0.2.1', { country: 'US' })] },
    ];

    it('counts one IP per country while retaining every historical country', () => {
        const facets = countryFacets(days, { uniqueIPs: true });
        assert.deepEqual(facets, [
            { code: '', count: 1 }, { code: 'SG', count: 1 }, { code: 'US', count: 1 },
        ]);
        for (const facet of facets) {
            assert.equal(groupHistoryByIP(filterHistoryDays(days, { countries: [facet.code] })).length, facet.count);
        }
        assert.equal(countryFacets(days).find(({ code }) => code === 'SG').count, 2);
        assert.deepEqual(countryFacets([], { uniqueIPs: true }), []);
    });

    it('deduplicates IP versions across days, with the original daily counts still available', () => {
        assert.deepEqual(ipVersionCounts(days, { uniqueIPs: true }), { v4: 1, v6: 1 });
        assert.deepEqual(ipVersionCounts(days), { v4: 3, v6: 2 });
        assert.deepEqual(ipVersionCounts([], { uniqueIPs: true }), { v4: 0, v6: 0 });
    });

    it('combines country selections without counting a shared IP twice', () => {
        const filtered = filterHistoryDays(days, { countries: ['SG', 'US'], versions: [4] });
        const summaries = groupHistoryByIP(filtered);
        assert.equal(summaries.length, 1);
        assert.equal(summaries[0].dayCount, 3);
    });
});

// Two-day history spanning US / SG / no-country entries and both IP versions,
// used by the filter suites below. Day 07-08: three v4 + one v6 (US);
// day 07-07: one v4 (US).
const buildFilterDays = () => {
    let state = createEmptyHistory();
    ({ history: state } = mergeIntoHistory(state, [
        { ip: '1.1.1.1', country: 'US' },
        { ip: '2.2.2.2', country: 'SG' },
        { ip: '3.3.3.3' },
        { ip: '2606:4700:4700::1111', country: 'US' },
    ], '2026-07-08'));
    ({ history: state } = mergeIntoHistory(state, [
        { ip: '4.4.4.4', country: 'US' },
    ], '2026-07-07'));
    return sortedHistoryDays(state);
};

describe('countryFacets', () => {
    it('counts entries per country across days, most entries first', () => {
        assert.deepEqual(countryFacets(buildFilterDays()), [
            { code: 'US', count: 3 },
            { code: '', count: 1 },
            { code: 'SG', count: 1 },
        ]);
    });

    it('breaks count ties by code ascending, is empty for an empty list', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [
            { ip: '1.1.1.1', country: 'US' },
            { ip: '2.2.2.2', country: 'DE' },
        ], '2026-07-08'));
        assert.deepEqual(countryFacets(sortedHistoryDays(state)).map((f) => f.code), ['DE', 'US']);
        assert.deepEqual(countryFacets([]), []);
    });

    it('groups mixed-case source codes into one facet', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [
            { ip: '1.1.1.1', country: 'SG' },
            { ip: '2606:4700:4700::1111', country: 'sg' },
        ], '2026-07-08'));
        const facets = countryFacets(sortedHistoryDays(state));
        assert.deepEqual(facets, [{ code: 'SG', count: 2 }]);
        // filtering by the normalized code matches both entries
        const days = filterHistoryDays(sortedHistoryDays(state), { countries: ['SG'] });
        assert.equal(days[0].entries.length, 2);
    });

    it('normalizes mixed-case codes already persisted in storage on parse', () => {
        const raw = JSON.stringify({
            version: 1,
            days: { '2026-07-08': [{ ip: '1.1.1.1', country: 'jp', location: '', asn: '', org: '' }] },
        });
        assert.equal(parseHistory(raw).days['2026-07-08'][0].country, 'JP');
    });
});

describe('distinctCountryCount', () => {
    it('counts unique countries across all days, ignoring empty codes', () => {
        let state = createEmptyHistory();
        ({ history: state } = mergeIntoHistory(state, [
            { ip: '1.1.1.1', country: 'US' },
            { ip: '2.2.2.2', country: 'DE' },
            { ip: '3.3.3.3', country: '' },
        ], '2026-07-07'));
        ({ history: state } = mergeIntoHistory(state, [
            { ip: '4.4.4.4', country: 'US' },
            { ip: '5.5.5.5', country: 'SG' },
        ], '2026-07-08'));
        assert.equal(distinctCountryCount(state), 3);
    });

    it('is 0 for an empty or missing history', () => {
        assert.equal(distinctCountryCount(createEmptyHistory()), 0);
        assert.equal(distinctCountryCount(undefined), 0);
    });
});

describe('ipVersionCounts', () => {
    it('counts v4 and v6 entries across days', () => {
        assert.deepEqual(ipVersionCounts(buildFilterDays()), { v4: 4, v6: 1 });
        assert.deepEqual(ipVersionCounts([]), { v4: 0, v6: 0 });
    });
});

describe('filterHistoryDays', () => {
    it('filters by a single country and drops emptied days', () => {
        const days = buildFilterDays();
        const sg = filterHistoryDays(days, { countries: ['SG'] });
        assert.deepEqual(sg.map((g) => g.day), ['2026-07-08']);
        assert.deepEqual(sg[0].entries.map((e) => e.ip), ['2.2.2.2']);
        const us = filterHistoryDays(days, { countries: ['US'] });
        assert.deepEqual(us.map((g) => g.day), ['2026-07-08', '2026-07-07']);
    });

    it('filters by IP version', () => {
        const days = buildFilterDays();
        const v6 = filterHistoryDays(days, { versions: [6] });
        assert.deepEqual(v6.map((g) => g.day), ['2026-07-08']);
        assert.deepEqual(v6[0].entries.map((e) => e.ip), ['2606:4700:4700::1111']);
        const v4 = filterHistoryDays(days, { versions: [4] });
        assert.deepEqual(v4.map((g) => g.day), ['2026-07-08', '2026-07-07']);
        assert.deepEqual(v4[0].entries.map((e) => e.ip), ['1.1.1.1', '2.2.2.2', '3.3.3.3']);
    });

    it('ORs values within a dimension and ANDs across dimensions', () => {
        const days = buildFilterDays();
        // SG OR unknown ('')
        const or = filterHistoryDays(days, { countries: ['SG', ''] });
        assert.deepEqual(or[0].entries.map((e) => e.ip), ['2.2.2.2', '3.3.3.3']);
        // US AND v4 — excludes the v6 US entry
        const and = filterHistoryDays(days, { versions: [4], countries: ['US'] });
        assert.deepEqual(and.map((g) => g.day), ['2026-07-08', '2026-07-07']);
        assert.deepEqual(and[0].entries.map((e) => e.ip), ['1.1.1.1']);
        // impossible combination → empty list
        assert.deepEqual(filterHistoryDays(days, { versions: [6], countries: ['SG'] }), []);
    });

    it('passes the list through untouched when no filter is active', () => {
        const days = buildFilterDays();
        assert.equal(filterHistoryDays(days), days);
        assert.equal(filterHistoryDays(days, {}), days);
        assert.equal(filterHistoryDays(days, { versions: [], countries: [] }), days);
    });
});
