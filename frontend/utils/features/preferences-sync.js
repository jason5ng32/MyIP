// The three store-backed collections of account sync: `preferences` (the synced keys, normalised as the server checks
// them), `connectivity` (one item per list, the lists' order and the default list id) and `speedtest` (the two
// sizes) — their items from
// userPreferences, the userPreferences values a pull's changes become, a fresh visitor's values, and the hash refresh
// for writes that are not user edits.
import { SYNCED_PREFERENCE_KEYS, isValidSpeedtestSize } from '../preferences-schema.js';
import { SYNC_COLLECTIONS, connectivityListItemId, connectivityListIdOf } from '../sync-collections.js';
import { DEFAULT_PREFERENCES } from '../../data/default-preferences.js';
import { MINE_LIST_ID } from '../../data/connectivity-defaults.js';
import { snapshotsAutoMode } from './snapshots.js';
import { sanitizeLists, CONNECTIVITY_LISTS_SCHEMA_VERSION } from './connectivity-lists.js';
import { readSyncRecord, writeSyncRecord, refreshSyncHashes } from './account-sync.js';

// Stored forms the server would refuse in their legacy shape.
const NORMALIZERS = { snapshotsAuto: snapshotsAutoMode };

// The speedtest collection's item ids → userPreferences keys.
export const SPEEDTEST_ITEM_KEYS = Object.freeze({
    downloadBytes: 'speedtestDownloadBytes',
    uploadBytes: 'speedtestUploadBytes',
});

const freshVisitor = () => ({ ...DEFAULT_PREFERENCES, connectivityLists: sanitizeLists(null, null, []) });

// Per collection: userPreferences → `{ <item id>: value }`.
export const SYNC_ITEM_READERS = Object.freeze({
    preferences: (prefs) => Object.fromEntries(SYNCED_PREFERENCE_KEYS
        .filter((key) => prefs?.[key] !== undefined)
        .map((key) => [key, NORMALIZERS[key] ? NORMALIZERS[key](prefs[key]) : prefs[key]])),
    // The order and the default list id come first, so an upload sends them before the lists.
    connectivity: (prefs) => {
        const { lists } = sanitizeLists(prefs?.connectivityLists, null, []);
        return {
            order: lists.map((list) => list.id),
            ...(typeof prefs?.connectivityDefaultListId === 'string' ? { defaultListId: prefs.connectivityDefaultListId } : {}),
            ...Object.fromEntries(lists.map(({ id, name, members }) => [connectivityListItemId(id), { name, members }])),
        };
    },
    // A stored size outside the options reads as its default.
    speedtest: (prefs) => Object.fromEntries(Object.entries(SPEEDTEST_ITEM_KEYS)
        .map(([id, key]) => [id, isValidSpeedtestSize(prefs?.[key]) ? prefs[key] : DEFAULT_PREFERENCES[key]])),
});

// Lists in `order` (ids without a list skipped), then the lists it lacks by id: the same on every device.
export const orderConnectivityLists = (order, listsById) => {
    const placed = [...new Set(order)].filter((id) => listsById.has(id));
    const rest = [...listsById.keys()].filter((id) => !placed.includes(id)).sort();
    return [...placed, ...rest].map((id) => listsById.get(id));
};

/**
 * Per collection: the current userPreferences and a pull's `{ upserts, deletes }` (item ids → values; ids) → the
 * userPreferences values to write. A deleted preference goes back to its default; a deleted list leaves the model,
 * except Mine, which stays; a list's order is the `order` item's, else the current one.
 */
export const SYNC_ITEM_WRITERS = Object.freeze({
    preferences: (prefs, { upserts = {}, deletes = [] }) => {
        const defaults = SYNC_ITEM_READERS.preferences(DEFAULT_PREFERENCES);
        const reset = Object.fromEntries(deletes.filter((id) => Object.hasOwn(defaults, id)).map((id) => [id, defaults[id]]));
        return { ...reset, ...upserts };
    },
    connectivity: (prefs, { upserts = {}, deletes = [] }) => {
        const current = sanitizeLists(prefs?.connectivityLists, null, []).lists;
        const byId = new Map(current.map((list) => [list.id, list]));
        for (const itemId of deletes) {
            const listId = connectivityListIdOf(itemId);
            if (listId !== null && listId !== MINE_LIST_ID) byId.delete(listId);
        }
        for (const [itemId, value] of Object.entries(upserts)) {
            const listId = connectivityListIdOf(itemId);
            if (listId !== null) byId.set(listId, { id: listId, name: listId === MINE_LIST_ID ? null : value.name, members: value.members });
        }
        const order = Array.isArray(upserts.order) ? upserts.order : current.map((list) => list.id);
        const values = {
            connectivityLists: { schemaVersion: CONNECTIVITY_LISTS_SCHEMA_VERSION, lists: orderConnectivityLists(order, byId) },
        };
        if (typeof upserts.defaultListId === 'string') values.connectivityDefaultListId = upserts.defaultListId;
        else if (deletes.includes('defaultListId')) values.connectivityDefaultListId = DEFAULT_PREFERENCES.connectivityDefaultListId;
        return values;
    },
    speedtest: (prefs, { upserts = {}, deletes = [] }) => Object.fromEntries(Object.entries(SPEEDTEST_ITEM_KEYS)
        .filter(([id]) => Object.hasOwn(upserts, id) || deletes.includes(id))
        .map(([id, key]) => [key, Object.hasOwn(upserts, id) ? upserts[id] : DEFAULT_PREFERENCES[key]])),
});

// A collection's userPreferences values for a pull's changes.
export const applySyncItems = (collectionId, prefs, changes) => SYNC_ITEM_WRITERS[collectionId](prefs, changes);

// A fresh visitor's userPreferences values for a collection.
export const syncDefaultPreferences = (collectionId) => {
    const fresh = freshVisitor();
    return applySyncItems(collectionId, fresh, { upserts: SYNC_ITEM_READERS[collectionId](fresh), deletes: [] });
};

// Item ids whose normalised value differs between two preference objects.
export const changedSyncItems = (collectionId, before, after) => {
    const a = SYNC_ITEM_READERS[collectionId](before);
    const b = SYNC_ITEM_READERS[collectionId](after);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]));
};

// A write that is not a user edit (boot defaults, sanitising, a config fallback) between `before` and `prefs`: each
// existing record takes its changed items' new values unstamped.
export const refreshSyncRecords = (storage, before, prefs) => {
    for (const id of Object.keys(SYNC_ITEM_READERS)) {
        const collection = SYNC_COLLECTIONS[id];
        const record = readSyncRecord(storage, collection);
        if (!record) continue;
        const ids = changedSyncItems(id, before, prefs);
        if (ids.length) writeSyncRecord(storage, collection, refreshSyncHashes(record, SYNC_ITEM_READERS[id](prefs), ids));
    }
};
