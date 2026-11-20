// Pure layer of account sync: per collection, the local sync record, change detection by hash, adoption and the
// merge of pulled and saved items, and upload batches. Signed out, the device's data is its own and has no record;
// signed in, the record names the user and the device holds the account's data plus edits not yet sent.
import {
    SYNC_MAX_ITEMS_PER_REQUEST, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_BODY_BYTES, syncValueBytes,
} from '../sync-collections.js';

// Items' JSON per PUT, leaving room under the server's body limit for the envelope.
export const SYNC_BATCH_MAX_BYTES = SYNC_MAX_BODY_BYTES - 16 * 1024;

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStamp = (value) => Number.isSafeInteger(value) && value > 0;
const isCursor = (value) => Number.isSafeInteger(value) && value >= 0;

// FNV-1a over the value's JSON, base 36: enough to notice an edit.
export const hashSyncValue = (value) => {
    const text = JSON.stringify(value) ?? '';
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};

// --- the record -------------------------------------------------------------

// One record per collection and schema version: a version bump starts afresh with an adoption.
export const syncRecordKey = (collection) => `accountSync_${collection.id}_v${collection.version}`;

export const createSyncRecord = () => ({ user: null, cursor: 0, lastSyncAt: 0, items: {} });

// An item entry: `hash` (value as last seen; absent on a tombstone), `at` (edit stamp; absent = never edited here),
// `ack` (newest stamp the server holds), `refused` (a stamp the server refused), `deleted`.
const cleanEntry = (entry) => {
    if (!isPlainObject(entry)) return null;
    const out = {};
    if (entry.deleted === true) out.deleted = true;
    else if (typeof entry.hash === 'string' && entry.hash) out.hash = entry.hash;
    else return null;
    for (const field of ['at', 'ack', 'refused']) if (isStamp(entry[field])) out[field] = entry[field];
    if (out.deleted && !out.at) return null;
    return out;
};

// Null when absent or unreadable: the next pull adopts.
export const readSyncRecord = (storage, collection) => {
    let stored;
    try {
        stored = JSON.parse(storage.getItem(syncRecordKey(collection)) ?? 'null');
    } catch {
        return null;
    }
    if (!isPlainObject(stored) || !isPlainObject(stored.items)) return null;
    const items = {};
    for (const [id, entry] of Object.entries(stored.items)) {
        const clean = cleanEntry(entry);
        if (clean) items[id] = clean;
    }
    return {
        user: typeof stored.user === 'string' && stored.user ? stored.user : null,
        cursor: isCursor(stored.cursor) ? stored.cursor : 0,
        lastSyncAt: isCursor(stored.lastSyncAt) ? stored.lastSyncAt : 0,
        items,
    };
};

export const writeSyncRecord = (storage, collection, record) => {
    try {
        storage.setItem(syncRecordKey(collection), JSON.stringify(record));
    } catch { /* storage full or blocked: the next detection retries */ }
};

export const removeSyncRecord = (storage, collection) => {
    try {
        storage.removeItem(syncRecordKey(collection));
    } catch { /* blocked: nothing to remove */ }
};

// The record is the signed-in user's own: only then are edits stamped.
export const isOwnRecord = (record, userId) => Boolean(userId) && record?.user === userId;

// A stamped edit the server does not hold yet (and has not refused).
export const isPending = (entry) => Boolean(entry?.at) && !(entry.ack >= entry.at) && entry.refused !== entry.at;

// The server held this item at its current stamp.
const isSynced = (entry) => Boolean(entry?.ack) && !isPending(entry);

// --- change detection -------------------------------------------------------

/**
 * Current local items (`{ <id>: value }`) against the signed-in user's record → `{ record, changed }`: a new or
 * edited value is stamped `now`, an id gone locally becomes a tombstone stamped `now`, and synced tombstones past
 * the server's TTL are forgotten. The caller checks the record is the user's own (isOwnRecord).
 */
export const detectLocalChanges = (record, local, now) => {
    const items = {};
    let changed = false;
    for (const [id, value] of Object.entries(local)) {
        const hash = hashSyncValue(value);
        const entry = record.items[id];
        if (entry && !entry.deleted && entry.hash === hash) {
            items[id] = entry;
            continue;
        }
        const { deleted, ...rest } = entry ?? {};
        items[id] = { ...rest, hash, at: now };
        changed = true;
    }
    for (const [id, entry] of Object.entries(record.items)) {
        if (Object.hasOwn(local, id)) continue;
        if (entry.deleted) {
            if (!(isSynced(entry) && entry.at < now - SYNC_TOMBSTONE_TTL_MS)) items[id] = entry;
            continue;
        }
        items[id] = { deleted: true, at: now, ...(entry.ack ? { ack: entry.ack } : {}) };
        changed = true;
    }
    return { record: { ...record, items }, changed };
};

