// use-bulk-lookup.js — state of the Bulk IP Lookup tool: the looked-up rows,
// kept in localStorage (this browser only, never synced; shared by its tabs),
// and the run against /api/bulk-lookup, one request per chunk of new IPs.
// Pasting again only bumps counts of IPs already stored; new ones are
// queried. The pure helpers below are exported for tests.
import { ref, computed, getCurrentScope, onScopeDispose } from 'vue';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';
import { isUsablePublicIP } from '../utils/ip/valid-ip.js';
import { parseIp, parseCidr, formatCidr, compareIps } from '../utils/ip/ip-math.js';
import { BULK_LOOKUP_MAX_IPS } from '../utils/features/bulk-lookup-limits.js';

export const BULK_LOOKUP_STORAGE_KEY = 'bulkLookup';
// v1 also carried per-row enrichment (dropped on read); v1–v2 named the star
// flag `pinned`.
const STATE_VERSION = 3;
const READABLE_VERSIONS = [1, 2, 3];
export const MAX_ROWS = 2000;
// IPs per request: a larger run is split into sequential requests this size.
export const CHUNK_SIZE = BULK_LOOKUP_MAX_IPS;
const REQUEST_TIMEOUT_MS = 10000;
export const NOTE_MAX = 500;

const str = (v) => (typeof v === 'string' && v ? v : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/* ------------------------------------------------------------------ */
/* Stored shape                                                        */
/* ------------------------------------------------------------------ */

export const createEmptyState = () => ({ version: STATE_VERSION, source: null, rows: [] });

// One row in its stored shape, or null when it carries no usable IP.
export const sanitizeRow = (raw) => {
    if (!isObject(raw) || typeof raw.ip !== 'string' || !isUsablePublicIP(raw.ip)) return null;
    const country = str(raw.country)?.toUpperCase() ?? null;
    return {
        ip: raw.ip,
        count: Math.max(1, Math.floor(num(raw.count) ?? 1)),
        country: country && /^[A-Z]{2}$/.test(country) ? country : null,
        city: str(raw.city),
        region: str(raw.region),
        latitude: num(raw.latitude),
        longitude: num(raw.longitude),
        asn: str(raw.asn),
        org: str(raw.org),
        note: typeof raw.note === 'string' ? raw.note.slice(0, NOTE_MAX) : '',
        starred: raw.starred === true || raw.pinned === true,
        batchId: str(raw.batchId) ?? 'unknown',
        addedAt: num(raw.addedAt) ?? 0,
        lookedUpAt: num(raw.lookedUpAt) ?? num(raw.addedAt) ?? 0,
    };
};

// A localStorage string → state. Anything malformed degrades to what can be
// salvaged; duplicate IPs keep their first row.
export const parseState = (raw) => {
    if (!raw) return createEmptyState();
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return createEmptyState();
    }
    if (!isObject(parsed) || !READABLE_VERSIONS.includes(parsed.version) || !Array.isArray(parsed.rows)) {
        return createEmptyState();
    }
    const seen = new Set();
    const rows = [];
    for (const row of parsed.rows.map(sanitizeRow)) {
        if (!row || seen.has(row.ip) || rows.length >= MAX_ROWS) continue;
        seen.add(row.ip);
        rows.push(row);
    }
    const source = isObject(parsed.source) && str(parsed.source.id)
        ? { id: parsed.source.id, build: str(parsed.source.build) }
        : null;
    return { version: STATE_VERSION, source, rows };
};

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

// Requests a run of `n` new IPs takes.
export const requestCount = (n, size = CHUNK_SIZE) => Math.ceil(Math.max(0, n) / size);

// `entries` in request-sized chunks, order kept.
export const chunkEntries = (entries, size = CHUNK_SIZE) => {
    const chunks = [];
    for (let i = 0; i < entries.length; i += size) chunks.push(entries.slice(i, i + size));
    return chunks;
};

// Split extracted entries against the stored rows: known IPs only bump their
// count, new ones are queried over `requests` requests. Never a partial set:
// more new IPs than the list has room for (`listFull`) blocks the run.
export const planRun = (rows, entries, { maxRows = MAX_ROWS, chunkSize = CHUNK_SIZE } = {}) => {
    const known = new Set(rows.map((row) => row.ip));
    const existing = entries.filter((entry) => known.has(entry.ip));
    const fresh = entries.filter((entry) => !known.has(entry.ip));
    // Checked once, at the start: another tab filling the list meanwhile
    // leaves mergeRun to cut the overflow.
    const room = Math.max(0, maxRows - rows.length);
    const blocked = fresh.length > room ? 'listFull' : null;
    const toQuery = blocked ? [] : fresh;
    return {
        existing, toQuery, fresh: fresh.length, room, blocked, requests: requestCount(toQuery.length, chunkSize),
    };
};

