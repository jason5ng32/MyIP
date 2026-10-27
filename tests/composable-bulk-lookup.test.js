// Guards frontend/composables/use-bulk-lookup.js — the stored shape, run
// planning (accumulation, per-run and list caps), merging, sorting, filters,
// aggregation, paging, CSV, and the composable's run / storage wiring over a
// stubbed fetch and storage, including two tabs sharing one list.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { effectScope } from 'vue';

import {
    BULK_LOOKUP_STORAGE_KEY, MAX_ROWS, MAX_NEW_PER_RUN,
    createEmptyState, sanitizeRow, parseState, planRun, runFailureKind, inputStatus, mergeRun, compareRows, filterRows,
    queryTerms, matchesTerms, aggregateRows, summarizeRows, listBatches, pageCount, showPaging, clampPage, pageSlice, pageRange,
    csvCell, buildCsv, useBulkLookup,
} from '../frontend/composables/use-bulk-lookup.js';
import getCountryName from '../common/country-name.js';

const row = (ip, fields = {}) => sanitizeRow({ ip, count: 1, batchId: 'b1', addedAt: 1000, ...fields });

describe('use-bulk-lookup — stored shape', () => {
    it('sanitizes rows and drops unusable IPs', () => {
        assert.equal(sanitizeRow({ ip: '10.0.0.1' }), null);
        assert.equal(sanitizeRow({ ip: 'nope' }), null);
        const r = sanitizeRow({ ip: '8.8.8.8', country: 'us', count: -3, note: 5, latitude: 'x', starred: 'yes' });
        assert.equal(r.country, 'US');
        assert.equal(r.count, 1);
        assert.equal(r.note, '');
        assert.equal(r.latitude, null);
        assert.equal(r.starred, false);
    });

    it('parses defensively: bad JSON, wrong version, duplicates', () => {
        assert.deepEqual(parseState('{oops'), createEmptyState());
        assert.deepEqual(parseState(JSON.stringify({ version: 99, rows: [] })), createEmptyState());
        assert.equal(createEmptyState().version, 3);
        const state = parseState(JSON.stringify({
            version: 1, source: { id: 'maxmind', build: '2026-10-20' },
            rows: [{ ip: '8.8.8.8', count: 2 }, { ip: '8.8.8.8', count: 9 }, { ip: '127.0.0.1' }],
        }));
        assert.equal(state.rows.length, 1);
        assert.equal(state.rows[0].count, 2);
        assert.deepEqual(state.source, { id: 'maxmind', build: '2026-10-20' });
    });

    it('reads a v2 store\'s `pinned` flag as `starred`', () => {
        const state = parseState(JSON.stringify({
            version: 2, rows: [{ ip: '8.8.8.8', pinned: true }, { ip: '1.1.1.1', pinned: false }],
        }));
        assert.deepEqual(state.rows.map((r) => r.starred), [true, false]);
        assert.ok(!('pinned' in state.rows[0]));
    });

    it('reads a v1 store, dropping its per-row enrichment', () => {
        const state = parseState(JSON.stringify({
            version: 1,
            rows: [{ ip: '8.8.8.8', note: 'kept', extra: { type: 'hosting', fetchedAt: 1 }, blocklist: { listed: 1, fetchedAt: 1 } }],
        }));
        assert.equal(state.version, 3);
        assert.equal(state.rows[0].note, 'kept');
        assert.ok(!('extra' in state.rows[0]) && !('blocklist' in state.rows[0]));
    });
});