// A write that is not a user edit (boot defaults, a config fallback): `ids` take their current hash, stamps untouched.
export const refreshSyncHashes = (record, local, ids) => {
    if (!record) return record;
    const items = { ...record.items };
    for (const id of ids) {
        if (!Object.hasOwn(local, id)) continue;
        const { deleted, ...rest } = items[id] ?? {};
        items[id] = { ...rest, hash: hashSyncValue(local[id]) };
    }
    return { ...record, items };
};

// --- pulling ----------------------------------------------------------------

// A server item → itself when well formed for `collection`, else null.
export const readSyncItem = (item, collection) => {
    if (!isPlainObject(item) || !collection.isValidItemId(item.id) || !isStamp(item.updatedAt)) return null;
    if (item.deleted === true) return { id: item.id, updatedAt: item.updatedAt, deleted: true };
    if (!collection.isValidValue(item.id, item.value)) return null;
    return { id: item.id, updatedAt: item.updatedAt, deleted: false, value: item.value };
};

// A GET answer → `{ cursor, more, items }` with the readable items, or null when its shape is off.
export const readSyncPage = (page, collection) => {
    if (!isPlainObject(page) || !isCursor(page.cursor) || typeof page.more !== 'boolean' || !Array.isArray(page.items)) {
        return null;
    }
    return { cursor: page.cursor, more: page.more, items: page.items.map((item) => readSyncItem(item, collection)).filter(Boolean) };
};

// Where a pull starts: 'own' (this user's record: merge by stamp; `stale` when the cursor may have missed purged
// tombstones, so everything again with the server's set authoritative), 'adopt' (no record or a guest one: this
// device's data meets the account for the first time) or 'foreign' (another user's record).
export const preparePull = (record, userId, now) => {
    if (!record || record.user === null) return { mode: 'adopt', stale: false, since: 0 };
    if (record.user !== userId) return { mode: 'foreign', stale: false, since: 0 };
    const stale = record.lastSyncAt > 0 && now - record.lastSyncAt > SYNC_TOMBSTONE_TTL_MS;
    return { mode: 'own', stale, since: stale ? 0 : record.cursor };
};

// The cloud's item replaces the local one.
const take = (state, item, local) => {
    if (item.deleted) {
        state.items[item.id] = { deleted: true, at: item.updatedAt, ack: item.updatedAt };
        if (Object.hasOwn(local, item.id)) state.deletes.push(item.id);
        return;
    }
    const hash = hashSyncValue(item.value);
    state.items[item.id] = { hash, at: item.updatedAt, ack: item.updatedAt };
    if (!Object.hasOwn(local, item.id) || hashSyncValue(local[item.id]) !== hash) state.upserts[item.id] = item.value;
};

// Per item: no local stamp, a stamp the server already held (whatever it sends since is newer there, even when this
// device's clock runs ahead), or a newer cloud stamp, takes the cloud's; else the local edit stays (pending). Its
// own echo (same stamp, same value) marks it held.
const mergeItem = (state, item, local) => {
    const entry = state.items[item.id];
    if (!entry?.at || entry.ack >= entry.at || item.updatedAt > entry.at) {
        take(state, item, local);
        return;
    }
    const echo = item.updatedAt === entry.at && (item.deleted
        ? entry.deleted === true
        : !entry.deleted && entry.hash === hashSyncValue(item.value));
    if (echo) state.items[item.id] = { ...entry, ack: Math.max(entry.ack ?? 0, item.updatedAt) };
};

/**
 * A whole pull (every page) → `{ record, upserts, deletes }` for the caller to apply; `prepared` comes from
 * preparePull. 'own': per item, the newer stamp wins against pending local edits. 'adopt' / 'foreign': an account
 * holding any item replaces the device wholesale (its live items taken, local items it lacks deleted, nothing
 * uploaded); an empty account takes this device's data ('adopt': every local item stamped `now` and pending) or
 * leaves the device empty ('foreign': every local item deleted). `keep`: ids edited while this user was already
 * signed in, before the pull — edits of this session, so they stay, stamped `now`, whatever the account holds.
 * `dropped`: ids removed in that same span — the account's live item is not taken back; a delete stamped `now` waits.
 */