// The paused remainder of a run whose request `failedAt` failed after earlier
// ones landed: the unqueried entries (with their counts) under the same batch.
export const pauseRun = ({ chunks, failedAt, batchId, done, total, kind }) => {
    const remaining = chunks.slice(failedAt).flat();
    return { batchId, remaining, done, total, kind };
};

// Plan for continuing a paused run: only its IPs still not stored, and no
// count bumps (the first part of the run already applied them).
export const planResume = (rows, paused, options) => ({ ...planRun(rows, paused.remaining, options), existing: [] });

// A failed run, by who can act on it: 'rateLimited' (429), 'transient'
// (network, timeout, 503 while data loads) or 'error' — only the last is our
// defect and worth a console.error (which Sentry captures).
export const runFailureKind = (error) => {
    const status = error?.status;
    if (status === 429) return 'rateLimited';
    if (!status || status === 503) return 'transient';
    return 'error';
};

// What the input's status bar says and what its button offers, from the
// extraction summary and the plan (or, while running, the run's `progress`:
// { request, requests, done, total }). One state each; `extras` are the side
// notes (requests a split run takes, already listed, skipped private, skipped CIDR).
export const inputStatus = ({
    hasText, summary, plan, running = false, progress = null, maxRows = MAX_ROWS,
}) => {
    const skipped = [['reserved', summary.reserved], ['cidr', summary.cidr]]
        .filter(([, n]) => n > 0)
        .map(([key, n]) => ({ key, n }));
    const make = (state, tone, params = {}, extras = [], button = { key: 'idle' }) => ({ state, tone, params, extras, button });

    if (running) {
        const total = progress ? progress.total : plan.fresh;
        if (!total) return make('updating', 'neutral');
        if (progress?.requests > 1) return make('runningSplit', 'neutral', { ...progress });
        return make('running', 'neutral', { n: total });
    }
    if (!hasText) return make('empty', 'neutral');
    if (!summary.unique) return make('none', 'neutral', {}, skipped);
    if (plan.blocked === 'listFull') return make('noRoom', 'warning', { n: plan.fresh, room: plan.room, max: maxRows });
    if (!plan.fresh) return make('known', 'neutral', { n: summary.unique }, skipped, { key: 'counts' });
    const split = plan.requests > 1 ? [{ key: 'split', n: plan.requests }] : [];
    const existing = plan.existing.length ? [{ key: 'existing', n: plan.existing.length }] : [];
    return make('ready', 'neutral', { n: summary.unique, fresh: plan.fresh }, [...split, ...existing, ...skipped],
        { key: 'run', n: plan.fresh });
};

// Rows after a run: counts bumped for `existing`, one new row per result.
export const mergeRun = (rows, { existing = [], results = [], counts = new Map(), batchId, at }) => {
    const bump = new Map(existing.map((entry) => [entry.ip, entry.count]));
    const next = rows.map((row) => (bump.has(row.ip) ? { ...row, count: row.count + bump.get(row.ip) } : row));
    const known = new Set(rows.map((row) => row.ip));
    for (const result of results) {
        if (!result || known.has(result.ip)) continue;
        const row = sanitizeRow({
            ...result, count: counts.get(result.ip) ?? 1, batchId, addedAt: at, lookedUpAt: at,
        });
        if (!row) continue;
        known.add(row.ip);
        next.push(row);
    }
    return next.slice(0, MAX_ROWS);
};

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

const asnNumber = (asn) => {
    const match = /^AS(\d+)$/i.exec(asn ?? '');
    return match ? Number(match[1]) : null;
};

// The address block an IP is grouped under: its /24 (IPv4) or /48 (IPv6),
// canonical. A grouping of addresses, not a network or an owner.
export const ipBlock = (ip) => {
    const parsed = parseIp(ip);
    if (!parsed) return null;
    return formatCidr(parseCidr(`${ip}/${parsed.family === 4 ? 24 : 48}`));
};

const defaultCompareText = (a, b) => a.localeCompare(b);

