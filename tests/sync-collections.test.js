// Specs for the synced collections registry (common/sync-collections.js) and its front-end bridge.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SYNC_COLLECTIONS, SYNC_COLLECTION_IDS, syncCollectionOf, syncValueBytes,
    CONNECTIVITY_SYNC_VERSION, CONNECTIVITY_SYNC_ITEM_IDS, SYNC_OFF_CODE,
    SYNC_MAX_ITEMS_PER_REQUEST, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_BODY_BYTES,
} from '../common/sync-collections.js';
import * as syncBridge from '../frontend/utils/sync-collections.js';
import { PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_TARGET_LIMIT } from '../common/preferences-schema.js';
import { DEFAULT_PREFERENCES } from '../frontend/data/default-preferences.js';
import { sanitizeLists } from '../frontend/utils/features/connectivity-lists.js';

const { preferences, connectivity } = SYNC_COLLECTIONS;
const KB = 1024;

describe('sync collections registry', () => {
    it('has the two collections, frozen, each with the full row shape', () => {
        assert.deepEqual([...SYNC_COLLECTION_IDS], ['preferences', 'connectivity']);
        assert.ok(Object.isFrozen(SYNC_COLLECTIONS));
        for (const id of SYNC_COLLECTION_IDS) {
            const row = SYNC_COLLECTIONS[id];
            assert.ok(Object.isFrozen(row), id);
            assert.equal(row.id, id);
            assert.ok(Number.isInteger(row.version) && row.version > 0, id);
            assert.equal(typeof row.isValidItemId, 'function', id);
            assert.equal(typeof row.isValidValue, 'function', id);
            for (const key of ['maxItems', 'maxItemBytes', 'pageSize']) assert.ok(Number.isInteger(row[key]) && row[key] > 0, `${id}.${key}`);
            assert.equal(typeof row.allowDelete, 'boolean', id);
            assert.ok(row.pageSize >= row.maxItems, `${id}: one page holds every item`);
        }
        assert.equal(SYNC_MAX_ITEMS_PER_REQUEST, 500);
        assert.equal(SYNC_TOMBSTONE_TTL_MS, 90 * 24 * 60 * 60 * 1000);
        assert.equal(SYNC_OFF_CODE, 'sync_off');
    });

    it('the item body limit holds a collection at its largest', () => {
        assert.ok(SYNC_MAX_BODY_BYTES >= preferences.maxItems * preferences.maxItemBytes + 16 * KB);
        assert.ok(SYNC_MAX_BODY_BYTES >= connectivity.maxItemBytes + 16 * KB);
        assert.ok(SYNC_MAX_BODY_BYTES <= 512 * KB);
    });

    it('looks rows up by own id only', () => {
        assert.equal(syncCollectionOf('connectivity'), connectivity);
        for (const id of ['', 'nope', 'snapshots', 'checklist', 'constructor', '__proto__', 'toString', undefined, null, 3]) {
            assert.equal(syncCollectionOf(id), null, String(id));
        }
        const stub = Object.freeze({ other: Object.freeze({ id: 'other' }) });
        assert.equal(syncCollectionOf('other', stub), stub.other);
        assert.equal(syncCollectionOf('connectivity', stub), null);
    });

    it('the bridge re-exports the very same values', () => {
        assert.equal(syncBridge.SYNC_COLLECTIONS, SYNC_COLLECTIONS);
        assert.equal(syncBridge.syncCollectionOf, syncCollectionOf);
        assert.equal(syncBridge.CONNECTIVITY_SYNC_VERSION, CONNECTIVITY_SYNC_VERSION);
        assert.equal(syncBridge.SYNC_OFF_CODE, SYNC_OFF_CODE);
        assert.equal(syncBridge.SYNC_MAX_BODY_BYTES, SYNC_MAX_BODY_BYTES);
    });

    it('measures values as UTF-8 JSON', () => {
        assert.equal(syncValueBytes('checked'), 9);
        assert.equal(syncValueBytes({ a: 'é' }), 10);
        assert.equal(syncValueBytes(undefined), 0);
    });
});

