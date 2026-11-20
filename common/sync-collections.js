// The synced collections registry both halves read: per collection its schema version, item and value checks, limits and page size.

import {
    PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, isSyncedPreferenceKey, isValidPreferenceValue,
    isValidConnectivityList, isValidConnectivityListOrder, isValidConnectivityListId, CONNECTIVITY_LIST_LIMIT,
    isValidSpeedtestSize,
} from './preferences-schema.js';

export const CONNECTIVITY_SYNC_VERSION = 2;
export const CHECKLIST_SYNC_VERSION = 1;
export const SPEEDTEST_SYNC_VERSION = 1;

// `code` of an item request for a collection the account has not enabled (409).
export const SYNC_OFF_CODE = 'sync_off';

// Items per PUT; a larger upload goes in several requests.
export const SYNC_MAX_ITEMS_PER_REQUEST = 500;

// Tombstones older than this (by `updatedAt`) are removed on the user's next write.
export const SYNC_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const KB = 1024;
const encoder = new TextEncoder();

// UTF-8 size of a value as JSON, the measure `maxItemBytes` caps.
export const syncValueBytes = (value) => encoder.encode(JSON.stringify(value) ?? '').length;

// The Connectivity collection's items: one per list (`list:<list id>`, the list without its id), the lists' `order`
// and the `defaultListId`.
const LIST_ITEM_PREFIX = 'list:';

export const connectivityListItemId = (listId) => `${LIST_ITEM_PREFIX}${listId}`;

// A list item's list id, or null for any other id.
export const connectivityListIdOf = (itemId) => {
    if (typeof itemId !== 'string' || !itemId.startsWith(LIST_ITEM_PREFIX)) return null;
    const listId = itemId.slice(LIST_ITEM_PREFIX.length);
    return isValidConnectivityListId(listId) ? listId : null;
};

const CONNECTIVITY_VALIDATORS = Object.freeze({
    order: isValidConnectivityListOrder,
    defaultListId: isValidConnectivityListId,
});

export const CONNECTIVITY_SYNC_ITEM_IDS = Object.freeze(Object.keys(CONNECTIVITY_VALIDATORS));

const isConnectivityItemId = (id) => connectivityListIdOf(id) !== null
    || (typeof id === 'string' && Object.hasOwn(CONNECTIVITY_VALIDATORS, id));

const isConnectivityValue = (id, value) => {
    const listId = connectivityListIdOf(id);
    if (listId !== null) return isValidConnectivityList(listId, value);
    return isConnectivityItemId(id) && CONNECTIVITY_VALIDATORS[id](value);
};

// Live items at most: every list, its order and the default list id.
const CONNECTIVITY_MAX_ITEMS = CONNECTIVITY_LIST_LIMIT + CONNECTIVITY_SYNC_ITEM_IDS.length;
// Rows at most, deleted lists' tombstones included (each list ever created is one row until its tombstone expires).
const CONNECTIVITY_MAX_ROWS = CONNECTIVITY_MAX_ITEMS + 100;

// Security Checklist progress: item slugs (lowercase words joined by hyphens, up to ~80 chars today) and their two
// marks; an unset item is a delete. The slug list lives in the locale datasets, so ids are checked by shape.
export const CHECKLIST_MARKS = Object.freeze(['checked', 'ignored']);
const CHECKLIST_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/;
export const isChecklistSlug = (id) => typeof id === 'string' && CHECKLIST_SLUG_PATTERN.test(id);
export const isChecklistMark = (value) => CHECKLIST_MARKS.includes(value);
// Well above the checklist's item count (258).
const CHECKLIST_MAX_ITEMS = 1000;

// The speed test's two sizes.
const SPEEDTEST_ITEM_IDS = Object.freeze(['downloadBytes', 'uploadBytes']);
const isSpeedtestItemId = (id) => SPEEDTEST_ITEM_IDS.includes(id);

const row = (fields) => Object.freeze(fields);

export const SYNC_COLLECTIONS = Object.freeze({
    // One item per synced preference key; every value is a short scalar.
    preferences: row({
        id: 'preferences',
        version: PREFERENCES_VERSION,
        isValidItemId: isSyncedPreferenceKey,
        isValidValue: isValidPreferenceValue,
        maxItems: SYNCED_PREFERENCE_KEYS.length,
        maxItemBytes: 256,
        allowDelete: false,
        pageSize: SYNCED_PREFERENCE_KEYS.length,
    }),
    // One item per Connectivity list (each up to ~32 KB), the lists' order and the default list id; a deleted list
    // syncs as a tombstone.
    connectivity: row({
        id: 'connectivity',
        version: CONNECTIVITY_SYNC_VERSION,
        isValidItemId: isConnectivityItemId,
        isValidValue: isConnectivityValue,
        maxItems: CONNECTIVITY_MAX_ITEMS,
        maxRows: CONNECTIVITY_MAX_ROWS,
        maxItemBytes: 32 * KB,
        allowDelete: true,
        pageSize: CONNECTIVITY_MAX_ITEMS,
    }),
    // One item per checked or ignored Security Checklist item, by slug.
    checklist: row({
        id: 'checklist',
        version: CHECKLIST_SYNC_VERSION,
        isValidItemId: isChecklistSlug,
        isValidValue: (id, value) => isChecklistSlug(id) && isChecklistMark(value),
        maxItems: CHECKLIST_MAX_ITEMS,
        maxRows: CHECKLIST_MAX_ITEMS,
        maxItemBytes: 16,
        allowDelete: true,
        pageSize: CHECKLIST_MAX_ITEMS,
    }),
    // The speed test's download and upload sizes.
    speedtest: row({
        id: 'speedtest',
        version: SPEEDTEST_SYNC_VERSION,
        isValidItemId: isSpeedtestItemId,
        isValidValue: (id, value) => isSpeedtestItemId(id) && isValidSpeedtestSize(value),
        maxItems: SPEEDTEST_ITEM_IDS.length,
        maxItemBytes: 32,
        allowDelete: false,
        pageSize: SPEEDTEST_ITEM_IDS.length,
    }),
});

export const SYNC_COLLECTION_IDS = Object.freeze(Object.keys(SYNC_COLLECTIONS));

// The item PUT body limit: the largest item plus room for the envelope and a collection's other items.
export const SYNC_MAX_BODY_BYTES = 320 * KB;

// The registry row for `id`, or null.
export const syncCollectionOf = (id, collections = SYNC_COLLECTIONS) =>
    (typeof id === 'string' && Object.hasOwn(collections, id) ? collections[id] : null);