// Comparator for one column. Missing values sort last in either direction;
// `countryName` sorts countries by their shown name, `compareText` by locale.
export const compareRows = (key, dir = 'asc', { countryName = (code) => code, compareText = defaultCompareText } = {}) => {
    const sign = dir === 'desc' ? -1 : 1;
    const pick = {
        ip: (row) => parseIp(row.ip),
        count: (row) => row.count,
        country: (row) => (row.country ? countryName(row.country) || row.country : null),
        city: (row) => row.city,
        asn: (row) => asnNumber(row.asn),
        org: (row) => row.org,
    }[key];
    if (!pick) return () => 0;
    const compare = key === 'ip' ? compareIps : key === 'count' || key === 'asn' ? (a, b) => a - b : compareText;
    return (a, b) => {
        const x = pick(a);
        const y = pick(b);
        if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
        if (y === null || y === undefined) return -1;
        return sign * compare(x, y);
    };
};

/* Structured filters ride the search query as `country:US`, `asn:AS13335`
   and `block:203.0.113.0/24` tokens (keywords case-insensitive and English in
   every locale). Picks hold one canonical value per field (null = any), ANDed
   across fields; within a field the last token wins. A word that is no token
   (unknown keyword, no value) is free text. */

const PICK_FIELDS = ['country', 'asn', 'block'];

const TOKEN = /^(country|asn|block):(\S+)$/i;
// A keyword still waiting for its value (`country:` mid-typing).
const BARE_KEYWORD = /^(country|asn|block):$/i;

// A token value in the form rows are matched on: country codes and ASNs
// uppercased (bare digits gain `AS`), blocks canonical (a bare IP stands for
// its block, see ipBlock).
export const normalizePick = (field, value) => {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (field === 'asn') return /^\d+$/.test(text) ? `AS${text}` : text.toUpperCase();
    if (field === 'block') return formatCidr(parseCidr(text)) ?? ipBlock(text) ?? text.toLowerCase();
    return text.toUpperCase();
};

// One query word as { field, value }, or null when it is free text.
const readToken = (word) => {
    const match = TOKEN.exec(word);
    if (!match) return null;
    const field = match[1].toLowerCase();
    return { field, value: normalizePick(field, match[2]) };
};

const queryWords = (query) => String(query ?? '').split(/\s+/).filter(Boolean);

// The query as its picks and its free-text terms (lowercased); a bare
// keyword filters nothing, so a token being typed never empties the table.
export const parseQuery = (query) => {
    const picks = { country: null, asn: null, block: null };
    const terms = [];
    for (const word of queryWords(query)) {
        const token = readToken(word);
        if (token) picks[token.field] = token.value;
        else if (!BARE_KEYWORD.test(word)) terms.push(word.toLowerCase());
    }
    return { picks, terms };
};

/* Clicking an Analysis entry edits the query in place: the field's tokens
   (and a bare keyword of it) go, then the value is appended unless it was
   already the pick, which toggles it off. Other words keep their order. */

// The current pick for `field`, normalized; null when none.
export const queryPick = (query, field) => parseQuery(query).picks[field] ?? null;

// A word that sets (or is starting to set) `field`.
const isFieldWord = (word, field) => {
    const match = TOKEN.exec(word) ?? BARE_KEYWORD.exec(word);
    return Boolean(match) && match[1].toLowerCase() === field;
};

export const toggleQueryPick = (query, field, value) => {
    const pick = normalizePick(field, value);
    const words = queryWords(query);
    if (!pick) return words.join(' ');
    const kept = words.filter((word) => !isFieldWord(word, field));
    if (queryPick(query, field) !== pick) kept.push(`${field}:${pick}`);
    return kept.join(' ');
};

// What a row is searchable by: every shown field but the row number and the
// count. Country by code and by its name in each given language.
const searchFields = (row, countryNames) => [
    row.ip, row.region, row.city, row.asn, row.org, row.note,
    ...(row.country ? [row.country, ...countryNames.map((name) => name(row.country))] : []),
].filter((value) => typeof value === 'string' && value).map((value) => value.toLowerCase());

// Every term must hit some field (AND across terms, OR across fields).
export const matchesTerms = (row, terms, countryNames = []) => {
    if (!terms.length) return true;
    const fields = searchFields(row, countryNames);
    return terms.every((term) => fields.some((field) => field.includes(term)));
};

// A row's value per pick field, in normalizePick's form; '' when unknown.
const PICK_VALUES = {
    country: (row) => row.country ?? '',
    asn: (row) => normalizePick('asn', row.asn),
    block: (row) => ipBlock(row.ip) ?? '',
};

