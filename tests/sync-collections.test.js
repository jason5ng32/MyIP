// Specs for the synced collections registry (common/sync-collections.js) and its front-end bridge.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SYNC_COLLECTIONS, SYNC_COLLECTION_IDS, syncCollectionOf, syncValueBytes,
    CONNECTIVITY_SYNC_VERSION, CONNECTIVITY_SYNC_ITEM_IDS, SYNC_OFF_CODE, connectivityListItemId, connectivityListIdOf,
    SYNC_MAX_ITEMS_PER_REQUEST, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_BODY_BYTES,
} from '../common/sync-collections.js';
import * as syncBridge from '../frontend/utils/sync-collections.js';
import {
    PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_TARGET_LIMIT, CONNECTIVITY_ORDER_LIMIT,
} from '../common/preferences-schema.js';
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
        assert.equal(syncBridge.connectivityListItemId, connectivityListItemId);
        assert.equal(syncBridge.connectivityListIdOf, connectivityListIdOf);
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
    const busyList = () => ({ name: 'x'.repeat(40), members: Array.from({ length: CONNECTIVITY_TARGET_LIMIT }, (_, m) => member(m)) });

    it('is version 2: one item per list plus the order and the default list id, with deletes', () => {
        assert.equal(connectivity.version, CONNECTIVITY_SYNC_VERSION);
        assert.equal(connectivity.version, 2);
        assert.deepEqual([...CONNECTIVITY_SYNC_ITEM_IDS], ['order', 'defaultListId']);
        assert.equal(connectivity.maxItems, CONNECTIVITY_LIST_LIMIT + 2);
        assert.equal(connectivity.allowDelete, true);
        assert.equal(connectivity.maxItemBytes, 32 * KB);
        assert.equal(connectivity.pageSize, connectivity.maxItems);
    });

    it('list item ids: `list:` and a bounded list id', () => {
        assert.equal(connectivityListItemId('work'), 'list:work');
        assert.equal(connectivityListIdOf('list:mine'), 'mine');
        assert.equal(connectivityListIdOf('list:list-1700000000000'), 'list-1700000000000');
        for (const id of ['list:', `list:${'x'.repeat(65)}`, 'order', 'mine', 'lists', null, 3]) {
            assert.equal(connectivityListIdOf(id), null, String(id));
        }
    });

    it('accepts list items, `order` and `defaultListId` only', () => {
        for (const id of [...CONNECTIVITY_SYNC_ITEM_IDS, 'list:mine', 'list:work']) assert.equal(connectivity.isValidItemId(id), true, id);
        for (const id of ['lists', 'connectivityLists', 'mine', 'list:', 'constructor', '__proto__', 'toString', '', null, 1]) {
            assert.equal(connectivity.isValidItemId(id), false, String(id));
        }
        assert.equal(connectivity.isValidValue('constructor', {}), false);
        assert.equal(connectivity.isValidValue('lists', sanitizeLists(null, null, [])), false);
    });

    it('the sanitized default list passes as its item, ids as `order` and `defaultListId`', () => {
        const [mine] = sanitizeLists(null, null, []).lists;
        assert.equal(connectivity.isValidValue('list:mine', { name: mine.name, members: mine.members }), true);
        assert.equal(connectivity.isValidValue('list:mine', mine), false, 'the id rides the item id');
        assert.equal(connectivity.isValidValue('list:work', { name: null, members: [] }), false, 'only Mine is unnamed');
        assert.equal(connectivity.isValidValue('list:mine', { name: 'Mine', members: [] }), false);
        assert.equal(connectivity.isValidValue('order', ['mine', 'list-1']), true);
        for (const bad of [['mine', 'mine'], [''], 'mine', Array.from({ length: CONNECTIVITY_ORDER_LIMIT + 1 }, (_, i) => `l${i}`)]) {
            assert.equal(connectivity.isValidValue('order', bad), false, JSON.stringify(bad));
        }
        assert.equal(connectivity.isValidValue('defaultListId', DEFAULT_PREFERENCES.connectivityDefaultListId), true);
        for (const bad of ['', 'x'.repeat(65), 3, null, ['mine']]) assert.equal(connectivity.isValidValue('defaultListId', bad), false, String(bad));
    });

    it('a busy list (full, long names and URLs) fits the item cap; every list at once fits the body limit in batches', (t) => {
        const list = busyList();
        assert.equal(connectivity.isValidValue('list:work', list), true);
        const bytes = syncValueBytes(list);
        t.diagnostic(`busy list ${bytes} B, cap ${connectivity.maxItemBytes} B`);
        assert.ok(bytes < connectivity.maxItemBytes, `${bytes} B`);
        assert.ok(SYNC_MAX_BODY_BYTES >= connectivity.maxItemBytes + 16 * KB);
    });
});
