// Snapshots diff view, pure layer: turns one homepage section of two
// snapshots into code-diff hunks — a hunk per keyed item (IP card by source,
// connectivity target / STUN server / DNS provider by id; the speed test is
// one item), a line per field — and formats the recorded values. Marks mean
// removed / added like any code diff, never worse / better (plan red line).
// `viewed` is the snapshot shown, `compared` the baseline. Also the inline
// (word-level) segments of a changed value.

import { keyedItems, sectionFields, fieldKind, speedTier } from './snapshot-diff.js';
import { IP_TYPE_KEYS, CONNECTIVITY_STATUS_KEYS, natTypeKey } from './snapshot-view.js';
import { ANONYMITY_I18N_KEYS } from '../ip/transform-ip-data.js';

// --- fields -----------------------------------------------------------------

// The field each keyed section names its items by (the hunk header).
const ITEM_NAME_FIELDS = { ipinfo: 'source', connectivity: 'name', webrtc: 'url', dnsleak: 'name' };

// A section's field lines in display order; speedtest's derived `tier` is a
// noise gate, not a line.
export const sectionFieldOrder = (sectionId) => sectionFields(sectionId).filter((field) => field !== 'tier');

// i18n key of a field's label (dotted speedtest fields nest).
export const fieldLabelKey = (field) => `snapshots.fields.${field}`;

// One field of an item; dotted fields read one level down, null reads as absent.
export const readField = (item, field) => {
    const [head, tail] = field.split('.');
    const value = tail ? item?.[head]?.[tail] : item?.[head];
    return value ?? undefined;
};

// --- values -----------------------------------------------------------------

const COUNTRY_FIELDS = new Set(['countryCode', 'connection.coloCountryCode']);
const BOOLEAN_FIELDS = new Set(['nativeIP', 'custom']);
const MS_FIELDS = new Set(['timeMs', 'minTimeMs', 'latencyMs', 'jitterMs', 'loadedLatencyDownMs', 'loadedLatencyUpMs']);
const MBPS_FIELDS = new Set(['downloadMbps', 'uploadMbps']);

export const EMPTY_VALUE = '—';

const isEmpty = (value) => value === undefined || value === null || value === '';

// The flag code of a country field's value, else ''.
export const fieldFlag = (field, value) =>
    (COUNTRY_FIELDS.has(field) && typeof value === 'string' && value ? value.toLowerCase() : '');

// A recorded value as text: countries by name, enums through the homepage's
// own labels, booleans as yes / no, measurements with their unit; a missing
// value is a dash. `t` and `countryName` come from the caller.
export const formatFieldValue = (field, value, { t = (key) => key, countryName, locale } = {}) => {
    if (isEmpty(value)) return EMPTY_VALUE;
    const number = (n) => n.toLocaleString(locale || undefined, { maximumFractionDigits: 1 });
    const label = (keys) => (keys[value] ? t(keys[value]) : String(value));

    if (COUNTRY_FIELDS.has(field)) return countryName?.(value) || String(value);
    if (BOOLEAN_FIELDS.has(field)) return t(value ? 'snapshots.Yes' : 'snapshots.No');
    if (field === 'anonymity') return label(ANONYMITY_I18N_KEYS);
    if (field === 'ipType') return label(IP_TYPE_KEYS);
    if (field === 'status') return label(CONNECTIVITY_STATUS_KEYS);
    if (field === 'natType') return t(natTypeKey(value));
    if (field.startsWith('qualities.')) return t(`speedtest.quality.${value}`);
    if (typeof value !== 'number') return String(value);
    if (MS_FIELDS.has(field)) return `${number(value)} ms`;
    if (MBPS_FIELDS.has(field)) return `${number(value)} Mb/s`;
    if (field === 'qualityScore') return `${number(value)}/100`;
    return number(value);
};

// --- hunks ------------------------------------------------------------------

const SPEEDTEST_KEY = 'speedtest';

const itemsOf = (sectionId, section) => {
    if (!section) return new Map();
    return sectionId === 'speedtest' ? new Map([[SPEEDTEST_KEY, section]]) : keyedItems(sectionId, section);
};

const hunkName = (sectionId, key, item) => {
    if (sectionId === 'speedtest') return ['Cloudflare', item?.connection?.colo].filter(Boolean).join(' ');
    return item?.[ITEM_NAME_FIELDS[sectionId]] || key;
};

// One side's fields as plain context: nothing is compared.
const contextLines = (sectionId, item) => {
    const nameField = ITEM_NAME_FIELDS[sectionId];
    return sectionFieldOrder(sectionId)
        .filter((field) => field !== nameField && readField(item, field) !== undefined)
        .map((field) => ({ field, kind: fieldKind(field), mark: ' ', value: readField(item, field), otherValue: undefined }));
};

// Both sides' fields. A changed field is a −/+ pair; a drifting measurement
// is one `±` context line unless `showDrift`, except the download when it
// crossed a speed tier (the diff's noise gate). The name field is the hunk
// header and only gets lines when it changed.
const compareLines = (sectionId, viewed, compared, showDrift) => {
    const nameField = ITEM_NAME_FIELDS[sectionId];
    const fromTier = speedTier(compared?.downloadMbps);
    const toTier = speedTier(viewed?.downloadMbps);
    const tierCrossed = sectionId === 'speedtest' && fromTier !== null && toTier !== null && fromTier !== toTier;

    return sectionFieldOrder(sectionId).flatMap((field) => {
        const from = readField(compared, field);
        const to = readField(viewed, field);
        if (from === undefined && to === undefined) return [];
        const kind = fieldKind(field);
        if (from === to) {
            return field === nameField ? [] : [{ field, kind, mark: ' ', value: to, otherValue: from }];
        }
        const gated = tierCrossed && field === 'downloadMbps';
        if (kind === 'drift' && !gated && !showDrift) {
            return [{ field, kind, mark: '±', value: to, otherValue: from }];
        }
        return [
            { field, kind, mark: '-', value: from, otherValue: to },
            { field, kind, mark: '+', value: to, otherValue: from },
        ];
    });
};