// Every set pick matches exactly.
export const matchesPicks = (row, picks) => PICK_FIELDS.every((field) => (picks[field] ?? null) === null
    || PICK_VALUES[field](row) === picks[field]);

// The page's scope filters: the `query` (its tokens, see parseQuery, and its terms,
// see matchesTerms; `countryNames` are name functions, e.g. UI language +
// English), plus exact `batchId` and `starredOnly`.
export const filterRows = (rows, {
    query = '', batchId = null, starredOnly = false, countryNames = [],
} = {}) => {
    const { picks, terms } = parseQuery(query);
    return rows.filter((row) => {
        if (starredOnly && !row.starred) return false;
        if (batchId !== null && row.batchId !== batchId) return false;
        return matchesPicks(row, picks) && matchesTerms(row, terms, countryNames);
    });
};

const GROUP_KEYS = {
    country: (row) => row.country,
    asn: (row) => row.asn,
    block: (row) => ipBlock(row.ip),
};

// Ranked groups of `field` ('country' | 'asn' | 'block'), weighted by IP
// ('ips') or by frequency ('hits'). Unknown values group under ''. ASN groups
// carry their org as `label`.
export const aggregateRows = (rows, field, { weight = 'ips' } = {}) => {
    const groups = new Map();
    const keyOf = GROUP_KEYS[field] ?? ((row) => row[field]);
    let total = 0;
    for (const row of rows) {
        const key = keyOf(row) ?? '';
        const value = weight === 'hits' ? row.count : 1;
        const group = groups.get(key) ?? { key, value: 0, label: null };
        group.value += value;
        if (field === 'asn' && !group.label && row.org) group.label = row.org;
        groups.set(key, group);
        total += value;
    }
    return [...groups.values()]
        .map((group) => ({ ...group, share: total ? group.value / total : 0 }))
        .sort((a, b) => b.value - a.value
            || (a.key === '') - (b.key === '')
            || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

export const TOP_SHARE_N = 10;

// Share of all occurrences held by the `n` most frequent IPs; null when there
// are no more than `n` rows (trivially all of it) or no occurrences.
export const topShare = (rows, n = TOP_SHARE_N) => {
    if (rows.length <= n) return null;
    const counts = rows.map((row) => row.count).sort((a, b) => b - a);
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (!total) return null;
    return counts.slice(0, n).reduce((sum, count) => sum + count, 0) / total;
};

export const TOP_GROUPS_N = 3;

// Share of the whole weight held by the `n` largest known groups of an
// aggregateRows list (unknown counts in the total only); null with no more
// than `n` known groups.
export const topGroupShare = (groups, n = TOP_GROUPS_N) => {
    const known = groups.filter((group) => group.key !== '');
    if (known.length <= n) return null;
    return known.slice(0, n).reduce((sum, group) => sum + group.share, 0);
};

// Share of IPs seen exactly once — the long tail; null with no rows.
export const onceShare = (rows) => (rows.length ? rows.filter((row) => row.count === 1).length / rows.length : null);

// One entry per paste, newest first.
export const listBatches = (rows) => {
    const batches = new Map();
    for (const row of rows) {
        const batch = batches.get(row.batchId) ?? { id: row.batchId, at: row.addedAt, size: 0 };
        batch.at = Math.min(batch.at, row.addedAt);
        batch.size += 1;
        batches.set(row.batchId, batch);
    }
    return [...batches.values()].sort((a, b) => b.at - a.at);
};

// Overview numbers: IPs, known countries and ASNs, total frequency, and the
// top-10 and once-only shares (see topShare / onceShare for their nulls).
export const summarizeRows = (rows) => ({
    rows: rows.length,
    countries: new Set(rows.map((row) => row.country).filter(Boolean)).size,
    asns: new Set(rows.map((row) => row.asn).filter(Boolean)).size,
    frequency: rows.reduce((sum, row) => sum + row.count, 0),
    topShare: topShare(rows),
    onceShare: onceShare(rows),
});

/* ------------------------------------------------------------------ */
/* Paging                                                              */
/* ------------------------------------------------------------------ */

export const PAGE_SIZES = [25, 50, 100];
export const DEFAULT_PAGE_SIZE = 50;

export const pageCount = (total, size) => Math.max(1, Math.ceil(total / size));

// The paging footer only earns its place past the smallest page size.
export const showPaging = (total) => total > PAGE_SIZES[0];

// 1-based page, kept within 1..pageCount (deleting rows can leave it past the end).
export const clampPage = (page, total, size) => Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, size));

