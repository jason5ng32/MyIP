// use-bulk-lookup.js — state of the Bulk IP Lookup tool: the looked-up rows,
// kept in localStorage (this browser only, never synced; shared by its tabs),
// and the run against /api/bulk-lookup. Pasting again only bumps counts of IPs
// already stored; new ones are queried. The pure helpers below are exported
// for tests.
import { ref, computed, getCurrentScope, onScopeDispose } from 'vue';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';
import { isUsablePublicIP } from '../utils/ip/valid-ip.js';
import { parseIp, compareIps } from '../utils/ip/ip-math.js';

export const BULK_LOOKUP_STORAGE_KEY = 'bulkLookup';
// v1 also carried per-row enrichment (dropped on read); v1–v2 named the star
// flag `pinned`.
const STATE_VERSION = 3;
const READABLE_VERSIONS = [1, 2, 3];
export const MAX_ROWS = 2000;
export const MAX_NEW_PER_RUN = 100;
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

// Split extracted entries against the stored rows: known IPs only bump their
// count, new ones are queried. Never a partial set: more new IPs than one run
// takes (`perRun`) or than the list has room for (`listFull`) blocks the run.
export const planRun = (rows, entries, { maxNew = MAX_NEW_PER_RUN, maxRows = MAX_ROWS } = {}) => {
    const known = new Set(rows.map((row) => row.ip));
    const existing = entries.filter((entry) => known.has(entry.ip));
    const fresh = entries.filter((entry) => !known.has(entry.ip));
    const room = Math.max(0, maxRows - rows.length);
    let blocked = null;
    if (fresh.length > maxNew) blocked = 'perRun';
    else if (fresh.length > room) blocked = 'listFull';
    return { existing, toQuery: blocked ? [] : fresh, fresh: fresh.length, room, blocked };
};

// A failed run, by who can act on it: 'rateLimited' (429 from the edge),
// 'transient' (network, timeout, 503 while data loads) or 'error' — only the
// last is our defect and worth a console.error (which Sentry captures).
export const runFailureKind = (error) => {
    const status = error?.status;
    if (status === 429) return 'rateLimited';
    if (!status || status === 503) return 'transient';
    return 'error';
};

// What the input's status bar says and what its button offers, from the
// extraction summary and the plan. One state each; `extras` are the non-zero
// side counts (already listed, skipped private, skipped CIDR).
export const inputStatus = ({
    hasText, summary, plan, running = false, maxNew = MAX_NEW_PER_RUN, maxRows = MAX_ROWS,
}) => {
    const skipped = [['reserved', summary.reserved], ['cidr', summary.cidr]]
        .filter(([, n]) => n > 0)
        .map(([key, n]) => ({ key, n }));
    const make = (state, tone, params = {}, extras = [], button = { key: 'idle' }) => ({ state, tone, params, extras, button });

    if (running) return make(plan.fresh ? 'running' : 'updating', 'neutral', { n: plan.fresh });
    if (!hasText) return make('empty', 'neutral');
    if (!summary.unique) return make('none', 'neutral', {}, skipped);
    if (plan.blocked === 'perRun') return make('tooMany', 'warning', { n: plan.fresh, max: maxNew });
    if (plan.blocked === 'listFull') return make('noRoom', 'warning', { n: plan.fresh, room: plan.room, max: maxRows });
    if (!plan.fresh) return make('known', 'neutral', { n: summary.unique }, skipped, { key: 'counts' });
    const existing = plan.existing.length ? [{ key: 'existing', n: plan.existing.length }] : [];
    return make('ready', 'neutral', { n: summary.unique, fresh: plan.fresh }, [...existing, ...skipped],
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

// Search terms: whitespace-separated, lowercased.
export const queryTerms = (query) => String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);

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

// Filters: free-text `query` (see matchesTerms; `countryNames` are name
// functions, e.g. UI language + English), plus exact `batchId`, `country`
// and `asn` ('' = unknown, null = any) and `starredOnly`.
export const filterRows = (rows, {
    query = '', batchId = null, country = null, asn = null, starredOnly = false, countryNames = [],
} = {}) => {
    const terms = queryTerms(query);
    return rows.filter((row) => {
        if (starredOnly && !row.starred) return false;
        if (batchId !== null && row.batchId !== batchId) return false;
        if (country !== null && (row.country ?? '') !== country) return false;
        if (asn !== null && (row.asn ?? '') !== asn) return false;
        return matchesTerms(row, terms, countryNames);
    });
};

// Ranked groups of `field` ('country' | 'asn'), weighted by IP ('ips') or by
// occurrence count ('hits'). Unknown values group under ''. ASN groups carry
// their org as `label`.
export const aggregateRows = (rows, field, { weight = 'ips' } = {}) => {
    const groups = new Map();
    let total = 0;
    for (const row of rows) {
        const key = row[field] ?? '';
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

// Header-strip numbers.
export const summarizeRows = (rows) => ({
    rows: rows.length,
    countries: new Set(rows.map((row) => row.country).filter(Boolean)).size,
    asns: new Set(rows.map((row) => row.asn).filter(Boolean)).size,
    occurrences: rows.reduce((sum, row) => sum + row.count, 0),
});

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

    // Look up the new IPs of `entries` (already extracted and canonical) and
    // fold everything into the list. A blocked plan or a failed request
    // stores nothing.
    const run = async (entries, lang) => {
        const plan = planRun(latest().rows, entries);
        if (plan.blocked) return { blocked: plan.blocked, added: 0, updated: 0, unanswered: 0 };
        const ips = plan.toQuery.map((entry) => entry.ip);
        const results = [];
        let fetchedSource = null;
        if (ips.length) {
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
            if (Array.isArray(body?.results)) results.push(...body.results);
            if (isObject(body?.source)) fetchedSource = { id: str(body.source.id), build: str(body.source.build) };
        }

        const at = Date.now();
        let added = 0;
        mutate((current) => {
            const merged = mergeRun(current.rows, {
                existing: plan.existing,
                results,
                counts: new Map(plan.toQuery.map((entry) => [entry.ip, entry.count])),
                batchId: `b${at.toString(36)}`,
                at,
            });
            added = merged.length - current.rows.length;
            return { ...current, source: fetchedSource ?? current.source, rows: merged };
        });
        const listed = new Set(rows.value.map((row) => row.ip));
        const unanswered = ips.filter((ip) => !listed.has(ip)).length;
        return { blocked: null, added, updated: plan.existing.length, unanswered };
    };

    const removeRow = (ip) => mutate((current) => ({ ...current, rows: current.rows.filter((row) => row.ip !== ip) }));
    const clearRows = ({ keepStarred = false } = {}) => mutate((current) => ({
        ...current, rows: keepStarred ? current.rows.filter((row) => row.starred) : [],
    }));
    const toggleStar = (ip) => mutate((current) => ({
        ...current, rows: current.rows.map((row) => (row.ip === ip ? { ...row, starred: !row.starred } : row)),
    }));
    const setNote = (ip, note) => updateRow(ip, { note: String(note ?? '').slice(0, NOTE_MAX) });

    return {
        rows, source, storageError,
        run, removeRow, clearRows, toggleStar, setNote,
    };
};
