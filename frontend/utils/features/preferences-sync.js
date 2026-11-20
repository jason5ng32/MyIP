// The two store-backed collections of account sync: `preferences` (the synced keys, normalised as the server checks
// them) and `connectivity` (the lists model and the default list id) — their items from userPreferences, the
// userPreferences keys an item maps to, the defaults a cleared or replaced item goes back to, and the hash refresh for
// writes that are not user edits.
import { SYNCED_PREFERENCE_KEYS } from '../preferences-schema.js';
import { SYNC_COLLECTIONS } from '../sync-collections.js';
import { DEFAULT_PREFERENCES } from '../../data/default-preferences.js';
import { snapshotsAutoMode } from './snapshots.js';
import { sanitizeLists } from './connectivity-lists.js';
import { readSyncRecord, writeSyncRecord, refreshSyncHashes } from './account-sync.js';

// Stored forms the server would refuse in their legacy shape.
const NORMALIZERS = { snapshotsAuto: snapshotsAutoMode };

// The connectivity collection's item ids → userPreferences keys.
export const CONNECTIVITY_ITEM_KEYS = Object.freeze({
    lists: 'connectivityLists',
    defaultListId: 'connectivityDefaultListId',
});

// Per collection: userPreferences → `{ <item id>: value }`.
export const SYNC_ITEM_READERS = Object.freeze({
    preferences: (prefs) => Object.fromEntries(SYNCED_PREFERENCE_KEYS
        .filter((key) => prefs?.[key] !== undefined)
        .map((key) => [key, NORMALIZERS[key] ? NORMALIZERS[key](prefs[key]) : prefs[key]])),
    connectivity: (prefs) => ({
        lists: sanitizeLists(prefs?.connectivityLists, null, []),
        ...(typeof prefs?.connectivityDefaultListId === 'string' ? { defaultListId: prefs.connectivityDefaultListId } : {}),
    }),
});

// Per collection: item id → the userPreferences key it is stored under.
export const syncItemKey = (collectionId, itemId) => (collectionId === 'connectivity' ? CONNECTIVITY_ITEM_KEYS[itemId] : itemId);

// `{ <item id>: value }` → `{ <userPreferences key>: value }`.
export const toPreferenceValues = (collectionId, items) => Object.fromEntries(Object.entries(items)
    .map(([id, value]) => [syncItemKey(collectionId, id), value])
    .filter(([key]) => key));

// A fresh visitor's items for a collection.
export const syncItemDefaults = (collectionId) => SYNC_ITEM_READERS[collectionId]({
    ...DEFAULT_PREFERENCES, connectivityLists: sanitizeLists(null, null, []),
});

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
