// Guards frontend/composables/use-bulk-lookup.js — the stored shape, run
// planning (accumulation, chunking, the list cap), merging, pause / resume,
// address blocks, sorting, filters, the search query's filter tokens (and
// toggling one from an Analysis entry),
// aggregation, top-N group share, the overview numbers (top-10 and once-only
// shares) and the full-list check, paging, CSV, and the composable's run /
// storage wiring over a stubbed fetch and storage, including two tabs sharing
// one list.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { effectScope } from 'vue';

import {
    BULK_LOOKUP_STORAGE_KEY, MAX_ROWS, CHUNK_SIZE,
    createEmptyState, sanitizeRow, parseState, planRun, requestCount, chunkEntries, pauseRun, planResume,
    runFailureKind, inputStatus, mergeRun, ipBlock, compareRows, filterRows,
    matchesTerms, aggregateRows, topShare, summarizeRows, listBatches,
    normalizePick, parseQuery, matchesPicks, toggleQueryPick, queryPick,
    onceShare, topGroupShare,
    pageCount, showPaging, clampPage, pageSlice, pageRange,
    csvCell, buildCsv, useBulkLookup,
} from '../frontend/composables/use-bulk-lookup.js';
import { BULK_LOOKUP_MAX_IPS } from '../common/bulk-lookup-limits.js';
import getCountryName from '../common/country-name.js';