export const mergePull = ({ prepared, record, local, items, cursor, userId, now, keep = [], dropped = [] }) => {
    const done = (state) => ({
        record: { user: userId, cursor, lastSyncAt: now, items: state.items },
        upserts: state.upserts,
        deletes: state.deletes,
    });
    if (prepared.mode !== 'own') {
        const state = { items: {}, upserts: {}, deletes: [] };
        const kept = new Set(keep.filter((id) => Object.hasOwn(local, id)));
        const stampNow = (id) => { state.items[id] = { hash: hashSyncValue(local[id]), at: now }; };
        if (items.length) {
            const gone = new Set(dropped.filter((id) => !Object.hasOwn(local, id)));
            for (const item of items) {
                if (kept.has(item.id)) continue;
                if (gone.has(item.id) && !item.deleted) state.items[item.id] = { deleted: true, at: now };
                else take(state, item, local);
            }
            for (const id of Object.keys(local)) {
                if (kept.has(id)) stampNow(id);
                else if (!state.items[id]?.hash && !state.deletes.includes(id)) state.deletes.push(id);
            }
        } else if (prepared.mode === 'adopt') {
            Object.keys(local).forEach(stampNow);
        } else {
            for (const id of Object.keys(local)) {
                if (kept.has(id)) stampNow(id);
                else state.deletes.push(id);
            }
        }
        return done(state);
    }
    const state = { items: { ...record.items }, upserts: {}, deletes: [] };
    for (const item of items) mergeItem(state, item, local);
    if (prepared.stale) {
        // Synced items the server no longer lists are gone there; pending ones stay to be uploaded.
        const cloudIds = new Set(items.map((item) => item.id));
        for (const [id, entry] of Object.entries(state.items)) {
            if (cloudIds.has(id) || !isSynced(entry)) continue;
            delete state.items[id];
            if (!entry.deleted && Object.hasOwn(local, id)) state.deletes.push(id);
        }
    }
    return done(state);
};

// Ids whose value differs from (or is missing in) a `{ id: hash }` baseline; no baseline, none.
export const changedSince = (baseline, local) => (baseline
    ? Object.entries(local).filter(([id, value]) => baseline[id] !== hashSyncValue(value)).map(([id]) => id)
    : []);

// Ids of a `{ id: hash }` baseline that are gone locally; no baseline, none.
export const droppedSince = (baseline, local) => (baseline
    ? Object.keys(baseline).filter((id) => !Object.hasOwn(local, id))
    : []);

// `{ id: hash }` of local items, the baseline changedSince and droppedSince compare with.
export const hashItems = (local) => (local
    ? Object.fromEntries(Object.entries(local).map(([id, value]) => [id, hashSyncValue(value)]))
    : null);

// After applying: applied ids take the hash of what the owner actually stored (it may sanitise, or reset a deleted
// preference to its default), keeping the cloud's stamp; local items without an entry get an unstamped one. So an
// applied or reset value never counts as a local edit.
export const settleApplied = (record, local, ids) => {
    const items = { ...record.items };
    for (const id of ids) {
        const entry = items[id];
        if (!entry || entry.deleted || !Object.hasOwn(local, id)) continue;
        items[id] = { ...entry, hash: hashSyncValue(local[id]) };
    }
    for (const [id, value] of Object.entries(local)) {
        if (!items[id] || items[id].deleted) items[id] = { hash: hashSyncValue(value) };
    }
    return { ...record, items };
};
// The record holds an item the server will not take as it is: it waits for its next edit.
export const hasHeldBack = (record) => Object.values(record?.items ?? {})
    .some((entry) => Boolean(entry.at) && entry.refused === entry.at);

// --- pushing ----------------------------------------------------------------

/**
 * Pending entries → PUT items (`{ id, updatedAt, deleted? , value? }`) in batches of at most
 * SYNC_MAX_ITEMS_PER_REQUEST items and about `maxBytes` of JSON each. Ids or values the collection would refuse come
 * back in `invalid` instead.
 */
export const buildUploadBatches = (record, local, collection, {
    maxItems = SYNC_MAX_ITEMS_PER_REQUEST, maxBytes = SYNC_BATCH_MAX_BYTES,
} = {}) => {
    const batches = [];
    const invalid = [];
    let batch = [];
    let bytes = 0;
    for (const [id, entry] of Object.entries(record.items)) {
        if (!isPending(entry)) continue;
        const deleted = entry.deleted === true;
        if (!collection.isValidItemId(id) || (deleted && !collection.allowDelete)
            || (!deleted && (!Object.hasOwn(local, id) || !collection.isValidValue(id, local[id])))) {
            invalid.push(id);
            continue;
        }
        const item = deleted ? { id, updatedAt: entry.at, deleted: true } : { id, updatedAt: entry.at, value: local[id] };
        const size = syncValueBytes(item) + 1;
        if (batch.length && (batch.length >= maxItems || bytes + size > maxBytes)) {
            batches.push(batch);
            batch = [];
            bytes = 0;
        }
        batch.push(item);
        bytes += size;
    }
    if (batch.length) batches.push(batch);
    return { batches, invalid };
};

