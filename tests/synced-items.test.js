// Specs for synced items (server/db/synced-items.js): the pure merge plan and the repository over the fake user storage.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SYNC_REFUSAL, mergeDecision, planSyncWrite, listSyncedItems, saveSyncedItems,
} from '../server/db/synced-items.js';
import { SYNC_COLLECTIONS, SYNC_TOMBSTONE_TTL_MS } from '../common/sync-collections.js';
import { ensureUser } from '../server/db/users.js';
import { fakeUserDb } from './fake-user-db.js';

const NOW = 1_000_000_000_000;
const { preferences, connectivity } = SYNC_COLLECTIONS;
// A stand-in collection with deletes, exercising the generic engine (tombstones, caps) no registry row uses.
const checklist = Object.freeze({
    id: 'ticks', version: 1,
    isValidItemId: (id) => typeof id === 'string' && /^[a-z0-9-]{1,128}$/.test(id),
    isValidValue: (id, value) => value === 'checked' || value === 'ignored',
    maxItems: 1000, maxItemBytes: 64, allowDelete: true, pageSize: 500,
});
const tick = (id, updatedAt, value = 'checked') => ({ id, updatedAt, deleted: false, value });
const drop = (id, updatedAt) => ({ id, updatedAt, deleted: true });
const plan = (items, { collection = checklist, stored = [], liveCount, now = NOW } = {}) => planSyncWrite({
    collection,
    items,
    stored: new Map(stored.map((item) => [item.id, item])),
    liveCount: liveCount ?? stored.filter((item) => !item.deleted).length,
    now,
});

describe('mergeDecision', () => {
    it('inserts with nothing stored, keeps a stored edit as new or newer, replaces an older one', () => {
        assert.equal(mergeDecision(null, 5), 'insert');
        assert.equal(mergeDecision({ updatedAt: 6 }, 5), 'keep');
        assert.equal(mergeDecision({ updatedAt: 5 }, 5), 'keep');
        assert.equal(mergeDecision({ updatedAt: 4 }, 5), 'replace');
        assert.equal(mergeDecision({ updatedAt: 4, deleted: true }, 5), 'replace');
    });
});

describe('planSyncWrite', () => {
    it('newer wins; a tie or older edit keeps the stored item and returns it as a conflict', () => {
        const stored = [tick('a', 100), tick('b', 200, 'ignored'), tick('c', 300)];
        const result = plan([tick('a', 150, 'ignored'), tick('b', 200), tick('c', 250, 'ignored'), tick('d', 10)], { stored });
        assert.deepEqual(result.writes, [tick('a', 150, 'ignored'), tick('d', 10)]);
        assert.deepEqual(result.conflicts, [tick('b', 200, 'ignored'), tick('c', 300)]);
        assert.deepEqual(result.refused, []);
    });

    it('clamps a future edit time to now before comparing', () => {
        assert.deepEqual(plan([tick('a', NOW * 2)]).writes, [tick('a', NOW)]);
        const kept = plan([tick('a', NOW + 1, 'ignored')], { stored: [tick('a', NOW)] });
        assert.deepEqual(kept.writes, []);
        assert.deepEqual(kept.conflicts, [tick('a', NOW)]);
    });

    it('a delete replaces like an edit and is written as a tombstone; a newer edit revives one', () => {
        assert.deepEqual(plan([drop('a', 200)], { stored: [tick('a', 100)] }).writes, [drop('a', 200)]);
        assert.deepEqual(plan([drop('new', 5)]).writes, [drop('new', 5)]);
        assert.deepEqual(plan([tick('a', 300)], { stored: [drop('a', 200)] }).writes, [tick('a', 300)]);
        assert.deepEqual(plan([tick('a', 100)], { stored: [drop('a', 200)] }).conflicts, [drop('a', 200)]);
    });

    it('refuses an invalid or oversized value and a delete where deletes are off; the rest still applies', () => {
        const result = plan([
            tick('a', 1, 'maybe'),
            { id: 'b', updatedAt: 1, deleted: false, value: 'x'.repeat(checklist.maxItemBytes) },
            { id: 'c', updatedAt: 1, deleted: false },
            tick('d', 1),
        ]);
        assert.deepEqual(result.refused, [
            { id: 'a', reason: SYNC_REFUSAL.INVALID },
            { id: 'b', reason: SYNC_REFUSAL.TOO_LARGE },
            { id: 'c', reason: SYNC_REFUSAL.INVALID },
        ]);
        assert.deepEqual(result.writes, [tick('d', 1)]);
        const prefs = plan([drop('theme', 5), { id: 'lang', updatedAt: 5, deleted: false, value: 'fr' }], { collection: preferences });
        assert.deepEqual(prefs.refused, [{ id: 'theme', reason: SYNC_REFUSAL.NO_DELETE }]);
        assert.deepEqual(prefs.writes, [{ id: 'lang', updatedAt: 5, deleted: false, value: 'fr' }]);
    });

    it('refuses new live items past maxItems, in request order; deletes and replacements free or keep room', () => {
        const small = { ...checklist, maxItems: 2 };
        const full = plan([tick('c', 5), drop('a', 5), tick('d', 5), tick('e', 5), tick('b', 5, 'ignored')], {
            collection: small, stored: [tick('a', 1), tick('b', 1), drop('z', 1)],
        });
        assert.deepEqual(full.refused, [{ id: 'c', reason: SYNC_REFUSAL.FULL }, { id: 'e', reason: SYNC_REFUSAL.FULL }]);
        assert.deepEqual(full.writes, [drop('a', 5), tick('d', 5), tick('b', 5, 'ignored')]);
        // Reviving a tombstone counts as a new live item.
        assert.deepEqual(plan([tick('z', 5)], { collection: small, stored: [tick('a', 1), tick('b', 1), drop('z', 1)] }).refused,
            [{ id: 'z', reason: SYNC_REFUSAL.FULL }]);
    });
});