export const pageSlice = (rows, page, size) => {
    const start = (clampPage(page, rows.length, size) - 1) * size;
    return rows.slice(start, start + size);
};

// 1-based { from, to, total } of the rows a page shows; from = 0 when empty.
export const pageRange = (page, total, size) => {
    if (!total) return { from: 0, to: 0, total: 0 };
    const from = (clampPage(page, total, size) - 1) * size + 1;
    return { from, to: Math.min(total, from + size - 1), total };
};

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

// RFC 4180 quoting, plus a leading `'` on cells a spreadsheet would run as a
// formula (= + - @, and tab / CR which some apps strip first).
export const csvCell = (value) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const isoOrEmpty = (ms) => (num(ms) ? new Date(ms).toISOString() : '');

// CSV of `rows`; `countryName` localizes the country column.
export const buildCsv = (rows, { countryName = () => '' } = {}) => {
    const header = ['ip', 'count', 'country_code', 'country_name', 'region', 'city', 'asn', 'org', 'starred', 'note', 'looked_up_at'];
    const lines = [header.join(',')];
    for (const row of rows) {
        lines.push([
            row.ip, row.count, row.country, row.country ? countryName(row.country) : '', row.region, row.city,
            row.asn, row.org, row.starred ? 'yes' : '', row.note, isoOrEmpty(row.lookedUpAt),
        ].map(csvCell).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
};

// BOM so spreadsheet apps read the file as UTF-8 (city names, notes).
export const downloadCsv = (csv, filename) => {
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

/* ------------------------------------------------------------------ */
/* Composable                                                          */
/* ------------------------------------------------------------------ */

// Merely touching localStorage throws in some privacy modes.
const defaultStorage = () => {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
};

export const useBulkLookup = ({
    storage = defaultStorage(), fetcher = fetchWithTimeout, events = globalThis.window,
} = {}) => {
    const storageError = ref(false);

    // The stored state, or null when there is no readable storage.
    const read = () => {
        try {
            return parseState(storage.getItem(BULK_LOOKUP_STORAGE_KEY));
        } catch {
            return null;
        }
    };

    const state = ref(read() ?? createEmptyState());
    const rows = computed(() => state.value.rows);
    const source = computed(() => state.value.source);

    // The stored list is the truth (another tab may have written it), unless
    // this tab's last write was refused: then only memory has its rows.
    const latest = () => (storageError.value ? null : read()) ?? state.value;

    // A refused write (quota, private mode) keeps the rows for this page view
    // and says so.
    const commit = (next) => {
        state.value = next;
        try {
            storage.setItem(BULK_LOOKUP_STORAGE_KEY, JSON.stringify(next));
            storageError.value = false;
        } catch {
            storageError.value = true;
        }
    };

    // Every change lands here, applied to the freshest state.
    const mutate = (change) => commit(change(latest()));

    const updateRow = (ip, patch) => mutate((current) => ({
        ...current, rows: current.rows.map((row) => (row.ip === ip ? { ...row, ...patch } : row)),
    }));

    // Another tab wrote the list (or cleared storage: key null). State sync,
    // not UI, so it stays attached while the kept-alive tool page is inactive.
    const onStorage = (event) => {
        if (event.key !== null && event.key !== BULK_LOOKUP_STORAGE_KEY) return;
        if (storageError.value) return;
        state.value = read() ?? state.value;
    };
    events?.addEventListener?.('storage', onStorage);
    if (getCurrentScope()) onScopeDispose(() => events?.removeEventListener?.('storage', onStorage));

    // One request: the answered results and the source they came from.
    const fetchChunk = async (ips, lang) => {
        const response = await fetcher('/api/bulk-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ips, lang }),
            timeoutMs: REQUEST_TIMEOUT_MS,
        });
        if (!response.ok) {
            const error = new Error(`Bulk lookup failed: HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        const body = await response.json();
        return {
            results: Array.isArray(body?.results) ? body.results : [],
            source: isObject(body?.source) ? { id: str(body.source.id), build: str(body.source.build) } : null,
        };
    };

    // While a run is in flight: { request, requests, done, total } over the IPs
    // this call queries.
    const progress = ref(null);
    // The unqueried rest of a run a failed request cut short (see pauseRun).
    // Memory only; dropped by a new run and by Clear all.
    const paused = ref(null);
    // Bumped by Clear all: a run started under an older generation is stale.
    let generation = 0;

    // Query `plan.toQuery` chunk by chunk, sequentially. Each answered chunk is
    // stored at once; the count bumps ride with the first (or land alone when
    // nothing is new). A failure before anything of the run was stored throws;
    // after, the rest is parked in `paused` and the outcome says so. `done` /
    // `total` count the whole run's new IPs, across a resume. A run gone stale
    // (Clear all meanwhile) stops where it is: nothing more stored or parked,
    // no throw, `cancelled` in the outcome. `unanswered` counts the queried IPs
    // missing from their chunk's answer.
    const execute = async (plan, { lang, batchId, done: doneBefore = 0, total = plan.toQuery.length }) => {
        const runGeneration = generation;
        const isStale = () => runGeneration !== generation;
        const chunks = chunkEntries(plan.toQuery);
        const counts = new Map(plan.toQuery.map((entry) => [entry.ip, entry.count]));
        let bumps = plan.existing;
        let done = doneBefore;
        let added = 0;
        let unanswered = 0;
        const store = (results, fetchedSource) => {
            const at = Date.now();
            mutate((current) => {
                const merged = mergeRun(current.rows, { existing: bumps, results, counts, batchId, at });
                added += merged.length - current.rows.length;
                return { ...current, source: fetchedSource ?? current.source, rows: merged };
            });
            bumps = [];
        };
        const outcome = (extra = {}) => ({
            blocked: null, added, updated: plan.existing.length, unanswered, paused: null, cancelled: false, ...extra,
        });

        try {
            if (!chunks.length) store([], null);
            for (const [index, chunk] of chunks.entries()) {
                progress.value = {
                    request: index + 1, requests: chunks.length, done: done - doneBefore, total: plan.toQuery.length,
                };
                const ips = chunk.map((entry) => entry.ip);
                let answer;
                try {
                    answer = await fetchChunk(ips, lang);
                } catch (error) {
                    if (isStale()) return outcome({ cancelled: true });
                    if (done === 0) throw error;
                    paused.value = pauseRun({ chunks, failedAt: index, batchId, done, total, kind: runFailureKind(error) });
                    return outcome({ paused: paused.value, error });
                }
                if (isStale()) return outcome({ cancelled: true });
                store(answer.results, answer.source);
                const answered = new Set(answer.results.map((result) => result?.ip));
                unanswered += ips.filter((ip) => !answered.has(ip)).length;
                done += ips.length;
            }
            return outcome();
        } finally {
            progress.value = null;
        }
    };

    // Look up the new IPs of `entries` (already extracted and canonical) and
    // fold everything into the list, as one batch. A blocked plan stores nothing.
    const run = async (entries, lang) => {
        paused.value = null;
        const plan = planRun(latest().rows, entries);
        if (plan.blocked) return { blocked: plan.blocked, added: 0, updated: 0, unanswered: 0, paused: null };
        return execute(plan, { lang, batchId: `b${Date.now().toString(36)}` });
    };

    // Continue the paused run: its remaining IPs, same batch, no count bumps.
    const resume = async (lang) => {
        const job = paused.value;
        if (!job) return null;
        const plan = planResume(latest().rows, job);
        if (plan.blocked) {
            return { blocked: plan.blocked, added: 0, updated: 0, unanswered: 0, paused: job, fresh: plan.fresh, room: plan.room };
        }
        paused.value = null;
        // job.done > 0, so a failure parks the rest again instead of throwing.
        return execute(plan, { lang, batchId: job.batchId, done: job.done, total: job.total });
    };

    const removeRow = (ip) => mutate((current) => ({ ...current, rows: current.rows.filter((row) => row.ip !== ip) }));
    const clearRows = ({ keepStarred = false } = {}) => {
        generation += 1;
        paused.value = null;
        mutate((current) => ({
            ...current, rows: keepStarred ? current.rows.filter((row) => row.starred) : [],
        }));
    };
    const toggleStar = (ip) => mutate((current) => ({
        ...current, rows: current.rows.map((row) => (row.ip === ip ? { ...row, starred: !row.starred } : row)),
    }));
    const setNote = (ip, note) => updateRow(ip, { note: String(note ?? '').slice(0, NOTE_MAX) });

    return {
        rows, source, storageError, progress, paused,
        run, resume, removeRow, clearRows, toggleStar, setNote,
    };
};
