// Snapshots: the pure store model behind the records of the homepage tests.
// A snapshot holds the latest schema-shaped section of each homepage test:
// at most one per page load, recorded automatically per the `snapshotsAuto`
// mode (updated in place while that load runs tests), or one saved by hand
// (never updated). Everything here is pure: storage, events and Intl stay
// with the caller (composables/use-snapshot-recorder.js and the UI).

import { isValidIP } from '../ip/valid-ip.js';
import { REPORT_VERSION, validateReport } from '../report/report-schema.js';

// --- constants --------------------------------------------------------------

export const SNAPSHOTS_STORAGE_KEY = 'snapshots';

// Envelope version of the stored `{ v, snapshots }` object. Each snapshot
// also carries the report schema version its sections were built with.
export const SNAPSHOTS_STORE_VERSION = 1;

// The homepage tests a snapshot records, in homepage order.
export const HOME_SECTION_IDS = Object.freeze(['ipinfo', 'connectivity', 'webrtc', 'dnsleak', 'speedtest']);

// The longest `labelCardId` (an ipinfo card's fixed `id`) kept; the schema's cap.
export const SNAPSHOT_LABEL_CARD_ID_MAX = 32;

// Retention of unkept snapshots: the newest `snapshotsKeepLast` survive.
export const SNAPSHOTS_KEEP_LAST_OPTIONS = Object.freeze([10, 50, 100]);
export const SNAPSHOTS_KEEP_LAST_DEFAULT = 50;

// Automatic recording (`snapshotsAuto`): 'smart' records a load that differs
// notably from the newest snapshot (utils/features/snapshot-trigger.js),
// 'every' records every load, 'off' none.
export const SNAPSHOTS_AUTO_MODES = Object.freeze(['smart', 'every', 'off']);
export const SNAPSHOTS_AUTO_DEFAULT = 'smart';

// Kept snapshots are never pruned, so their number is capped instead.
export const MAX_KEPT_SNAPSHOTS = 20;

export const SNAPSHOT_NAME_MAX = 64;

// A full snapshot (its sections) is ~16 KB in practice (72 connectivity
// targets, IPv6 on every card) and ~28 KB with every field at its schema
// cap; 120 of them (100 unkept + 20 kept, the worst case) come to
// ~1.9 MB / ~3.2 MB.
export const SNAPSHOTS_MAX_BYTES = 4 * 1024 * 1024;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

// --- helpers ----------------------------------------------------------------

const isPlainObject = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isIsoDate = (value) =>
    typeof value === 'string' && value.length <= 32 && !Number.isNaN(Date.parse(value));

export const createEmptyStore = () => ({ v: SNAPSHOTS_STORE_VERSION, snapshots: [] });

export const clampKeepLast = (value) =>
    (SNAPSHOTS_KEEP_LAST_OPTIONS.includes(value) ? value : SNAPSHOTS_KEEP_LAST_DEFAULT);

// A stored `snapshotsAuto` → its mode; the boolean of older versions maps
// false → 'off', true → the default.
export const snapshotsAutoMode = (value) => {
    if (value === false) return 'off';
    return SNAPSHOTS_AUTO_MODES.includes(value) ? value : SNAPSHOTS_AUTO_DEFAULT;
};

// The change notice (`snapshotsNotify`, on unless false) needs automatic
// recording: with 'off' it is off whatever is stored.
export const snapshotsNotifyOn = (prefs) =>
    snapshotsAutoMode(prefs?.snapshotsAuto) !== 'off' && prefs?.snapshotsNotify !== false;

// --- reading untrusted storage ----------------------------------------------

// One stored snapshot → a clean copy, or null when anything is off: wrong
// schema version, a missing or mistyped field, a section outside the
// homepage five, or sections the report schema rejects.
// `labelCardId` is optional. Unknown fields (`seq`, `ips`, `visits`,
// `sealed` included) are dropped.
export const sanitizeSnapshot = (value) => {
    if (!isPlainObject(value) || value.v !== REPORT_VERSION) return null;
    const { id, firstSeenAt, lastSeenAt, name, kept, sections, labelCardId } = value;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
    if (!isIsoDate(firstSeenAt) || !isIsoDate(lastSeenAt)) return null;
    if (typeof name !== 'string' || name.length > SNAPSHOT_NAME_MAX) return null;
    if (typeof kept !== 'boolean') return null;
    if (labelCardId !== undefined
        && (typeof labelCardId !== 'string' || labelCardId.length > SNAPSHOT_LABEL_CARD_ID_MAX)) return null;
    if (!isPlainObject(sections) || !sections.ipinfo) return null;
    if (Object.keys(sections).some((key) => !HOME_SECTION_IDS.includes(key))) return null;
    const { ok } = validateReport({
        v: REPORT_VERSION, generatedAt: lastSeenAt, origin: 'snapshot', locale: 'en', sections,
    }, { local: true });
    if (!ok) return null;
    const clean = { id, v: REPORT_VERSION, firstSeenAt, lastSeenAt, name, kept, sections };
    return labelCardId === undefined ? clean : { ...clean, labelCardId };
};

// A localStorage string → store, newest first. A broken envelope (bad JSON,
// wrong version, oversized) yields an empty store; a bad snapshot is dropped
// alone. Never throws.
export const restoreStore = (raw) => {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > SNAPSHOTS_MAX_BYTES) {
        return createEmptyStore();
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return createEmptyStore();
    }
    if (!isPlainObject(parsed) || parsed.v !== SNAPSHOTS_STORE_VERSION
        || !Array.isArray(parsed.snapshots)) return createEmptyStore();

    const seen = new Set();
    const snapshots = parsed.snapshots
        .map(sanitizeSnapshot)
        .filter((snapshot) => {
            if (!snapshot || seen.has(snapshot.id)) return false;
            seen.add(snapshot.id);
            return true;
        })
        // Stable: equal timestamps keep their stored order.
        .sort((a, b) => Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt));

    // Kept beyond the cap (a hand-edited store) fall back to unkept, oldest first.
    let keptCount = 0;
    const capped = snapshots.map((snapshot) => {
        if (!snapshot.kept) return snapshot;
        keptCount += 1;
        return keptCount > MAX_KEPT_SNAPSHOTS ? { ...snapshot, kept: false } : snapshot;
    });
    return { v: SNAPSHOTS_STORE_VERSION, snapshots: capped };
};