describe('planSyncWrite over the Connectivity collection', () => {
    const list = (id, updatedAt) => ({ id: `list:${id}`, updatedAt, deleted: false, value: { name: id, members: [] } });

    it('takes list tombstones; past the order, the default list id and CONNECTIVITY_LIST_LIMIT lists a new list is full', () => {
        const stored = [
            { id: 'order', updatedAt: 1, deleted: false, value: [] },
            { id: 'defaultListId', updatedAt: 1, deleted: false, value: 'mine' },
            ...Array.from({ length: connectivity.maxItems - 2 }, (_, i) => list(`l${i}`, 1)),
        ];
        const result = plan([list('extra', 5), drop('list:l0', 5), list('again', 5)], { collection: connectivity, stored });
        assert.deepEqual(result.refused, [{ id: 'list:extra', reason: SYNC_REFUSAL.FULL }]);
        assert.deepEqual(result.writes, [drop('list:l0', 5), list('again', 5)]);
    });
});

describe('synced items repository', () => {
    // Each user has the stand-in and preferences enabled.
    const enable = (db, id) => db.syncSettings.set(id, { collections: [checklist.id, preferences.id], updated_at: new Date() });
    const setup = async (users = ['u']) => {
        const db = fakeUserDb();
        for (const id of users) {
            await ensureUser(db.query, id);
            enable(db, id);
        }
        const transaction = (fn) => fn(db.query);
        const save = (userId, items, { collection = checklist, version = collection.version, now = NOW } = {}) =>
            saveSyncedItems(transaction, { userId, collection, version, items, now });
        const list = (userId, { collection = checklist, version = collection.version, since = 0, limit = 50 } = {}) =>
            listSyncedItems(db.query, { userId, collection: collection.id, version, since, limit });
        return { db, save, list };
    };

    it('stores, lists in seq order and reports base / cursor', async () => {
        const { save, list } = await setup();
        const first = await save('u', [tick('a', 1), tick('b', 2)]);
        assert.deepEqual(first, { base: 0, cursor: 2, conflicts: [], refused: [] });
        const second = await save('u', [tick('a', 3, 'ignored'), tick('b', 1, 'ignored')]);
        assert.deepEqual(second, { base: 2, cursor: 3, conflicts: [tick('b', 2)], refused: [] });
        assert.deepEqual(await list('u'), { cursor: 3, more: false, items: [tick('b', 2), tick('a', 3, 'ignored')] });
        assert.deepEqual(await list('u', { since: 2 }), { cursor: 3, more: false, items: [tick('a', 3, 'ignored')] });
        assert.deepEqual(await list('u', { since: 3 }), { cursor: 3, more: false, items: [] });
    });

    it('pages with `more`', async () => {
        const { save, list } = await setup();
        await save('u', [tick('a', 1), tick('b', 1), tick('c', 1)]);
        const page1 = await list('u', { limit: 2 });
        assert.deepEqual(page1, { cursor: 2, more: true, items: [tick('a', 1), tick('b', 1)] });
        assert.deepEqual(await list('u', { since: page1.cursor, limit: 2 }), { cursor: 3, more: false, items: [tick('c', 1)] });
    });

    it('a write with nothing to store keeps base = cursor', async () => {
        const { save } = await setup();
        await save('u', [tick('a', 5)]);
        assert.deepEqual(await save('u', []), { base: 1, cursor: 1, conflicts: [], refused: [] });
        assert.deepEqual(await save('u', [tick('a', 4)]), { base: 1, cursor: 1, conflicts: [tick('a', 5)], refused: [] });
    });

    it('stores a tombstone with no data and lists it without a value', async () => {
        const { db, save, list } = await setup();
        await save('u', [tick('a', 1)]);
        await save('u', [drop('a', 2)]);
        const [row] = db.syncedItems.values();
        assert.equal(row.deleted, true);
        assert.equal(row.data, null);
        assert.deepEqual((await list('u')).items, [drop('a', 2)]);
    });

    it('removes this collection\'s tombstones older than 90 days on a write, in every version', async () => {
        const { db, save, list } = await setup();
        const old = NOW - SYNC_TOMBSTONE_TTL_MS - 1;
        await save('u', [drop('gone', old), drop('fresh', NOW - 1), tick('live', old)]);
        assert.equal(db.syncedItems.size, 3, 'an expired tombstone written now stays until the next write');
        // A write to another version of the collection prunes this version too.
        await save('u', [drop('other-version', old)], { version: checklist.version + 1 });
        assert.deepEqual((await list('u')).items.map(({ id }) => id), ['fresh', 'live']);
        // Another collection's write leaves these alone.
        await save('u', [{ id: 'theme', updatedAt: old, deleted: false, value: 'dark' }], { collection: preferences });
        assert.equal((await list('u', { version: checklist.version + 1 })).items.length, 1);
        await save('u', []);
        assert.deepEqual((await list('u', { version: checklist.version + 1 })).items, []);
        assert.equal((await list('u', { collection: preferences })).items.length, 1);
    });

    it('keeps versions apart: a write to one never touches or counts the other', async () => {
        const { save, list } = await setup();
        await save('u', [tick('a', 1), tick('b', 1)]);
        const v2 = { ...checklist, version: checklist.version + 1, maxItems: 1 };
        const result = await save('u', [tick('a', 9, 'ignored')], { collection: v2 });
        assert.deepEqual(result, { base: 0, cursor: 3, conflicts: [], refused: [] });
        assert.deepEqual((await list('u')).items, [tick('a', 1), tick('b', 1)]);
        assert.deepEqual((await list('u', { version: v2.version })).items, [tick('a', 9, 'ignored')]);
    });

    it('keeps users apart', async () => {
        const { save, list } = await setup(['u', 'v']);
        await save('u', [tick('a', 1)]);
        assert.deepEqual(await save('v', [tick('a', 2, 'ignored')]), { base: 0, cursor: 2, conflicts: [], refused: [] });
        assert.deepEqual((await list('u')).items, [tick('a', 1)]);
        assert.deepEqual((await list('v')).items, [tick('a', 2, 'ignored')]);
    });

    it('locks the user first, writes the whole batch in one statement, and passes every value as a parameter', async () => {
        const { db, save } = await setup();
        const userId = "u'); DROP TABLE synced_items; --";
        await ensureUser(db.query, userId);
        enable(db, userId);
        db.calls.length = 0;
        const items = Array.from({ length: 100 }, (_, i) => tick(`slug-${i}`, i + 1));
        await save(userId, items);
        const texts = db.calls.map(({ text }) => text);
        assert.equal(texts[0], 'SELECT id FROM users WHERE id = $1 FOR UPDATE');
        assert.equal(texts[1], 'SELECT 1 AS enabled FROM sync_settings WHERE user_id = $1 AND $2 = ANY(collections)');
        assert.equal(texts.length, 6);
        assert.equal(texts.filter((text) => text.startsWith('INSERT INTO synced_items')).length, 1);
        assert.ok(texts.every((text) => !text.includes('DROP') && !text.includes('slug-') && !text.includes('checked')));
    });

    it('a collection the user has not enabled → null after the lock and the check, nothing written', async () => {
        const { db, save } = await setup();
        await ensureUser(db.query, 'w');
        for (const settings of [undefined, { collections: [] }, { collections: [preferences.id] }]) {
            if (settings) db.syncSettings.set('w', { ...settings, updated_at: new Date() });
            db.calls.length = 0;
            assert.equal(await save('w', [tick('a', 1)]), null);
            assert.deepEqual(db.calls.map(({ text }) => text.split(' ').slice(0, 4).join(' ')),
                ['SELECT id FROM users', 'SELECT 1 AS enabled']);
        }
        assert.equal([...db.syncedItems.values()].filter((row) => row.user_id === 'w').length, 0);
    });

    it('needs the users row', async () => {
        const { save } = await setup([]);
        await assert.rejects(save('nobody', [tick('a', 1)]), /existing user/);
    });
});