describe('use-bulk-lookup — runs', () => {
    it('only queries new IPs; known ones just bump counts', () => {
        const plan = planRun([row('8.8.8.8')], [{ ip: '8.8.8.8', count: 5 }, { ip: '1.1.1.1', count: 2 }]);
        assert.deepEqual(plan.existing, [{ ip: '8.8.8.8', count: 5 }]);
        assert.deepEqual(plan.toQuery, [{ ip: '1.1.1.1', count: 2 }]);
        assert.equal(plan.blocked, null);
    });

    it('blocks the whole run past the per-run cap — never a partial set', () => {
        assert.equal(MAX_NEW_PER_RUN, 100);
        const entries = Array.from({ length: 101 }, (_, i) => ({ ip: `8.8.8.${i + 1}`, count: 1 }));
        const plan = planRun([], entries);
        assert.equal(plan.blocked, 'perRun');
        assert.equal(plan.fresh, 101);
        assert.equal(planRun([], entries.slice(0, 100)).blocked, null);
        assert.deepEqual(plan.toQuery, []);
        // Known IPs don't count toward the cap.
        const stored = entries.slice(0, 1).map((e) => row(e.ip));
        assert.equal(planRun(stored, entries).blocked, null);
    });

    it('blocks a run the list has no room for', () => {
        assert.equal(MAX_ROWS, 2000);
        const plan = planRun([row('8.8.8.8')], [{ ip: '1.1.1.1', count: 1 }, { ip: '9.9.9.9', count: 1 }], { maxRows: 2 });
        assert.deepEqual([plan.blocked, plan.room, plan.toQuery.length], ['listFull', 1, 0]);
        assert.equal(planRun([row('8.8.8.8')], [{ ip: '8.8.8.8', count: 1 }], { maxRows: 1 }).blocked, null);
    });

    it('merges counts and new rows without touching stored geography', () => {
        const stored = [row('8.8.8.8', { country: 'US', city: 'Mountain View' })];
        const next = mergeRun(stored, {
            existing: [{ ip: '8.8.8.8', count: 3 }],
            results: [{ ip: '8.8.8.8', country: 'DE' }, { ip: '1.1.1.1', country: 'AU', asn: 'AS13335' }],
            counts: new Map([['1.1.1.1', 7]]),
            batchId: 'b2',
            at: 2000,
        });
        assert.equal(next.length, 2);
        assert.equal(next[0].count, 4);
        assert.equal(next[0].country, 'US');
        assert.deepEqual([next[1].count, next[1].country, next[1].batchId, next[1].addedAt], [7, 'AU', 'b2', 2000]);
        assert.equal(stored[0].count, 1, 'input untouched');
    });
});

describe('use-bulk-lookup — input status', () => {
    const summaryOf = (unique, reserved = 0, cidr = 0) => ({ found: unique, unique, reserved, cidr });
    const status = (rows, entries, extra = {}) => inputStatus({
        hasText: true, summary: summaryOf(entries.length), plan: planRun(rows, entries), ...extra,
    });
    const ips = (n, from = 1) => Array.from({ length: n }, (_, i) => ({ ip: `8.8.${Math.floor((i + from) / 250)}.${((i + from) % 250) + 1}`, count: 1 }));

    it('empty textarea: neutral hint, idle button', () => {
        const s = inputStatus({ hasText: false, summary: summaryOf(0), plan: planRun([], []) });
        assert.deepEqual([s.state, s.tone, s.button.key], ['empty', 'neutral', 'idle']);
    });

    it('text without public IPs: neutral, only non-zero skips', () => {
        const s = inputStatus({ hasText: true, summary: summaryOf(0, 3, 0), plan: planRun([], []) });
        assert.equal(s.state, 'none');
        assert.deepEqual(s.extras, [{ key: 'reserved', n: 3 }]);
        assert.equal(s.button.key, 'idle');
    });

    it('ready: new count, side counts only when non-zero, runnable button', () => {
        const entries = ips(3);
        const s = inputStatus({ hasText: true, summary: summaryOf(3, 0, 2), plan: planRun([row(entries[0].ip)], entries) });
        assert.deepEqual([s.state, s.tone], ['ready', 'neutral']);
        assert.deepEqual(s.params, { n: 3, fresh: 2 });
        assert.deepEqual(s.extras, [{ key: 'existing', n: 1 }, { key: 'cidr', n: 2 }]);
        assert.deepEqual(s.button, { key: 'run', n: 2 });
        assert.deepEqual(status([], ips(2)).extras, []);
    });

    it('only known IPs: counts-only', () => {
        const entries = ips(2);
        const s = status(entries.map((e) => row(e.ip)), entries);
        assert.deepEqual([s.state, s.params.n, s.button.key], ['known', 2, 'counts']);
    });

    it('over the per-run cap: one warning with the numbers, idle button', () => {
        const s = status([], ips(MAX_NEW_PER_RUN + 1));
        assert.deepEqual([s.state, s.tone, s.button.key], ['tooMany', 'warning', 'idle']);
        assert.deepEqual(s.params, { n: MAX_NEW_PER_RUN + 1, max: MAX_NEW_PER_RUN });
    });

    it('over the list cap: one warning with the numbers', () => {
        const entries = ips(2);
        const s = inputStatus({
            hasText: true, summary: summaryOf(2), plan: planRun([row('1.1.1.1')], entries, { maxRows: 2 }), maxRows: 2,
        });
        assert.deepEqual([s.state, s.tone], ['noRoom', 'warning']);
        assert.deepEqual(s.params, { n: 2, room: 1, max: 2 });
    });

    it('running wins over everything else', () => {
        assert.deepEqual(status([], ips(4), { running: true }).state, 'running');
        assert.deepEqual(status([], ips(4), { running: true }).params, { n: 4 });
        const known = ips(1);
        assert.equal(status([row(known[0].ip)], known, { running: true }).state, 'updating');
    });
});