describe('preferences collection', () => {
    it('is one item per synced key at PREFERENCES_VERSION, no deletes', () => {
        assert.equal(preferences.version, PREFERENCES_VERSION);
        assert.equal(preferences.maxItems, SYNCED_PREFERENCE_KEYS.length);
        assert.equal(preferences.allowDelete, false);
    });

    it('accepts synced keys only; the Connectivity lists are not preferences here', () => {
        for (const key of SYNCED_PREFERENCE_KEYS) assert.equal(preferences.isValidItemId(key), true, key);
        for (const id of ['connectivityLists', 'connectivityDefaultListId', 'preferencesSync', 'connectivityTargets', 'constructor', '__proto__', '', 7]) {
            assert.equal(preferences.isValidItemId(id), false, String(id));
        }
    });

    it('every default value passes, within the small item cap; a bad value does not', () => {
        for (const key of SYNCED_PREFERENCE_KEYS) {
            assert.equal(preferences.isValidValue(key, DEFAULT_PREFERENCES[key]), true, key);
            assert.ok(syncValueBytes(DEFAULT_PREFERENCES[key]) <= preferences.maxItemBytes, key);
        }
        assert.ok(syncValueBytes('x'.repeat(35)) <= preferences.maxItemBytes, 'the longest lang tag fits');
        assert.equal(preferences.isValidValue('theme', 'purple'), false);
        assert.equal(preferences.isValidValue('simpleMode', 'true'), false);
        assert.equal(preferences.isValidValue('nope', true), false);
    });
});

describe('connectivity collection', () => {
    const member = (i) => ({ id: `m${i}`, name: `Site ${i}`.padEnd(100, 'x'), url: `https://site-${i}.example.com/${'p'.repeat(60)}`, siteUrl: `https://site-${i}.example.com/` });
    const busyLists = () => ({
        schemaVersion: 1,
        lists: Array.from({ length: CONNECTIVITY_LIST_LIMIT }, (_, l) => ({
            id: l ? `list-${l}` : 'mine', name: l ? `List ${l}` : null,
            members: Array.from({ length: CONNECTIVITY_TARGET_LIMIT }, (_, m) => member(l * 100 + m)),
        })),
    });

    it('is version 1, exactly two items, no deletes, one small page', () => {
        assert.equal(connectivity.version, CONNECTIVITY_SYNC_VERSION);
        assert.equal(connectivity.version, 1);
        assert.deepEqual([...CONNECTIVITY_SYNC_ITEM_IDS], ['lists', 'defaultListId']);
        assert.equal(connectivity.maxItems, 2);
        assert.equal(connectivity.allowDelete, false);
        assert.equal(connectivity.maxItemBytes, 256 * KB);
        assert.ok(connectivity.pageSize <= 2);
    });

    it('accepts its two item ids only', () => {
        for (const id of CONNECTIVITY_SYNC_ITEM_IDS) assert.equal(connectivity.isValidItemId(id), true, id);
        for (const id of ['connectivityLists', 'mine', 'constructor', '__proto__', 'toString', '', null, 1]) {
            assert.equal(connectivity.isValidItemId(id), false, String(id));
        }
        assert.equal(connectivity.isValidValue('constructor', {}), false);
    });

    it('the sanitized default lists pass as `lists`, the default list id as `defaultListId`', () => {
        const lists = sanitizeLists(null, null, []);
        assert.equal(connectivity.isValidValue('lists', lists), true);
        assert.equal(connectivity.isValidValue('defaultListId', DEFAULT_PREFERENCES.connectivityDefaultListId), true);
        assert.equal(connectivity.isValidValue('defaultListId', lists), false);
        assert.equal(connectivity.isValidValue('lists', 'mine'), false);
        for (const bad of ['', 'x'.repeat(65), 3, null]) assert.equal(connectivity.isValidValue('defaultListId', bad), false, String(bad));
        assert.equal(connectivity.isValidValue('lists', { ...lists, extra: 1 }), false);
    });

    it('a busy model (every list full, long names and URLs) fits the item cap', (t) => {
        const lists = busyLists();
        assert.equal(connectivity.isValidValue('lists', lists), true);
        const bytes = syncValueBytes(lists);
        t.diagnostic(`busy lists ${bytes} B, cap ${connectivity.maxItemBytes} B`);
        assert.ok(bytes < connectivity.maxItemBytes, `${bytes} B`);
    });
});
