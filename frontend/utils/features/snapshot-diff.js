// Snapshot diff: compares two snapshots' homepage sections item by item,
// aligned by stable keys (cards by their fixed id, connectivity targets / STUN
// servers / DNS providers by id), never by position. Items present on one
// side only are listed apart and are not changes. Produces per-field rows,
// no verdicts: the visitor reads what changed. Numbers compare at display
// precision: values that read the same are not a change.
// `left` is the baseline ("from"), `right` the snapshot being viewed ("to").

import { HOME_SECTION_IDS } from './snapshots.js';
import { SCENARIO_FRICTION_IDS } from '../codes/ip.js';

// An ipinfo card's scenario friction, one dotted field per scenario.
const SCENARIO_FIELDS = SCENARIO_FRICTION_IDS.map((id) => `scenarios.${id}`);

// --- field classes ----------------------------------------------------------

// Highlighted when changed.
const SEMANTIC_FIELDS = new Set([
    'ip', 'countryCode', 'region', 'city', 'asn', 'isp', 'anonymity', 'ipType', 'nativeIP',
    'abuseLevel', ...SCENARIO_FIELDS,
    'natType', 'org', 'status', 'tier', 'connection.ip',
    'qualities.streaming', 'qualities.gaming', 'qualities.rtc',
]);

// Measurements that move on every run: shown, never highlighted.
const DRIFT_FIELDS = new Set([
    'timeMs', 'minTimeMs', 'latencyMs', 'jitterMs', 'downloadMbps', 'uploadMbps',
    'loadedLatencyDownMs', 'loadedLatencyUpMs', 'qualityScore',
    'scores.streaming', 'scores.gaming', 'scores.rtc',
]);

// 'semantic' | 'drift' | 'info' (anything else: names, urls, colo, …).
export const fieldKind = (field) => {
    if (SEMANTIC_FIELDS.has(field)) return 'semantic';
    if (DRIFT_FIELDS.has(field)) return 'drift';
    return 'info';
};

// --- display precision ------------------------------------------------------

// Fraction digits a recorded number is shown with (snapshot-diff-format.js).
export const DISPLAY_FRACTION_DIGITS = 1;

// A number as it reads once shown (toFixed rounds like Intl's default);
// anything else as is.
export const atDisplayPrecision = (value) =>
    (typeof value === 'number' && Number.isFinite(value)
        ? Number(value.toFixed(DISPLAY_FRACTION_DIGITS)) : value);

// Equal as displayed: 95.03 and 95.04 both read 95.
export const sameValue = (a, b) => atDisplayPrecision(a) === atDisplayPrecision(b);

// --- speed tier -------------------------------------------------------------

// Download Mbps bounds of the coarse speed tiers: tier 0 is < 10, 1 is
// < 50, 2 is < 200, 3 is ≥ 200. A noise gate: run-to-run jitter rarely
// crosses one, so only a crossing highlights the row. Read at display
// precision, so the tier follows the shown value (9.96 reads 10: tier 1).
export const SPEED_TIER_THRESHOLDS_MBPS = Object.freeze([10, 50, 200]);

export const speedTier = (mbps) => {
    if (typeof mbps !== 'number' || !Number.isFinite(mbps)) return null;
    const shown = atDisplayPrecision(mbps);
    const index = SPEED_TIER_THRESHOLDS_MBPS.findIndex((bound) => shown < bound);
    return index === -1 ? SPEED_TIER_THRESHOLDS_MBPS.length : index;
};

// --- section layout ---------------------------------------------------------

// Keyed sections: the array, its key, and its compared fields in display order.
const KEYED_SECTIONS = {
    ipinfo: {
        list: 'cards',
        key: 'id',
        fields: ['ip', 'countryCode', 'region', 'city', 'timezone', 'asn', 'isp', 'anonymity',
            'ipType', 'nativeIP', 'qualityScore', 'abuseLevel', 'anonymityProtocol', 'anonymityProvider',
            ...SCENARIO_FIELDS],
    },
    connectivity: { list: 'targets', key: 'id', fields: ['name', 'status', 'timeMs', 'minTimeMs', 'custom'] },
    webrtc: { list: 'servers', key: 'id', fields: ['url', 'ip', 'natType', 'countryCode', 'org'] },
    dnsleak: { list: 'providers', key: 'id', fields: ['name', 'ip', 'countryCode', 'org'] },
};