describe('use-bulk-lookup — views', () => {
    const rows = [
        row('8.8.8.8', { country: 'US', city: 'Mountain View', asn: 'AS15169', org: 'GOOGLE', count: 3 }),
        row('1.1.1.1', { country: 'AU', city: null, asn: 'AS13335', org: 'CLOUDFLARENET', count: 10, starred: true, note: 'edge' }),
        row('2606:4700:4700::1111', { country: 'US', city: 'Ashburn', asn: 'AS13335', org: 'CLOUDFLARENET', count: 1, batchId: 'b2', addedAt: 3000 }),
        row('9.9.9.9', { country: null, asn: 'AS19281', count: 1 }),
    ];
    const sortBy = (key, dir, options) => [...rows].sort(compareRows(key, dir, options)).map((r) => r.ip);

    it('sorts by country name, missing values last both ways', () => {
        const names = { US: 'United States', AU: 'Australia' };
        assert.deepEqual(sortBy('country', 'asc', { countryName: (c) => names[c] }),
            ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111', '9.9.9.9']);
        assert.deepEqual(sortBy('country', 'desc', { countryName: (c) => names[c] }),
            ['8.8.8.8', '2606:4700:4700::1111', '1.1.1.1', '9.9.9.9']);
    });

    it('sorts by city, ASN numerically, IP by family then value, count', () => {
        assert.deepEqual(sortBy('city', 'asc'), ['2606:4700:4700::1111', '8.8.8.8', '1.1.1.1', '9.9.9.9']);
        assert.deepEqual(sortBy('asn', 'asc'), ['1.1.1.1', '2606:4700:4700::1111', '8.8.8.8', '9.9.9.9']);
        assert.deepEqual(sortBy('ip', 'asc'), ['1.1.1.1', '8.8.8.8', '9.9.9.9', '2606:4700:4700::1111']);
        assert.deepEqual(sortBy('count', 'desc').slice(0, 2), ['1.1.1.1', '8.8.8.8']);
    });

    it('filters by text, batch, country, ASN and star', () => {
        const ips = (opts) => filterRows(rows, opts).map((r) => r.ip);
        assert.deepEqual(ips({ query: 'cloudflare' }), ['1.1.1.1', '2606:4700:4700::1111']);
        assert.deepEqual(ips({ query: 'EDGE' }), ['1.1.1.1']);
        assert.deepEqual(ips({ query: 'austral', countryNames: [(c) => (c === 'AU' ? 'Australia' : '')] }), ['1.1.1.1']);
        assert.deepEqual(ips({ batchId: 'b2' }), ['2606:4700:4700::1111']);
        assert.deepEqual(ips({ country: 'US', asn: 'AS13335' }), ['2606:4700:4700::1111']);
        assert.deepEqual(ips({ country: '' }), ['9.9.9.9']);
        assert.deepEqual(ips({ starredOnly: true }), ['1.1.1.1']);
    });

    it('searches with every term hitting some field', () => {
        const zh = (code) => getCountryName(code, 'zh');
        const en = (code) => getCountryName(code, 'en');
        const search = (query, names = [zh, en]) => filterRows(rows, { query, countryNames: names }).map((r) => r.ip);
        assert.deepEqual(queryTerms('  美国\t 13335  '), ['美国', '13335']);
        assert.deepEqual(search('美国'), ['8.8.8.8', '2606:4700:4700::1111']);
        assert.deepEqual(search('美国 13335'), ['2606:4700:4700::1111'], 'AND across terms');
        assert.deepEqual(search('united states'), ['8.8.8.8', '2606:4700:4700::1111']);
        assert.deepEqual(search('united   STATES ashburn'), ['2606:4700:4700::1111']);
        assert.deepEqual(search('Australia'), ['1.1.1.1'], 'English name while the UI is Chinese');
        assert.deepEqual(search('as13335'), search('13335'));
        assert.deepEqual(search('edge'), ['1.1.1.1'], 'note');
        assert.deepEqual(search(''), rows.map((r) => r.ip));
        assert.deepEqual(search('   '), rows.map((r) => r.ip));
    });

    it('never matches the occurrence count', () => {
        const only = [row('8.8.4.4', { count: 35, country: 'GB' })];
        assert.equal(matchesTerms(only[0], queryTerms('35')), false);
        assert.equal(matchesTerms(only[0], queryTerms('8.4')), true);
        assert.equal(matchesTerms(only[0], queryTerms('英国 8.8'), [(c) => getCountryName(c, 'zh')]), true);
        assert.equal(matchesTerms(only[0], queryTerms('英国 35'), [(c) => getCountryName(c, 'zh')]), false);
    });

    it('aggregates by IP count or by occurrences, unknown last on ties', () => {
        const byIps = aggregateRows(rows, 'country');
        assert.deepEqual(byIps.map((g) => [g.key, g.value]), [['US', 2], ['AU', 1], ['', 1]]);
        assert.equal(byIps[0].share, 0.5);
        const byHits = aggregateRows(rows, 'country', { weight: 'hits' });
        assert.deepEqual(byHits.map((g) => [g.key, g.value]), [['AU', 10], ['US', 4], ['', 1]]);
        const asns = aggregateRows(rows, 'asn');
        assert.deepEqual(asns[0], { key: 'AS13335', value: 2, label: 'CLOUDFLARENET', share: 0.5 });
    });

    it('summarizes the header strip and lists batches newest first', () => {
        assert.deepEqual(summarizeRows(rows), { rows: 4, countries: 2, asns: 3, occurrences: 15 });
        assert.deepEqual(listBatches(rows), [{ id: 'b2', at: 3000, size: 1 }, { id: 'b1', at: 1000, size: 3 }]);
    });
});

describe('use-bulk-lookup — paging', () => {
    it('counts pages, at least one', () => {
        assert.equal(pageCount(0, 50), 1);
        assert.equal(pageCount(50, 50), 1);
        assert.equal(pageCount(51, 50), 2);
    });

    it('shows the paging footer only past the smallest page size', () => {
        assert.equal(showPaging(0), false);
        assert.equal(showPaging(25), false);
        assert.equal(showPaging(26), true);
    });

    it('clamps a page into range', () => {
        assert.equal(clampPage(3, 120, 50), 3);
        assert.equal(clampPage(4, 120, 50), 3, 'past the end after deletes');
        assert.equal(clampPage(0, 120, 50), 1);
        assert.equal(clampPage(NaN, 120, 50), 1);
        assert.equal(clampPage(2, 0, 50), 1);
    });

    it('slices the clamped page', () => {
        const rows = Array.from({ length: 120 }, (_, i) => i);
        assert.deepEqual(pageSlice(rows, 1, 50).slice(0, 2), [0, 1]);
        assert.equal(pageSlice(rows, 3, 50).length, 20);
        assert.deepEqual(pageSlice(rows, 9, 50), pageSlice(rows, 3, 50));
    });

    it('labels the shown range', () => {
        assert.deepEqual(pageRange(1, 120, 50), { from: 1, to: 50, total: 120 });
        assert.deepEqual(pageRange(3, 120, 50), { from: 101, to: 120, total: 120 });
        assert.deepEqual(pageRange(1, 0, 50), { from: 0, to: 0, total: 0 });
    });
});

describe('use-bulk-lookup — CSV', () => {
    it('quotes per RFC 4180 and neutralizes formulas', () => {
        assert.equal(csvCell('plain'), 'plain');
        assert.equal(csvCell('a,b'), '"a,b"');
        assert.equal(csvCell('say "hi"'), '"say ""hi"""');
        assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
        assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
        for (const lead of ['+', '-', '@']) assert.equal(csvCell(`${lead}1`), `'${lead}1`);
        assert.equal(csvCell(null), '');
        assert.equal(csvCell(42), '42');
    });

    it('writes one localized line per row', () => {
        const csv = buildCsv([row('8.8.8.8', { country: 'US', org: 'GOOGLE, LLC', note: '=cmd', starred: true })],
            { countryName: () => 'United States' });
        const [header, line] = csv.trim().split('\r\n');
        assert.equal(header, 'ip,count,country_code,country_name,region,city,asn,org,starred,note,looked_up_at');
        assert.ok(line.startsWith('8.8.8.8,1,US,United States,,,,"GOOGLE, LLC",yes,\'=cmd,'));
        assert.ok(csv.endsWith('\r\n'));
    });
});

describe('use-bulk-lookup — composable', () => {
    const memoryStorage = () => ({
        data: {},
        getItem(k) { return this.data[k] ?? null; },
        setItem(k, v) { this.data[k] = v; },
    });
    const okFetch = (calls) => async (url, options) => {
        const { ips } = JSON.parse(options.body);
        calls.push(ips);
        return {
            ok: true,
            json: async () => ({
                source: { id: 'maxmind', build: '2026-10-20' },
                results: ips.map((ip) => ({ ip, country: 'US', asn: 'AS15169', org: 'GOOGLE' })),
            }),
        };
    };

    it('runs, persists, and on a re-paste only bumps counts', async () => {
        const storage = memoryStorage();
        const calls = [];
        const lookup = useBulkLookup({ storage, fetcher: okFetch(calls) });
        const first = await lookup.run([{ ip: '8.8.8.8', count: 2 }], 'en');
        assert.equal(first.added, 1);
        const second = await lookup.run([{ ip: '8.8.8.8', count: 3 }, { ip: '1.1.1.1', count: 1 }], 'en');
        assert.deepEqual([second.added, second.updated], [1, 1]);
        assert.deepEqual(calls, [['8.8.8.8'], ['1.1.1.1']]);
        assert.equal(lookup.rows.value.find((r) => r.ip === '8.8.8.8').count, 5);
        assert.equal(lookup.source.value.build, '2026-10-20');

        const reloaded = useBulkLookup({ storage, fetcher: okFetch([]) });
        assert.equal(reloaded.rows.value.length, 2);
        assert.ok(storage.data[BULK_LOOKUP_STORAGE_KEY]);
    });

    it('neither queries nor stores a blocked run', async () => {
        const calls = [];
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher: okFetch(calls) });
        const entries = Array.from({ length: 101 }, (_, i) => ({ ip: `8.8.8.${i + 1}`, count: 1 }));
        const outcome = await lookup.run(entries, 'en');
        assert.equal(outcome.blocked, 'perRun');
        assert.deepEqual(calls, []);
        assert.equal(lookup.rows.value.length, 0);
    });

    it('a re-paste of known IPs only bumps counts, with no request', async () => {
        const calls = [];
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher: okFetch(calls) });
        await lookup.run([{ ip: '8.8.8.8', count: 1 }], 'en');
        await lookup.run([{ ip: '8.8.8.8', count: 4 }], 'en');
        assert.equal(calls.length, 1);
        assert.equal(lookup.rows.value[0].count, 5);
    });

    it('stores nothing when the request fails', async () => {
        const storage = memoryStorage();
        const lookup = useBulkLookup({ storage, fetcher: async () => ({ ok: false, status: 503 }) });
        await assert.rejects(lookup.run([{ ip: '8.8.8.8', count: 1 }], 'en'), (e) => e.status === 503);
        assert.equal(lookup.rows.value.length, 0);
    });

    it('stars, notes, deletes, and clears keeping starred rows', async () => {
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher: okFetch([]) });
        await lookup.run([{ ip: '8.8.8.8', count: 1 }, { ip: '1.1.1.1', count: 1 }, { ip: '9.9.9.9', count: 1 }], 'en');
        lookup.toggleStar('1.1.1.1');
        lookup.setNote('1.1.1.1', 'keep me');
        lookup.removeRow('9.9.9.9');
        assert.equal(lookup.rows.value.length, 2);
        lookup.clearRows({ keepStarred: true });
        assert.deepEqual(lookup.rows.value.map((r) => [r.ip, r.note]), [['1.1.1.1', 'keep me']]);
        lookup.clearRows();
        assert.equal(lookup.rows.value.length, 0);
    });

    it('keeps working when storage refuses writes', async () => {
        const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
        const lookup = useBulkLookup({ storage, fetcher: okFetch([]) });
        await lookup.run([{ ip: '8.8.8.8', count: 1 }], 'en');
        assert.equal(lookup.rows.value.length, 1);
        assert.equal(lookup.storageError.value, true);
        // Memory holds the only copy: the next change builds on it.
        await lookup.run([{ ip: '1.1.1.1', count: 1 }], 'en');
        assert.deepEqual(lookup.rows.value.map((r) => r.ip), ['8.8.8.8', '1.1.1.1']);
    });

    it('applies each change to the stored list, keeping another tab\'s writes', async () => {
        const storage = memoryStorage();
        const tabA = useBulkLookup({ storage, fetcher: okFetch([]) });
        await tabA.run([{ ip: '8.8.8.8', count: 1 }, { ip: '1.1.1.1', count: 1 }], 'en');
        const tabB = useBulkLookup({ storage, fetcher: okFetch([]) });
        tabB.setNote('8.8.8.8', 'from B');

        // Tab A never saw B's note, yet neither a run nor a star loses it.
        await tabA.run([{ ip: '9.9.9.9', count: 1 }], 'en');
        tabA.toggleStar('1.1.1.1');
        const stored = parseState(storage.data[BULK_LOOKUP_STORAGE_KEY]);
        assert.deepEqual(stored.rows.map((r) => [r.ip, r.note, r.starred]),
            [['8.8.8.8', 'from B', false], ['1.1.1.1', '', true], ['9.9.9.9', '', false]]);
        assert.deepEqual(tabA.rows.value, stored.rows);
    });

    it('plans a run against the stored list', async () => {
        const storage = memoryStorage();
        const calls = [];
        const tabA = useBulkLookup({ storage, fetcher: okFetch(calls) });
        const tabB = useBulkLookup({ storage, fetcher: okFetch([]) });
        await tabB.run([{ ip: '8.8.8.8', count: 1 }], 'en');
        const outcome = await tabA.run([{ ip: '8.8.8.8', count: 2 }], 'en');
        assert.deepEqual(calls, []);
        assert.equal(outcome.updated, 1);
        assert.equal(tabA.rows.value[0].count, 3);
    });

    const eventTarget = () => ({
        listeners: new Set(),
        addEventListener(type, fn) { if (type === 'storage') this.listeners.add(fn); },
        removeEventListener(type, fn) { if (type === 'storage') this.listeners.delete(fn); },
        fire(key) { for (const fn of this.listeners) fn({ key }); },
    });

    it('reloads when another tab writes the list or clears storage', async () => {
        const storage = memoryStorage();
        const events = eventTarget();
        const tabA = useBulkLookup({ storage, fetcher: okFetch([]), events });
        const tabB = useBulkLookup({ storage, fetcher: okFetch([]) });
        await tabB.run([{ ip: '8.8.8.8', count: 1 }], 'en');

        events.fire('somethingElse');
        assert.equal(tabA.rows.value.length, 0);
        events.fire(BULK_LOOKUP_STORAGE_KEY);
        assert.deepEqual(tabA.rows.value.map((r) => r.ip), ['8.8.8.8']);

        storage.data = {};
        events.fire(null);
        assert.equal(tabA.rows.value.length, 0);
    });

    it('drops its storage listener with its scope', () => {
        const events = eventTarget();
        const scope = effectScope();
        scope.run(() => useBulkLookup({ storage: memoryStorage(), fetcher: okFetch([]), events }));
        assert.equal(events.listeners.size, 1);
        scope.stop();
        assert.equal(events.listeners.size, 0);
    });
});

describe('runFailureKind', () => {
    it('sorts a failed run by who can act on it', () => {
        assert.equal(runFailureKind({ status: 429 }), 'rateLimited');
        assert.equal(runFailureKind({ status: 503 }), 'transient');
        assert.equal(runFailureKind(new TypeError('Failed to fetch')), 'transient');
        assert.equal(runFailureKind(undefined), 'transient');
        assert.equal(runFailureKind({ status: 400 }), 'error');
        assert.equal(runFailureKind({ status: 500 }), 'error');
    });
});