const row = (ip, fields = {}) => sanitizeRow({ ip, count: 1, batchId: 'b1', addedAt: 1000, ...fields });
// `n` distinct public IPv4 entries.
const manyIps = (n, from = 0) => Array.from({ length: n }, (_, i) => {
    const k = i + from;
    return { ip: `8.${Math.floor(k / 62500) + 1}.${Math.floor(k / 250) % 250}.${(k % 250) + 1}`, count: 1 };
});

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

    it('requests chunks of the backend limit', () => {
        assert.equal(CHUNK_SIZE, 200);
        assert.equal(CHUNK_SIZE, BULK_LOOKUP_MAX_IPS);
        assert.deepEqual([0, 1, 200, 201, 400, 401].map((n) => requestCount(n)), [0, 1, 1, 2, 2, 3]);
        const entries = manyIps(450);
        const chunks = chunkEntries(entries);
        assert.deepEqual(chunks.map((c) => c.length), [200, 200, 50]);
        assert.deepEqual(chunks.flat(), entries, 'order kept, nothing lost');
        assert.deepEqual(chunkEntries([]), []);
        assert.deepEqual(chunkEntries(manyIps(5), 2).map((c) => c.length), [2, 2, 1]);
    });

    it('splits a large run instead of blocking it', () => {
        const plan = planRun([], manyIps(1500));
        assert.deepEqual([plan.blocked, plan.fresh, plan.toQuery.length, plan.requests], [null, 1500, 1500, 8]);
        assert.equal(planRun([], manyIps(200)).requests, 1);
        assert.equal(planRun([], []).requests, 0);
        // Known IPs need no request.
        const entries = manyIps(201);
        assert.equal(planRun([row(entries[0].ip)], entries).requests, 1);
    });

    it('blocks a run the list has no room for', () => {
        assert.equal(MAX_ROWS, 2000);
        const plan = planRun([row('8.8.8.8')], [{ ip: '1.1.1.1', count: 1 }, { ip: '9.9.9.9', count: 1 }], { maxRows: 2 });
        assert.deepEqual([plan.blocked, plan.room, plan.toQuery.length, plan.requests], ['listFull', 1, 0, 0]);
        assert.equal(planRun([], manyIps(MAX_ROWS + 1)).blocked, 'listFull');
        assert.equal(planRun([], manyIps(MAX_ROWS)).blocked, null);
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

    it('parks the unqueried rest of a run from the failed request on', () => {
        const chunks = chunkEntries(manyIps(5).map((e, i) => ({ ...e, count: i + 1 })), 2);
        const paused = pauseRun({ chunks, failedAt: 1, batchId: 'b9', done: 2, total: 5, kind: 'rateLimited' });
        assert.deepEqual(paused.remaining.map((e) => e.count), [3, 4, 5], 'counts ride along');
        assert.deepEqual([paused.batchId, paused.done, paused.total, paused.kind], ['b9', 2, 5, 'rateLimited']);
    });

    it('resumes only what is still not stored, with no count bumps', () => {
        const entries = manyIps(3);
        const paused = { remaining: entries, batchId: 'b9', done: 1, total: 4, kind: 'transient' };
        const plan = planResume([row(entries[0].ip)], paused);
        assert.deepEqual(plan.toQuery, entries.slice(1));
        assert.deepEqual(plan.existing, []);
        assert.equal(planResume([row('1.1.1.1')], paused, { maxRows: 2 }).blocked, 'listFull');
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

    it('a run needing several requests says so up front, still runnable', () => {
        const entries = manyIps(450);
        const s = inputStatus({
            hasText: true, summary: summaryOf(450, 2), plan: planRun([row(entries[0].ip)], entries),
        });
        assert.deepEqual([s.state, s.tone], ['ready', 'neutral']);
        assert.deepEqual(s.params, { n: 450, fresh: 449 });
        assert.deepEqual(s.extras, [{ key: 'split', n: 3 }, { key: 'existing', n: 1 }, { key: 'reserved', n: 2 }]);
        assert.deepEqual(s.button, { key: 'run', n: 449 });
        assert.ok(!status([], manyIps(CHUNK_SIZE)).extras.some((e) => e.key === 'split'), 'one request: no split note');
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

    it('while running, the run\'s progress beats the (shifting) plan', () => {
        const progress = { request: 2, requests: 3, done: 200, total: 450 };
        const s = status([], ips(4), { running: true, progress });
        assert.deepEqual([s.state, s.params], ['runningSplit', progress]);
        assert.deepEqual(status([], [], { running: true, progress: { request: 1, requests: 1, done: 0, total: 7 } }).params, { n: 7 });
        // A resume from an emptied input still shows its progress.
        assert.equal(inputStatus({
            hasText: false, summary: summaryOf(0), plan: planRun([], []), running: true, progress,
        }).state, 'runningSplit');
        assert.equal(status([], [], { running: true, progress: { request: 0, requests: 0, done: 0, total: 0 } }).state, 'updating');
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

    it('groups IPs by /24 (IPv4) and /48 (IPv6), canonically', () => {
        assert.equal(ipBlock('8.8.8.8'), '8.8.8.0/24');
        assert.equal(ipBlock('1.2.3.0'), '1.2.3.0/24');
        assert.equal(ipBlock('223.255.255.255'), '223.255.255.0/24');
        assert.equal(ipBlock('2606:4700:4700::1111'), '2606:4700:4700::/48');
        assert.equal(ipBlock('2001:DB8:ABCD:12::1'), '2001:db8:abcd::/48', 'lowercased, host bits cleared');
        assert.equal(ipBlock('2a00:1450:4001:0820:0000:0000:0000:200e'), '2a00:1450:4001::/48', 'expanded input');
        assert.equal(ipBlock('2001:0:0:1::1'), '2001::/48', 'zero groups compress');
        assert.equal(ipBlock('nope'), null);
        assert.equal(ipBlock(null), null);
    });

    it('filters by text, batch, tokens and star', () => {
        const ips = (opts) => filterRows(rows, opts).map((r) => r.ip);
        assert.deepEqual(ips({ query: 'cloudflare' }), ['1.1.1.1', '2606:4700:4700::1111']);
        assert.deepEqual(ips({ query: 'EDGE' }), ['1.1.1.1']);
        assert.deepEqual(ips({ query: 'austral', countryNames: [(c) => (c === 'AU' ? 'Australia' : '')] }), ['1.1.1.1']);
        assert.deepEqual(ips({ batchId: 'b2' }), ['2606:4700:4700::1111']);
        assert.deepEqual(ips({ query: 'country:US asn:AS13335' }), ['2606:4700:4700::1111']);
        assert.deepEqual(ips({ starredOnly: true }), ['1.1.1.1']);
        assert.deepEqual(ips({ query: 'block:2606:4700:4700::/48' }), ['2606:4700:4700::1111']);
        assert.deepEqual(ips({ query: 'block:8.8.8.0/24' }), ['8.8.8.8']);
        assert.deepEqual(ips({ query: 'block:8.8.8.0/24', starredOnly: true }), []);
        assert.deepEqual(ips({ query: 'block:10.0.0.0/24' }), []);
        assert.deepEqual(ips({ query: 'asn:AS13335 cloudflare', batchId: 'b1' }), ['1.1.1.1'], 'token, text and batch AND');
    });

    it('matches tokens exactly: country and ASN case-insensitive, blocks canonical', () => {
        const ips = (query) => filterRows(rows, { query }).map((r) => r.ip);
        assert.deepEqual(ips('country:us'), ips('COUNTRY:US'));
        assert.deepEqual(ips('country:us'), ['8.8.8.8', '2606:4700:4700::1111']);
        assert.deepEqual(ips('asn:as13335'), ['1.1.1.1', '2606:4700:4700::1111']);
        assert.deepEqual(ips('asn:13335'), ips('asn:AS13335'), 'bare digits gain AS');
        assert.deepEqual(ips('asn:AS1333'), [], 'exact, not a substring');
        assert.deepEqual(ips('country:U'), []);
        assert.deepEqual(ips('block:2606:4700:4700:0000::/48'), ['2606:4700:4700::1111'], 'IPv6 canonicalized');
        assert.deepEqual(ips('block:2606:4700:4700::1111'), ['2606:4700:4700::1111'], 'a bare IP means its block');
        assert.deepEqual(ips('block:8.8.8.77/24'), ['8.8.8.8'], 'host bits cleared');
        assert.deepEqual(ips('block:8.8.0.0/16'), [], 'only /24 and /48 blocks exist');
        assert.equal(matchesPicks(rows[3], { country: null, asn: 'AS19281', block: null }), true, 'null = any');
        assert.equal(matchesPicks(rows[3], parseQuery('country:US').picks), false, 'an unknown country never matches');
    });

    it('searches with every term hitting some field', () => {
        const zh = (code) => getCountryName(code, 'zh');
        const en = (code) => getCountryName(code, 'en');
        const search = (query, names = [zh, en]) => filterRows(rows, { query, countryNames: names }).map((r) => r.ip);
        assert.deepEqual(parseQuery('  美国\t 13335  ').terms, ['美国', '13335']);
        assert.deepEqual(search('美国'), ['8.8.8.8', '2606:4700:4700::1111']);
        assert.deepEqual(search('美国 13335'), ['2606:4700:4700::1111'], 'AND across terms');
        assert.deepEqual(search('united states'), ['8.8.8.8', '2606:4700:4700::1111']);
        assert.deepEqual(search('united   STATES ashburn'), ['2606:4700:4700::1111']);
        assert.deepEqual(search('Australia'), ['1.1.1.1'], 'English name while the UI is Chinese');
        assert.deepEqual(search('as13335'), search('13335'));
        assert.deepEqual(search('edge'), ['1.1.1.1'], 'note');
        assert.deepEqual(search('2606:4700'), ['2606:4700:4700::1111'], 'an IPv6 fragment is no token');
        assert.deepEqual(search(''), rows.map((r) => r.ip));
        assert.deepEqual(search('   '), rows.map((r) => r.ip));
    });

    it('never matches the occurrence count', () => {
        const only = [row('8.8.4.4', { count: 35, country: 'GB' })];
        const terms = (query) => parseQuery(query).terms;
        assert.equal(matchesTerms(only[0], terms('35')), false);
        assert.equal(matchesTerms(only[0], terms('8.4')), true);
        assert.equal(matchesTerms(only[0], terms('英国 8.8'), [(c) => getCountryName(c, 'zh')]), true);
        assert.equal(matchesTerms(only[0], terms('英国 35'), [(c) => getCountryName(c, 'zh')]), false);
    });

    it('parses tokens out of the query, the rest is free text', () => {
        assert.deepEqual(parseQuery(''), { picks: { country: null, asn: null, block: null }, terms: [] });
        assert.deepEqual(parseQuery('Germany Country:de asn:as3320 note BLOCK:2001:DB8:1::/48'), {
            picks: { country: 'DE', asn: 'AS3320', block: '2001:db8:1::/48' },
            terms: ['germany', 'note'],
        });
        assert.deepEqual(parseQuery('country:US country:au').picks.country, 'AU', 'last token of a field wins');
        // Unknown keyword: free text; a keyword with no value yet: ignored.
        assert.deepEqual(parseQuery('city:Paris country: asn:').terms, ['city:paris']);
        assert.deepEqual(parseQuery('country:').picks, { country: null, asn: null, block: null });
        assert.deepEqual(parseQuery('city:Paris country: asn:').picks, { country: null, asn: null, block: null });
        assert.deepEqual(parseQuery('block:nope').picks.block, 'nope', 'kept as typed: matches nothing');
    });

    it('toggles a pick on from an empty query', () => {
        assert.equal(toggleQueryPick('', 'country', 'US'), 'country:US');
        assert.equal(toggleQueryPick('  ', 'block', '203.0.113.0/24'), 'block:203.0.113.0/24');
    });

    it('appends a pick after the free text', () => {
        assert.equal(toggleQueryPick('Germany 3320', 'country', 'DE'), 'Germany 3320 country:DE');
        assert.equal(toggleQueryPick('  Germany \t 3320 ', 'country', 'DE'), 'Germany 3320 country:DE', 'single spaces, trimmed');
    });

    it('replaces a field\'s pick, keeping the other fields', () => {
        assert.equal(toggleQueryPick('country:US asn:AS13335 cloud', 'country', 'DE'), 'asn:AS13335 cloud country:DE');
        assert.equal(toggleQueryPick('country:US note country:AU', 'country', 'FR'), 'note country:FR', 'every token of the field goes');
        assert.equal(toggleQueryPick('paris country:', 'country', 'FR'), 'paris country:FR', 'a bare keyword of the field goes too');
    });

    it('toggles the current pick off, keeping the rest', () => {
        assert.equal(toggleQueryPick('Germany country:DE asn:AS3320', 'country', 'DE'), 'Germany asn:AS3320');
        assert.equal(toggleQueryPick('block:203.0.113.0/24', 'block', '203.0.113.0/24'), '');
        // The last token is the pick: an earlier, overridden one is no match.
        assert.equal(toggleQueryPick('country:DE country:US', 'country', 'DE'), 'country:DE');
    });

    it('recognizes a token keyword in any case', () => {
        assert.equal(toggleQueryPick('Country:de x', 'country', 'DE'), 'x');
        assert.equal(toggleQueryPick('Country:de x', 'country', 'US'), 'x country:US');
        assert.equal(toggleQueryPick('ASN:as3320', 'asn', 'AS3320'), '');
    });

    it('normalizes the value before toggling', () => {
        assert.equal(toggleQueryPick('', 'asn', '13335'), 'asn:AS13335');
        assert.equal(toggleQueryPick('asn:AS13335', 'asn', '13335'), '');
        assert.equal(toggleQueryPick('', 'country', 'us'), 'country:US');
        assert.equal(toggleQueryPick(' a  b ', 'country', ''), 'a b', 'a blank value changes nothing');
    });

    it('reads one field\'s current pick', () => {
        assert.equal(queryPick('Germany country:de', 'country'), 'DE');
        assert.equal(queryPick('asn:13335', 'asn'), 'AS13335');
        assert.equal(queryPick('Germany', 'block'), null);
        assert.equal(queryPick('country:', 'country'), null);
    });

    it('normalizes pick values', () => {
        assert.equal(normalizePick('country', ' us '), 'US');
        assert.equal(normalizePick('asn', 'as13335'), 'AS13335');
        assert.equal(normalizePick('asn', '13335'), 'AS13335');
        assert.equal(normalizePick('block', '2001:DB8:ABCD:12::1/48'), '2001:db8:abcd::/48');
        assert.equal(normalizePick('block', '203.0.113.9'), '203.0.113.0/24');
        assert.equal(normalizePick('country', ''), '');
        assert.equal(normalizePick('asn', null), '');
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

    it('feeds the map: known countries weighted by IPs or by frequency', () => {
        const values = (weight) => Object.fromEntries(aggregateRows(rows, 'country', { weight })
            .filter((g) => g.key).map((g) => [g.key, g.value]));
        assert.deepEqual(values('ips'), { US: 2, AU: 1 });
        assert.deepEqual(values('hits'), { AU: 10, US: 4 });
    });

    it('top-N group share: known groups over the whole weight', () => {
        const groups = [
            { key: 'US', value: 4, share: 0.4 }, { key: '', value: 3, share: 0.3 },
            { key: 'DE', value: 1, share: 0.1 }, { key: 'FR', value: 1, share: 0.1 }, { key: 'JP', value: 1, share: 0.1 },
        ];
        // US + DE + FR; the unknown group stays only in the denominator.
        assert.equal(topGroupShare(groups), 0.6);
        assert.equal(topGroupShare(groups.slice(0, 4)), null, 'three known groups or fewer');
        assert.equal(topGroupShare(groups, 4), null);
        assert.equal(topGroupShare(groups, 2), 0.5);
        assert.equal(topGroupShare([]), null);
        const countries = aggregateRows([...rows, row('8.8.4.4', { country: 'DE' }), row('8.8.4.5', { country: 'FR' })], 'country');
        // US 2 + AU 1 + DE 1 of 6 (the unknown row counts in the total).
        assert.equal(topGroupShare(countries), 4 / 6);
    });

    it('once-only share: IPs seen exactly once over all IPs', () => {
        assert.equal(onceShare(rows), 0.5);
        assert.equal(onceShare([row('8.8.4.4', { count: 2 })]), 0);
        assert.equal(onceShare([]), null);
    });

    it('aggregates address blocks, by IP or by occurrences', () => {
        const list = [...rows, row('8.8.8.4', { count: 2 }), row('2606:4700:4700::64', { count: 5 })];
        assert.deepEqual(aggregateRows(list, 'block').map((g) => [g.key, g.value]),
            [['2606:4700:4700::/48', 2], ['8.8.8.0/24', 2], ['1.1.1.0/24', 1], ['9.9.9.0/24', 1]]);
        assert.deepEqual(aggregateRows(list, 'block', { weight: 'hits' }).slice(0, 2).map((g) => [g.key, g.value]),
            [['1.1.1.0/24', 10], ['2606:4700:4700::/48', 6]]);
    });

    it('top-10 share: occurrences of the ten most frequent IPs over all', () => {
        assert.equal(topShare(rows), null, 'ten rows or fewer: trivially all');
        const list = manyIps(12).map((e, i) => row(e.ip, { count: i === 0 ? 89 : 1 }));
        // 89 + 9 of 100 occurrences.
        assert.equal(topShare(list), 0.98);
        assert.equal(topShare(list.slice(0, 10)), null);
        assert.equal(topShare(list.slice(0, 11)), 98 / 99);
    });

    it('summarizes the overview and lists batches newest first', () => {
        // Unknown country / ASN values aren't counted.
        assert.deepEqual(summarizeRows(rows), {
            rows: 4, countries: 2, asns: 3, frequency: 15, topShare: null, onceShare: 0.5,
        });
        assert.deepEqual(summarizeRows([row('8.8.4.4')]), {
            rows: 1, countries: 0, asns: 0, frequency: 1, topShare: null, onceShare: 1,
        });
        assert.deepEqual(summarizeRows([]), {
            rows: 0, countries: 0, asns: 0, frequency: 0, topShare: null, onceShare: null,
        });
        // Past ten rows the top-10 share is defined.
        const many = manyIps(12).map((e, i) => row(e.ip, { count: i === 0 ? 89 : 1 }));
        assert.equal(summarizeRows(many).topShare, 0.98);
        assert.equal(summarizeRows(many).onceShare, 11 / 12);
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
        const outcome = await lookup.run(manyIps(MAX_ROWS + 1), 'en');
        assert.equal(outcome.blocked, 'listFull');
        assert.deepEqual(calls, []);
        assert.equal(lookup.rows.value.length, 0);
    });

    it('splits a large run into sequential requests under one batch', async () => {
        const calls = [];
        let inFlight = 0;
        let maxInFlight = 0;
        const seen = [];
        const base = okFetch(calls);
        let lookup;
        const fetcher = async (url, options) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            seen.push({ ...lookup.progress.value, stored: lookup.rows.value.length });
            await new Promise((resolve) => { setTimeout(resolve, 0); });
            inFlight -= 1;
            return base(url, options);
        };
        lookup = useBulkLookup({ storage: memoryStorage(), fetcher });
        await lookup.run([{ ip: '1.1.1.1', count: 1 }], 'en');
        calls.length = 0;
        seen.length = 0;

        const entries = [{ ip: '1.1.1.1', count: 4 }, ...manyIps(450)];
        const outcome = await lookup.run(entries, 'en');
        assert.deepEqual(calls.map((ips) => ips.length), [200, 200, 50]);
        assert.equal(maxInFlight, 1, 'never in parallel');
        assert.deepEqual(seen.map((p) => [p.request, p.requests, p.done, p.total]), [[1, 3, 0, 450], [2, 3, 200, 450], [3, 3, 400, 450]]);
        assert.deepEqual(seen.map((p) => p.stored), [1, 201, 401], 'each chunk stored as it lands');
        assert.equal(lookup.progress.value, null);
        assert.deepEqual([outcome.added, outcome.updated, outcome.paused], [450, 1, null]);
        assert.equal(lookup.rows.value.find((r) => r.ip === '1.1.1.1').count, 5, 'bumped once');
        const batchIds = new Set(lookup.rows.value.slice(1).map((r) => r.batchId));
        assert.equal(batchIds.size, 1);
    });

    // Answers `fail` (a status, or a thrown error) on the given request numbers.
    const failingFetch = (calls, failOn) => {
        const base = okFetch(calls);
        let n = 0;
        return async (url, options) => {
            n += 1;
            const fail = failOn[n];
            if (fail instanceof Error) throw fail;
            if (fail) return { ok: false, status: fail };
            return base(url, options);
        };
    };

    it('a failure before anything landed stores nothing, bumps included', async () => {
        const storage = memoryStorage();
        const calls = [];
        const lookup = useBulkLookup({ storage, fetcher: failingFetch(calls, { 2: 429 }) });
        await lookup.run([{ ip: '1.1.1.1', count: 1 }], 'en');
        await assert.rejects(lookup.run([{ ip: '1.1.1.1', count: 3 }, ...manyIps(300)], 'en'), (e) => e.status === 429);
        assert.deepEqual(lookup.rows.value.map((r) => [r.ip, r.count]), [['1.1.1.1', 1]]);
        assert.equal(lookup.paused.value, null);
    });

    it('a failure mid-run keeps what landed and parks the rest; continue finishes it', async () => {
        const calls = [];
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher: failingFetch(calls, { 3: 429, 4: new TypeError('Failed to fetch') }) });
        const fresh = manyIps(450).map((e, i) => ({ ...e, count: (i % 3) + 1 }));
        await lookup.run([{ ip: '1.1.1.1', count: 1 }], 'en');

        const outcome = await lookup.run([{ ip: '1.1.1.1', count: 2 }, ...fresh], 'en');
        assert.equal(lookup.rows.value.length, 201);
        assert.equal(lookup.rows.value[0].count, 3, 'bumps rode with the first chunk');
        assert.equal(outcome.error.status, 429);
        assert.deepEqual([outcome.paused.kind, outcome.paused.done, outcome.paused.total, outcome.paused.remaining.length],
            ['rateLimited', 200, 450, 250]);
        assert.deepEqual(lookup.paused.value, outcome.paused);
        const batchId = lookup.rows.value[1].batchId;

        // The first continue fails at once: the remainder stays parked, counts untouched.
        const again = await lookup.resume('en');
        assert.equal(again.paused.kind, 'transient');
        assert.equal(again.paused.remaining.length, 250);
        assert.equal(lookup.rows.value.length, 201);

        const done = await lookup.resume('en');
        assert.deepEqual([done.added, done.updated, done.paused], [250, 0, null]);
        assert.equal(lookup.paused.value, null);
        assert.equal(lookup.rows.value.length, 451);
        assert.equal(lookup.rows.value[0].count, 3, 'no further bumps');
        assert.ok(lookup.rows.value.slice(1).every((r) => r.batchId === batchId), 'one batch across the pause');
        const counts = new Map(fresh.map((e) => [e.ip, e.count]));
        assert.ok(lookup.rows.value.slice(1).every((r) => r.count === counts.get(r.ip)), 'extracted counts kept');
        assert.equal(await lookup.resume('en'), null, 'nothing left to continue');
    });

    it('a new run or Clear all drops the parked remainder', async () => {
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher: failingFetch([], { 2: 503, 5: 503 }) });
        await lookup.run(manyIps(300), 'en');
        assert.ok(lookup.paused.value);
        await lookup.run([{ ip: '1.1.1.1', count: 1 }], 'en');
        assert.equal(lookup.paused.value, null);
        await lookup.run(manyIps(300, 1000), 'en');
        assert.ok(lookup.paused.value);
        lookup.clearRows();
        assert.equal(lookup.paused.value, null);
    });

    // A fetcher whose request `n` waits for `release()`, answering `answer`
    // (default: okFetch's). `started` resolves once that request is in flight.
    const gatedFetch = (calls, n, answer = null) => {
        const base = okFetch(calls);
        let count = 0;
        let markStarted;
        let release;
        const started = new Promise((resolve) => { markStarted = resolve; });
        const gate = new Promise((resolve) => { release = resolve; });
        const fetcher = async (url, options) => {
            count += 1;
            if (count === n) {
                markStarted();
                await gate;
                if (answer) return answer;
            }
            return base(url, options);
        };
        return { fetcher, started, release };
    };

    it('clearRows during a run stops the remaining chunks from being stored', async () => {
        const calls = [];
        const { fetcher, started, release } = gatedFetch(calls, 2);
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher });
        const pending = lookup.run(manyIps(450), 'en');
        await started;
        assert.equal(lookup.rows.value.length, 200, 'first chunk stored');
        lookup.clearRows();
        release();
        const outcome = await pending;
        assert.equal(outcome.cancelled, true);
        assert.equal(calls.length, 2, 'no request after the clear');
        assert.deepEqual(lookup.rows.value, []);
        assert.equal(lookup.paused.value, null);
        assert.equal(lookup.progress.value, null);
    });

    it('a request failing after clearRows neither parks the rest nor throws', async () => {
        const { fetcher, started, release } = gatedFetch([], 2, { ok: false, status: 429 });
        const lookup = useBulkLookup({ storage: memoryStorage(), fetcher });
        const pending = lookup.run(manyIps(450), 'en');
        await started;
        lookup.clearRows();
        release();
        const outcome = await pending;
        assert.deepEqual([outcome.cancelled, outcome.paused, outcome.error], [true, null, undefined]);
        assert.equal(lookup.paused.value, null);
        assert.deepEqual(lookup.rows.value, []);
    });

    it('counts unanswered IPs per chunk, not rows missing from the list', async () => {
        const calls = [];
        const base = okFetch(calls);
        let lookup;
        // Each answer leaves out its chunk's first IP; before the second
        // request the user deletes a stored row.
        const fetcher = async (url, options) => {
            if (calls.length === 1) lookup.removeRow(lookup.rows.value[0].ip);
            const response = await base(url, options);
            const body = await response.json();
            return { ok: true, json: async () => ({ ...body, results: body.results.slice(1) }) };
        };
        lookup = useBulkLookup({ storage: memoryStorage(), fetcher });
        const outcome = await lookup.run(manyIps(450), 'en');
        assert.equal(calls.length, 3);
        assert.equal(outcome.unanswered, 3, 'one per chunk; the deleted row is not counted');
        assert.equal(lookup.rows.value.length, 446);
    });

    it('a resume the list has no room for keeps the remainder parked', async () => {
        const storage = memoryStorage();
        const tabA = useBulkLookup({ storage, fetcher: failingFetch([], { 2: 503 }) });
        await tabA.run(manyIps(300), 'en');
        const job = tabA.paused.value;
        assert.equal(job.remaining.length, 100);
        // Another tab fills the list to 50 short of the cap.
        const tabB = useBulkLookup({ storage, fetcher: okFetch([]) });
        await tabB.run(manyIps(MAX_ROWS - 250, 5000), 'en');

        const outcome = await tabA.resume('en');
        assert.deepEqual([outcome.blocked, outcome.fresh, outcome.room], ['listFull', 100, 50]);
        assert.equal(outcome.paused, job);
        assert.equal(tabA.paused.value, job, 'still parked');
        assert.equal(parseState(storage.data[BULK_LOOKUP_STORAGE_KEY]).rows.length, MAX_ROWS - 50, 'nothing stored');
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