// --- recording rules --------------------------------------------------------

// The card a new snapshot's auto label names, from an ipinfo event's cards in
// homepage order: the card at 1-based `position` when it holds a valid IP,
// else the first card that does → its `id`; '' when none.
export const labelCardIdOf = (cards, position = 1) => {
    const list = Array.isArray(cards) ? cards : [];
    const at = Number.isInteger(position) ? list[position - 1] : undefined;
    const card = isValidIP(at?.ip) ? at : list.find((item) => isValidIP(item?.ip));
    const cardId = typeof card?.id === 'string' ? card.id : '';
    return cardId.slice(0, SNAPSHOT_LABEL_CARD_ID_MAX);
};

export const createSnapshot = ({ id, now, labelCardId = '' }) => ({
    id, v: REPORT_VERSION, firstSeenAt: now, lastSeenAt: now, name: '', kept: false, sections: {}, labelCardId,
});

// Latest wins; ids outside the homepage five are ignored.
export const applySection = (snapshot, id, section) => {
    if (!HOME_SECTION_IDS.includes(id) || !isPlainObject(section)) return snapshot;
    return { ...snapshot, sections: { ...snapshot.sections, [id]: section } };
};

// Updated in place: lastSeenAt moves.
export const touchSnapshot = (snapshot, now) => ({ ...snapshot, lastSeenAt: now });

export const addSnapshot = (store, snapshot) => ({
    ...store,
    snapshots: [snapshot, ...store.snapshots],
});

export const replaceSnapshot = (store, snapshot) => ({
    ...store,
    snapshots: store.snapshots.map((item) => (item.id === snapshot.id ? snapshot : item)),
});

// Keeps the newest `keepLast` (clamped to the options) unkept snapshots;
// kept ones never go and never count. Returns the new store and the
// removed ids.
export const pruneStore = (store, keepLast) => {
    const limit = clampKeepLast(keepLast);
    const removed = [];
    let unkept = 0;
    const snapshots = store.snapshots.filter((snapshot) => {
        if (snapshot.kept) return true;
        unkept += 1;
        const keep = unkept <= limit;
        if (!keep) removed.push(snapshot.id);
        return keep;
    });
    return { store: removed.length ? { ...store, snapshots } : store, removed };
};

// --- labels -----------------------------------------------------------------

// First card with a valid IP.
export const primaryCardOf = (snapshot) =>
    (snapshot?.sections?.ipinfo?.cards ?? []).find((card) => isValidIP(card?.ip)) ?? null;

// The card the auto label names: the one whose `id` is the snapshot's
// `labelCardId` (set at creation), else the primary card.
export const labelCardOf = (snapshot) => {
    const cardId = snapshot?.labelCardId;
    const match = cardId
        ? (snapshot?.sections?.ipinfo?.cards ?? []).find((card) => card?.id === cardId && isValidIP(card?.ip))
        : null;
    return match ?? primaryCardOf(snapshot);
};

// The auto label's parts: the label card's country code and IP ('' when
// absent); null without a snapshot.
export const autoLabel = (snapshot) => {
    if (!snapshot) return null;
    const card = labelCardOf(snapshot);
    return { countryCode: card?.countryCode ?? '', ip: card?.ip ?? '' };
};

// Parts → "country · IP", empty parts left out. `countryName(code)` comes
// from the caller (Intl lives in the UI layer); the code stands in when the
// name is empty.
export const formatAutoLabel = (parts, { countryName = () => '' } = {}) => {
    if (!parts) return '';
    const code = parts.countryCode || '';
    return [code ? (countryName(code) || code) : '', parts.ip].filter(Boolean).join(' · ');
};

// A given name replaces the whole auto label.
export const snapshotLabel = (snapshot, formatters) =>
    snapshot?.name?.trim() || formatAutoLabel(autoLabel(snapshot), formatters);

// --- user actions -----------------------------------------------------------

export const findSnapshot = (store, id) => store.snapshots.find((snapshot) => snapshot.id === id) ?? null;

// Empty or whitespace restores the auto label.
export const renameSnapshot = (store, id, name) => {
    const snapshot = findSnapshot(store, id);
    if (!snapshot) return store;
    const clean = typeof name === 'string' ? name.trim().slice(0, SNAPSHOT_NAME_MAX) : '';
    return replaceSnapshot(store, { ...snapshot, name: clean });
};

export const keptCountOf = (store) => store.snapshots.filter((snapshot) => snapshot.kept).length;

// `ok` is false (store unchanged) for an unknown id or when keeping one more
// would pass MAX_KEPT_SNAPSHOTS.
export const keepSnapshot = (store, id, kept = true) => {
    const snapshot = findSnapshot(store, id);
    if (!snapshot) return { store, ok: false };
    if (snapshot.kept === kept) return { store, ok: true };
    if (kept && keptCountOf(store) >= MAX_KEPT_SNAPSHOTS) return { store, ok: false };
    return { store: replaceSnapshot(store, { ...snapshot, kept }), ok: true };
};

export const removeSnapshot = (store, id) => ({
    ...store,
    snapshots: store.snapshots.filter((snapshot) => snapshot.id !== id),
});
