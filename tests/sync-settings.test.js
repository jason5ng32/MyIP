// Specs for the account sync settings repository (server/db/sync-settings.js) over the fake user storage.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readSyncSettings, isSyncEnabled, saveSyncSettings } from '../server/db/sync-settings.js';
import { ensureUser } from '../server/db/users.js';
import { fakeUserDb } from './fake-user-db.js';
import { SYNC_COLLECTION_IDS } from '../common/sync-collections.js';

const transactionOf = (db) => (fn) => fn(db.query);

// A synced_items row straight into the fake table.
const putRow = (db, user, collection, version, item, { deleted = false } = {}) => db.syncedItems.set(
    [user, collection, version, item].join('\u0000'),
    { user_id: user, collection, schema_version: version, item_id: item, updated_at: 1, deleted, data: deleted ? null : 'v', seq: db.syncedItems.size + 1 },
);
const rowsOf = (db, user) => [...db.syncedItems.values()].filter((row) => row.user_id === user)
    .map((row) => `${row.collection}/${row.schema_version}/${row.item_id}`).sort();

describe('sync settings repository', () => {
    const setup = async (users = ['u', 'v']) => {
        const db = fakeUserDb();
        for (const id of users) await ensureUser(db.query, id);
        const save = (userId, collections) => saveSyncSettings(transactionOf(db), { userId, collections });
        return { db, save };
    };

    it('no row → every registry collection enabled', async () => {
        const { db } = await setup();
        assert.deepEqual(await readSyncSettings(db.query, 'u'), { collections: [...SYNC_COLLECTION_IDS] });
        for (const id of SYNC_COLLECTION_IDS) assert.equal(await isSyncEnabled(db.query, 'u', id), true);
        assert.equal(await isSyncEnabled(db.query, 'u', 'snapshots'), false);
    });

    it('a stored empty list syncs nothing; enabling stores the ids in registry order', async () => {
        const { db, save } = await setup();
        assert.deepEqual(await save('u', []), { collections: [] });
        assert.deepEqual(await readSyncSettings(db.query, 'u'), { collections: [] });
        assert.equal(await isSyncEnabled(db.query, 'u', 'preferences'), false);
        assert.deepEqual(await save('u', ['connectivity', 'preferences']), { collections: ['preferences', 'connectivity'] });
        assert.deepEqual(await readSyncSettings(db.query, 'u'), { collections: ['preferences', 'connectivity'] });
        assert.equal(await isSyncEnabled(db.query, 'u', 'connectivity'), true);
        assert.deepEqual(await readSyncSettings(db.query, 'v'), { collections: [...SYNC_COLLECTION_IDS] });
    });

    it('a stored id the registry no longer has is left out of the answer', async () => {
        const { db } = await setup();
        db.syncSettings.set('u', { collections: ['snapshots', 'connectivity', 'ipHistory'], updated_at: new Date() });
        assert.deepEqual(await readSyncSettings(db.query, 'u'), { collections: ['connectivity'] });
    });

    it('turning a collection off deletes its rows in every version, tombstones too; others and other users stay', async () => {
        const { db, save } = await setup();
        await save('u', ['preferences', 'connectivity']);
        for (const user of ['u', 'v']) {
            putRow(db, user, 'preferences', 7, 'theme');
            putRow(db, user, 'preferences', 6, 'theme');
            putRow(db, user, 'connectivity', 1, 'lists');
            putRow(db, user, 'connectivity', 1, 'defaultListId');
            putRow(db, user, 'snapshots', 1, 'old-snapshot');
            putRow(db, user, 'ipHistory', 1, 'old-tick', { deleted: true });
        }
        await save('u', ['connectivity']);
        assert.deepEqual(rowsOf(db, 'u'), ['connectivity/1/defaultListId', 'connectivity/1/lists']);
        assert.equal(rowsOf(db, 'v').length, 6);
        await save('u', []);
        assert.deepEqual(rowsOf(db, 'u'), []);
        assert.equal(rowsOf(db, 'v').length, 6);
    });

    it('locks the user first, then upserts and deletes, every value a parameter', async () => {
        const { db, save } = await setup();
        db.calls.length = 0;
        await save('u', ['preferences']);
        assert.deepEqual(db.calls.map(({ text }) => text), [
            'SELECT id FROM users WHERE id = $1 FOR UPDATE',
            'INSERT INTO sync_settings (user_id, collections) VALUES ($1, $2::text[]) '
                + 'ON CONFLICT (user_id) DO UPDATE SET collections = EXCLUDED.collections, updated_at = now()',
            'DELETE FROM synced_items WHERE user_id = $1 AND collection <> ALL($2::text[])',
        ]);
        assert.deepEqual(db.calls.map(({ params }) => params), [['u'], ['u', ['preferences']], ['u', ['preferences']]]);
    });

    it('needs the users row', async () => {
        const { save } = await setup([]);
        await assert.rejects(save('nobody', []), /existing user/);
    });
});