// Ids the device will not resend until they change again.
export const markRefused = (record, ids) => {
    const items = { ...record.items };
    for (const id of ids) if (items[id]?.at) items[id] = { ...items[id], refused: items[id].at };
    return { ...record, items };
};

// A PUT answer → `{ base, cursor, conflicts, refused }` with readable conflicts, or null when its shape is off.
export const readSyncSave = (answer, collection) => {
    if (!isPlainObject(answer) || !isCursor(answer.base) || !isCursor(answer.cursor)
        || !Array.isArray(answer.conflicts) || !Array.isArray(answer.refused)) return null;
    return {
        base: answer.base,
        cursor: answer.cursor,
        conflicts: answer.conflicts.map((item) => readSyncItem(item, collection)).filter(Boolean),
        refused: answer.refused.filter((entry) => isPlainObject(entry) && typeof entry.id === 'string').map(({ id }) => id),
    };
};

/**
 * A PUT answer for the `sent` items → `{ record, upserts, deletes, pullNeeded }`. Accepted items are held at the
 * stamp sent; refused ones wait for the next edit; conflicts (kept by the server, as new or newer) are taken, unless
 * the item was edited again after it was sent and that edit is newer: it stays pending. The cursor jumps to the
 * answer's when it was the answer's `base`; otherwise a pull catches up.
 */
export const mergeSave = ({ record, sent, answer, local, now }) => {
    const state = { items: { ...record.items }, upserts: {}, deletes: [] };
    const refused = new Set(answer.refused);
    const kept = new Set(answer.conflicts.map((item) => item.id));
    for (const item of sent) {
        const entry = state.items[item.id];
        if (!entry || kept.has(item.id)) continue;
        if (refused.has(item.id)) {
            if (entry.at === item.updatedAt) state.items[item.id] = { ...entry, refused: item.updatedAt };
            continue;
        }
        state.items[item.id] = { ...entry, ack: Math.max(entry.ack ?? 0, item.updatedAt) };
    }
    const sentAt = new Map(sent.map((item) => [item.id, item.updatedAt]));
    for (const item of answer.conflicts) {
        const at = state.items[item.id]?.at;
        if (at > sentAt.get(item.id) && at > item.updatedAt) continue;
        take(state, item, local);
    }
    const jumps = record.cursor === answer.base;
    return {
        record: {
            ...record,
            items: state.items,
            ...(jumps ? { cursor: answer.cursor, lastSyncAt: now } : {}),
        },
        upserts: state.upserts,
        deletes: state.deletes,
        pullNeeded: !jumps,
    };
};

// --- the Preferences panel --------------------------------------------------

// The Sync section's status: 'signedOut' | 'saveFailed' | 'failed' | 'paused' | 'partial' | 'synced', or null for
// none. `states` per enabled collection ('idle' | 'synced' | 'partial' | 'failed' | 'reload' | 'stopped'); a failed
// settings save comes first, then a failed sync, a pause (a version mismatch or a refused sign-in), then items held back.
export const syncStatusOf = ({ available, signedIn, states, saveFailed = false }) => {
    if (!available) return null;
    if (!signedIn) return 'signedOut';
    if (saveFailed) return 'saveFailed';
    if (states.includes('failed')) return 'failed';
    if (states.includes('reload') || states.includes('stopped')) return 'paused';
    if (states.includes('partial')) return 'partial';
    return states.includes('synced') ? 'synced' : null;
};

// A status → the title row's badge: a status tone (composables/use-status-tone.js), a short label key and the
// full sentence's key for the hover text; null for none (signed out says so in the section body instead).
export const SYNC_STATUS_BADGES = Object.freeze({
    synced: Object.freeze({ tone: 'ok-fast', label: 'nav.preferences.syncStatusSynced', title: 'nav.preferences.syncSynced' }),
    partial: Object.freeze({ tone: 'ok-mild', label: 'nav.preferences.syncStatusPartial', title: 'nav.preferences.syncPartial' }),
    paused: Object.freeze({ tone: 'ok-slow', label: 'nav.preferences.syncStatusPaused', title: 'nav.preferences.syncReload' }),
    failed: Object.freeze({ tone: 'fail', label: 'nav.preferences.syncStatusFailed', title: 'nav.preferences.syncFailed' }),
    saveFailed: Object.freeze({ tone: 'fail', label: 'nav.preferences.syncStatusFailed', title: 'nav.preferences.syncSaveFailed' }),
});

export const syncStatusBadge = (status) => SYNC_STATUS_BADGES[status] ?? null;