const SPEEDTEST_FIELDS = [
    'tier', 'downloadMbps', 'uploadMbps', 'latencyMs', 'jitterMs', 'loadedLatencyDownMs',
    'loadedLatencyUpMs', 'qualities.streaming', 'qualities.gaming', 'qualities.rtc',
    'scores.streaming', 'scores.gaming', 'scores.rtc',
    'connection.ip', 'connection.colo', 'connection.coloCountryCode', 'connection.coloCity',
];

// A section's compared fields in display order (dotted ones read one level
// down; speedtest's derived `tier` included); [] for an unknown id.
export const sectionFields = (id) => {
    if (id === 'speedtest') return [...SPEEDTEST_FIELDS];
    return KEYED_SECTIONS[id] ? [...KEYED_SECTIONS[id].fields] : [];
};

// Items by key, in their own order; a repeated key gets a `#n` suffix so
// nothing is silently merged.
const indexByKey = (items, key) => {
    const map = new Map();
    for (const item of Array.isArray(items) ? items : []) {
        const base = String(item?.[key] ?? '');
        let id = base;
        for (let n = 2; map.has(id); n += 1) id = `${base}#${n}`;
        map.set(id, item);
    }
    return map;
};

// A section's items by the keys the diff aligns them on (same `#n`
// suffixes), in their own order; an empty map for speedtest.
export const keyedItems = (id, section) => {
    const spec = KEYED_SECTIONS[id];
    return spec ? indexByKey(section?.[spec.list], spec.key) : new Map();
};

const makeRow = (key, field, from, to) => {
    const kind = fieldKind(field);
    const changed = !sameValue(from, to);
    return { key, field, from, to, kind, changed, highlight: changed && kind === 'semantic' };
};

// One field of an item; dotted fields read one level down, null reads as absent.
const readDotted = (item, field) => {
    const [head, tail] = field.split('.');
    const value = tail ? item?.[head]?.[tail] : item?.[head];
    return value ?? undefined;
};

// Rows for every compared field either side holds.
const fieldRows = (key, fields, left, right, read = readDotted) => fields
    .map((field) => [field, read(left, field), read(right, field)])
    .filter(([, from, to]) => from !== undefined || to !== undefined)
    .map(([field, from, to]) => makeRow(key, field, from, to));

const readSpeed = (section, field) => (field === 'tier'
    ? speedTier(section?.downloadMbps) ?? undefined : readDotted(section, field));

const emptySection = (status) => ({ status, rows: [], onlyLeft: [], onlyRight: [], listChanged: false });

const diffKeyed = (id, left, right) => {
    const { list, key, fields } = KEYED_SECTIONS[id];
    const a = indexByKey(left[list], key);
    const b = indexByKey(right[list], key);
    const onlyLeft = [...a.keys()].filter((k) => !b.has(k));
    const onlyRight = [...b.keys()].filter((k) => !a.has(k));
    const common = [...b.keys()].filter((k) => a.has(k));
    return {
        status: 'both',
        rows: common.flatMap((k) => fieldRows(k, fields, a.get(k), b.get(k))),
        onlyLeft,
        onlyRight,
        listChanged: onlyLeft.length > 0 || onlyRight.length > 0,
    };
};

const diffSection = (id, left, right) => {
    if (!left && !right) return emptySection('none');
    if (!right) return emptySection('leftOnly');
    if (!left) return emptySection('rightOnly');
    if (id === 'speedtest') {
        return { ...emptySection('both'), rows: fieldRows(null, SPEEDTEST_FIELDS, left, right, readSpeed) };
    }
    return diffKeyed(id, left, right);
};

// --- entry point ------------------------------------------------------------

// → { sections: { [id]: { status, rows, onlyLeft, onlyRight, listChanged } } }
// Row: { key, field, from, to, kind, changed, highlight }.
export const diffSnapshots = (left, right) => {
    const sections = {};
    for (const id of HOME_SECTION_IDS) {
        sections[id] = diffSection(id, left?.sections?.[id], right?.sections?.[id]);
    }
    return { sections };
};