const makeHunk = (key, name, status, lines) => {
    const changedCount = lines.filter((line) => line.mark === '-').length;
    // Open: a plain view, or a compared item with a −/+ line.
    const open = status === 'single' || (status === 'both' && changedCount > 0);
    return { key: `${status}:${key}`, name, status, changedCount, open, lines };
};

// → [{ key, name, status, changedCount, open, lines }], `status` one of
// 'both' (compared), 'onlyViewed' / 'onlyCompared' (one side only, not
// compared: plain lines, closed), 'single' (nothing to compare with: no
// comparison chosen, or the compared snapshot lacks the section; open).
// Line: { field, kind, mark: ' ' | '-' | '+' | '±', value, otherValue }.
// `diffSection` is diffSnapshots()'s section, null when not comparing.
// Viewed order first, then the items only the compared snapshot holds.
export const buildHunks = (sectionId, diffSection, viewedSection, comparedSection, { showDrift = false } = {}) => {
    const viewed = itemsOf(sectionId, viewedSection);
    const plain = !diffSection || diffSection.status !== 'both';
    if (plain) {
        return [...viewed].map(([key, item]) =>
            makeHunk(key, hunkName(sectionId, key, item), 'single', contextLines(sectionId, item)));
    }

    const compared = itemsOf(sectionId, comparedSection);
    const hunks = [...viewed].map(([key, item]) => {
        const name = hunkName(sectionId, key, item);
        if (!compared.has(key)) return makeHunk(key, name, 'onlyViewed', contextLines(sectionId, item));
        return makeHunk(key, name, 'both', compareLines(sectionId, item, compared.get(key), showDrift));
    });
    for (const [key, item] of compared) {
        if (viewed.has(key)) continue;
        hunks.push(makeHunk(key, hunkName(sectionId, key, item), 'onlyCompared', contextLines(sectionId, item)));
    }
    return hunks;
};

// The block header's counts.
export const hunkCounts = (hunks) => ({
    changed: hunks.filter((hunk) => hunk.changedCount > 0).length,
    onlyViewed: hunks.filter((hunk) => hunk.status === 'onlyViewed').length,
    onlyCompared: hunks.filter((hunk) => hunk.status === 'onlyCompared').length,
});

// What the block says about a missing section: 'notRunHere' (the viewed
// snapshot lacks it), 'notRunThere' (only the compared one does), or null.
export const blockNotice = (viewedSection, comparedSection, comparing) => {
    if (!viewedSection) return 'notRunHere';
    if (comparing && !comparedSection) return 'notRunThere';
    return null;
};

// Split rows of one hunk, aligned per field: [{ field, left, right }] with
// the compared side on the left; a side without the line is null.
export const splitRows = (hunk) => {
    const rows = [];
    const byField = new Map();
    for (const line of hunk.lines) {
        let row = byField.get(line.field);
        if (!row) {
            row = { field: line.field, left: null, right: null };
            byField.set(line.field, row);
            rows.push(row);
        }
        if (hunk.status === 'onlyCompared') row.left = line;
        else if (hunk.status !== 'both') row.right = line;
        else if (line.mark === '-') row.left = line;
        else if (line.mark === '+') row.right = line;
        else {
            row.left = { ...line, value: line.otherValue, otherValue: line.value };
            row.right = line;
        }
    }
    return rows;
};

// Word runs (Unicode letters / digits) and runs of everything else.
const TOKEN_RE = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_]+/gu;
const WORD_RE = /^[\p{L}\p{N}_]/u;
const tokenize = (text) => text.match(TOKEN_RE) ?? [];

// Inline segments of `text` against `otherText`: [{ text, changed }] over
// the tokens outside their LCS, a separator between two changed tokens
// joining them (`480.2`), adjacent equals merged. No word shared → one
// unchanged segment (the line tint already marks the change).
export const inlineDiffSegments = (text, otherText) => {
    const a = tokenize(String(text ?? ''));
    if (!a.length) return [];
    const b = tokenize(String(otherText ?? ''));
    const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    // Walk the LCS table: which tokens of `a` are outside the common run.
    const changed = new Array(a.length).fill(true);
    for (let i = 0, j = 0; i < a.length && j < b.length;) {
        if (a[i] === b[j]) {
            changed[i++] = false;
            j++;
        } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
        else j++;
    }
    if (!a.some((token, i) => !changed[i] && WORD_RE.test(token))) return [{ text: a.join(''), changed: false }];
    for (let i = 1; i < a.length - 1; i++) {
        if (!changed[i] && !WORD_RE.test(a[i]) && changed[i - 1] && changed[i + 1]) changed[i] = true;
    }

    const segments = [];
    a.forEach((token, i) => {
        const last = segments[segments.length - 1];
        if (last && last.changed === changed[i]) last.text += token;
        else segments.push({ text: token, changed: changed[i] });
    });
    return segments;
};
