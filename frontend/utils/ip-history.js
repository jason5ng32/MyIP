// ip-history.js — pure helpers for the local (browser-only) IP detection
// history. Records live in localStorage, grouped by local calendar day, and
// never sync to the user's account. All functions here are pure and
// storage-agnostic so they can be unit-tested; the localStorage wiring lives
// in composables/use-ip-history.js.
import { isValidIP, isIPv6 } from './valid-ip.js';

export const IP_HISTORY_STORAGE_KEY = 'ipHistory';
export const IP_HISTORY_RETENTION_DAYS = 90;
export const IP_HISTORY_MIN_DAYS = 1;
const CURRENT_VERSION = 1;

// Clamp a user-configured retention value to a whole day in [1, 90];
// anything non-numeric falls back to the 90-day default.
export const clampRetentionDays = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return IP_HISTORY_RETENTION_DAYS;
    return Math.min(IP_HISTORY_RETENTION_DAYS, Math.max(IP_HISTORY_MIN_DAYS, Math.round(n)));
};

// Fields carried by every stored entry besides `ip`. Kept in one place so
// sanitizing / merging / back-filling stay in sync.
const DETAIL_FIELDS = ['country', 'location', 'asn', 'org'];

// Local-timezone YYYY-MM-DD key for a Date (defaults to now).
export const localDayKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const createEmptyHistory = () => ({ version: CURRENT_VERSION, days: {} });

// Normalize one raw entry into the stored shape, or null when it doesn't
// carry a well-formed IP (error placeholders, junk from a corrupted store).
const sanitizeEntry = (raw) => {
    if (!raw || typeof raw.ip !== 'string' || !isValidIP(raw.ip)) return null;
    const entry = { ip: raw.ip };
    for (const field of DETAIL_FIELDS) {
        entry[field] = typeof raw[field] === 'string' ? raw[field] : '';
    }
    // Country codes arrive in whatever case the IP source uses ('SG' vs
    // 'sg'); store them uppercase so facet grouping and filtering can't
    // split one country into two tags. Runs on load too, so pre-existing
    // mixed-case records self-heal.
    entry.country = entry.country.toUpperCase();
    return entry;
};

// Parse a raw localStorage string into a history object. Any malformed input
// (bad JSON, wrong shape, junk entries) degrades to an empty / partial history
// rather than throwing — the history is best-effort, never load-bearing.
export const parseHistory = (raw) => {
    if (!raw) return createEmptyHistory();
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return createEmptyHistory();
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.days || typeof parsed.days !== 'object') {
        return createEmptyHistory();
    }
    const days = {};
    for (const [day, entries] of Object.entries(parsed.days)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(entries)) continue;
        const cleaned = entries.map(sanitizeEntry).filter(Boolean);
        if (cleaned.length) days[day] = cleaned;
    }
    return { version: CURRENT_VERSION, days };
};

// Merge detected entries into one day's bucket. Deduped by `ip`; a later
// entry back-fills detail fields the stored one is missing. Pure — returns
// { history, changed } and never mutates the input.
export const mergeIntoHistory = (history, entries, dayKey) => {
    const incoming = (entries || []).map(sanitizeEntry).filter(Boolean);
    if (!incoming.length) return { history, changed: false };

    const day = (history.days[dayKey] || []).map((e) => ({ ...e }));
    const byIp = new Map(day.map((e) => [e.ip, e]));
    let changed = false;

    for (const entry of incoming) {
        const existing = byIp.get(entry.ip);
        if (!existing) {
            day.push(entry);
            byIp.set(entry.ip, entry);
            changed = true;
        } else {
            for (const field of DETAIL_FIELDS) {
                if (!existing[field] && entry[field]) {
                    existing[field] = entry[field];
                    changed = true;
                }
            }
        }
    }

    if (!changed) return { history, changed: false };
    return {
        history: { ...history, days: { ...history.days, [dayKey]: day } },
        changed: true,
    };
};

// Drop day buckets older than the retention window (today included).
// Pure — returns { history, changed }.
export const pruneHistory = (history, todayKey, retentionDays = IP_HISTORY_RETENTION_DAYS) => {
    const [y, m, d] = todayKey.split('-').map(Number);
    // Oldest day still kept: today - (retentionDays - 1).
    const cutoffKey = localDayKey(new Date(y, m - 1, d - (retentionDays - 1)));
    const kept = {};
    let changed = false;
    for (const [day, entries] of Object.entries(history.days)) {
        if (day >= cutoffKey) {
            kept[day] = entries;
        } else {
            changed = true;
        }
    }
    if (!changed) return { history, changed: false };
    return { history: { ...history, days: kept }, changed: true };
};

// Day buckets as a render-ready list, newest day first.
export const sortedHistoryDays = (history) =>
    Object.entries(history.days)
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([day, entries]) => ({ day, entries }));

// Aggregate entry counts per country over a sortedHistoryDays() list, most
// entries first (code asc as tie-breaker). Entries without a country roll up
// under ''. Takes the day list rather than the history object so facets can
// be computed on an already-filtered view (e.g. after the IP-type filter).
export const countryFacets = (days) => {
    const counts = new Map();
    for (const { entries } of days) {
        for (const { country } of entries) {
            const code = country || '';
            counts.set(code, (counts.get(code) || 0) + 1);
        }
    }
    return [...counts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : 1));
};

// Distinct country codes recorded across the whole history (entries without
// a country don't count). Feeds the iphistory:updated achievement event.
export const distinctCountryCount = (history) => {
    const codes = new Set();
    for (const entries of Object.values(history?.days || {})) {
        for (const { country } of entries) {
            if (country) codes.add(country);
        }
    }
    return codes.size;
};

// Entry counts per IP version over a sortedHistoryDays() list.
export const ipVersionCounts = (days) => {
    let v4 = 0;
    let v6 = 0;
    for (const { entries } of days) {
        for (const { ip } of entries) {
            if (isIPv6(ip)) v6 += 1;
            else v4 += 1;
        }
    }
    return { v4, v6 };
};

// Narrow a sortedHistoryDays() list by any combination of tag selections:
// `versions` — IP versions to keep (4 / 6); `countries` — country codes to
// keep ('' matches entries recorded without a country). Within a dimension
// the values OR together; the two dimensions AND. An empty / omitted array
// leaves that dimension unfiltered. Emptied days are dropped.
export const filterHistoryDays = (days, { versions = [], countries = [] } = {}) => {
    if (!versions.length && !countries.length) return days;
    return days
        .map(({ day, entries }) => ({
            day,
            entries: entries.filter((e) =>
                (!versions.length || versions.includes(isIPv6(e.ip) ? 6 : 4)) &&
                (!countries.length || countries.includes(e.country || ''))),
        }))
        .filter((group) => group.entries.length > 0);
};
