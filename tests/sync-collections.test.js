// Specs for the synced collections registry (common/sync-collections.js) and its front-end bridge.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SYNC_COLLECTIONS, SYNC_COLLECTION_IDS, syncCollectionOf, syncValueBytes,
    CONNECTIVITY_SYNC_VERSION, CONNECTIVITY_SYNC_ITEM_IDS, SYNC_OFF_CODE, connectivityListItemId, connectivityListIdOf,
    CHECKLIST_SYNC_VERSION, SPEEDTEST_SYNC_VERSION, CHECKLIST_MARKS, isChecklistSlug, isChecklistMark,
    SYNC_MAX_ITEMS_PER_REQUEST, SYNC_TOMBSTONE_TTL_MS, SYNC_MAX_BODY_BYTES,
} from '../common/sync-collections.js';
import * as syncBridge from '../frontend/utils/sync-collections.js';
import {
    PREFERENCES_VERSION, SYNCED_PREFERENCE_KEYS, CONNECTIVITY_LIST_LIMIT, CONNECTIVITY_TARGET_LIMIT, CONNECTIVITY_ORDER_LIMIT,
    SPEEDTEST_SIZE_OPTIONS,
} from '../common/preferences-schema.js';
import { DEFAULT_PREFERENCES } from '../frontend/data/default-preferences.js';
import { sanitizeLists } from '../frontend/utils/features/connectivity-lists.js';
import { readFileSync, readdirSync } from 'node:fs';

const { preferences, connectivity, checklist, speedtest } = SYNC_COLLECTIONS;
const KB = 1024;

describe('sync collections registry', () => {
    it('has the four collections, frozen, each with the full row shape', () => {
        assert.deepEqual([...SYNC_COLLECTION_IDS], ['preferences', 'connectivity', 'checklist', 'speedtest']);
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
        const fullChecklistBatch = Array.from({ length: SYNC_MAX_ITEMS_PER_REQUEST }, (_, i) => (
            { id: `${'x'.repeat(124)}${String(i).padStart(4, '0')}`, updatedAt: Date.now(), value: 'checked' }));
        assert.ok(syncValueBytes({ version: 1, items: fullChecklistBatch }) < SYNC_MAX_BODY_BYTES, 'a full checklist request');
        assert.ok(SYNC_MAX_BODY_BYTES <= 512 * KB);
    });

    it('looks rows up by own id only', () => {
        assert.equal(syncCollectionOf('connectivity'), connectivity);
        for (const id of ['', 'nope', 'snapshots', 'ipHistory', 'constructor', '__proto__', 'toString', undefined, null, 3]) {
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
        const fullChecklistBatch = Array.from({ length: SYNC_MAX_ITEMS_PER_REQUEST }, (_, i) => (
            { id: `${'x'.repeat(124)}${String(i).padStart(4, '0')}`, updatedAt: Date.now(), value: 'checked' }));
        assert.ok(syncValueBytes({ version: 1, items: fullChecklistBatch }) < SYNC_MAX_BODY_BYTES, 'a full checklist request');
    });
});

describe('checklist collection', () => {
    const DATASET_DIR = new URL('../frontend/locales/security-checklist/', import.meta.url);
    const slugsOf = (file) => JSON.parse(readFileSync(new URL(file, DATASET_DIR), 'utf8'))
        .flatMap((category) => category.checklist.map((item) => item.slug));

    it('is version 1: one item per marked slug, two marks, deletes for unset', () => {
        assert.equal(checklist.version, CHECKLIST_SYNC_VERSION);
        assert.equal(checklist.version, 1);
        assert.deepEqual([...CHECKLIST_MARKS], ['checked', 'ignored']);
        assert.equal(checklist.allowDelete, true);
        assert.equal(checklist.maxItems, 1000);
        assert.equal(checklist.maxItemBytes, 16);
        for (const mark of CHECKLIST_MARKS) assert.ok(syncValueBytes(mark) <= checklist.maxItemBytes, mark);
    });

    it('every slug of every locale\'s dataset is a valid id, the same set everywhere, well under the cap', (t) => {
        const files = readdirSync(DATASET_DIR).filter((file) => file.endsWith('.json'));
        const [first, ...rest] = files.map((file) => new Set(slugsOf(file)));
        t.diagnostic(`${first.size} checklist items`);
        for (const slugs of rest) assert.deepEqual([...slugs].sort(), [...first].sort());
        for (const slug of first) assert.equal(checklist.isValidItemId(slug), true, slug);
        assert.ok(first.size * 2 < checklist.maxItems);
    });

    it('ids by shape, values by mark', () => {
        assert.equal(isChecklistSlug('email-use-aliasing--anonymous-forwarding'), true);
        for (const id of ['', '-a', 'Email', 'a b', 'a_b', 'x'.repeat(129), 'constructor!', null, 3]) {
            assert.equal(checklist.isValidItemId(id), false, String(id));
        }
        assert.equal(checklist.isValidValue('a-b', 'checked'), true);
        assert.equal(checklist.isValidValue('a-b', 'ignored'), true);
        for (const value of ['', 'unchecked', true, null]) assert.equal(isChecklistMark(value), false, String(value));
        assert.equal(checklist.isValidValue('A', 'checked'), false);
    });
});

describe('speedtest collection', () => {
    it('is version 1: exactly the two sizes, no deletes', () => {
        assert.equal(speedtest.version, SPEEDTEST_SYNC_VERSION);
        assert.equal(speedtest.version, 1);
        assert.equal(speedtest.maxItems, 2);
        assert.equal(speedtest.allowDelete, false);
        for (const id of ['downloadBytes', 'uploadBytes']) assert.equal(speedtest.isValidItemId(id), true, id);
        for (const id of ['speedtestDownloadBytes', 'latency', '', 'constructor', null]) assert.equal(speedtest.isValidItemId(id), false, String(id));
    });

    it('values are the size options only; the defaults pass within the item cap', () => {
        for (const size of SPEEDTEST_SIZE_OPTIONS) assert.equal(speedtest.isValidValue('uploadBytes', size), true, String(size));
        for (const bad of [2e6, '50000000', null]) assert.equal(speedtest.isValidValue('downloadBytes', bad), false, String(bad));
        assert.equal(speedtest.isValidValue('nope', 50e6), false);
        assert.equal(speedtest.isValidValue('downloadBytes', DEFAULT_PREFERENCES.speedtestDownloadBytes), true);
        assert.equal(speedtest.isValidValue('uploadBytes', DEFAULT_PREFERENCES.speedtestUploadBytes), true);
        assert.ok(syncValueBytes(100e6) <= speedtest.maxItemBytes);
    });
});
