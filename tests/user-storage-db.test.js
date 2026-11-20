// Optional spec against a real Postgres at DATABASE_URL_TEST; skipped when it is unset.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createUserStorage } from '../server/db/user-storage.js';
import { ensureUser } from '../server/db/users.js';
import { listAchievements, unlockAchievement } from '../server/db/achievements.js';
import { FEATURE_USES, recordFeatureUse, sumFeatureUses } from '../server/db/feature-uses.js';
import { listSyncedItems, saveSyncedItems } from '../server/db/synced-items.js';
import { readSyncSettings, isSyncEnabled, saveSyncSettings } from '../server/db/sync-settings.js';
import { SYNC_COLLECTIONS } from '../common/sync-collections.js';

const url = process.env.DATABASE_URL_TEST;
// Rows this file creates carry this prefix; only they are ever deleted.
const ID_PREFIX = `myip-spec-user-storage-db:${randomUUID()}:`;

describe('user storage on Postgres', { skip: url ? false : 'DATABASE_URL_TEST is not set' }, () => {
    const storage = createUserStorage({ env: { DATABASE_URL: url } });
    const created = [];

    after(async () => {
        try {
            if (created.length) {
                const { query } = await storage.getDb();
                // Child rows first: these tables reference users.
                await query('DELETE FROM achievements WHERE user_id = ANY($1::text[])', [created]);
                await query('DELETE FROM feature_uses WHERE user_id = ANY($1::text[])', [created]);
                await query('DELETE FROM synced_items WHERE user_id = ANY($1::text[])', [created]);
                await query('DELETE FROM sync_settings WHERE user_id = ANY($1::text[])', [created]);
                await query('DELETE FROM users WHERE id = ANY($1::text[])', [created]);
            }
        } finally {
            await storage.close();
        }
    });

    it('applies the real migrations; a second run applies nothing', async () => {
        await storage.migrate();
        assert.deepEqual(await storage.migrate(), []);
        assert.equal(await storage.bootCheck(), true);
    });

    it('creates a user once and is idempotent', async () => {
        const { query } = await storage.getDb();
        const id = `${ID_PREFIX}a`;
        created.push(id);
        const first = await ensureUser(query, id);
        const second = await ensureUser(query, id);
        assert.equal(first.id, id);
        assert.ok(first.createdAt instanceof Date);
        assert.equal(second.createdAt.getTime(), first.createdAt.getTime());
        const { rows } = await query('SELECT count(*)::int AS n FROM users WHERE id = $1', [id]);
        assert.equal(rows[0].n, 1);
    });

    it('concurrent calls for one id leave one row', async () => {
        const { query } = await storage.getDb();
        const id = `${ID_PREFIX}b`;
        created.push(id);
        const rows = await Promise.all([ensureUser(query, id), ensureUser(query, id), ensureUser(query, id)]);
        assert.ok(rows.every((row) => row.id === id));
        const { rows: [count] } = await query('SELECT count(*)::int AS n FROM users WHERE id = $1', [id]);
        assert.equal(count.n, 1);
    });

    it('unlocks an achievement once and keeps its first time', async () => {
        const { query } = await storage.getDb();
        const id = `${ID_PREFIX}c`;
        created.push(id);
        await ensureUser(query, id);
        const first = await unlockAchievement(query, id, 'IAmHuman');
        await new Promise((resolve) => setTimeout(resolve, 20));
        const again = await unlockAchievement(query, id, 'IAmHuman');
        assert.ok(first.achievedAt instanceof Date);
        assert.equal(again.achievedAt.getTime(), first.achievedAt.getTime());
        const listed = await listAchievements(query, id);
        assert.deepEqual(listed.map(({ name }) => name), ['IAmHuman']);
        assert.equal(listed[0].achievedAt.getTime(), first.achievedAt.getTime());
    });

    it('counts uses for a user with no row yet and sums them', async () => {
        const { query } = await storage.getDb();
        const id = `${ID_PREFIX}d`;
        created.push(id);
        assert.equal(await sumFeatureUses(query, id), 0);
        await recordFeatureUse(query, id, FEATURE_USES.persona);
        await Promise.all([
            recordFeatureUse(query, id, FEATURE_USES.persona),
            recordFeatureUse(query, id, FEATURE_USES.ipchecking),
            recordFeatureUse(query, id, FEATURE_USES.ipchecking),
        ]);
        assert.equal(await sumFeatureUses(query, id), 4);
        const { rows } = await query('SELECT feature, times FROM feature_uses WHERE user_id = $1 ORDER BY feature', [id]);
        assert.deepEqual(rows, [{ feature: 'ipdb:ipchecking', times: 2 }, { feature: 'tool:persona', times: 2 }]);
        const { rows: [user] } = await query('SELECT count(*)::int AS n FROM users WHERE id = $1', [id]);
        assert.equal(user.n, 1);
    });

    const { preferences, connectivity } = SYNC_COLLECTIONS;
    const NOW = Date.now();
    const pref = (id, updatedAt, value) => ({ id, updatedAt, deleted: false, value });
    const mine = pref('list:mine', 10, { name: null, members: [{ id: 'g', name: 'G', url: 'https://g.example/' }] });
    const userWith = async (suffix, enabled = ['preferences', 'connectivity']) => {
        const db = await storage.getDb();
        const id = `${ID_PREFIX}${suffix}`;
        created.push(id);
        await ensureUser(db.query, id);
        if (enabled) await saveSyncSettings(db.transaction, { userId: id, collections: enabled });
        const save = (items, collection = preferences) => saveSyncedItems(db.transaction, {
            userId: id, collection, version: collection.version, items, now: NOW,
        });
        const list = (opts = {}) => listSyncedItems(db.query, {
            userId: id, collection: (opts.collection ?? preferences).id, version: (opts.collection ?? preferences).version,
            since: opts.since ?? 0, limit: opts.limit ?? 50,
        });
        return { ...db, id, save, list };
    };

    it('round-trips synced items: values, conflicts and the cursor', async () => {
        const { save, list } = await userWith('e');
        const conn = await save([pref('order', 10, ['mine']), mine, pref('defaultListId', 10, 'mine')], connectivity);
        assert.equal(conn.base, 0);
        assert.ok(conn.cursor > 0);
        assert.deepEqual((await list({ collection: connectivity })).items, [pref('order', 10, ['mine']), mine, pref('defaultListId', 10, 'mine')]);

        const first = await save([pref('theme', 100, 'dark'), pref('lang', 100, 'fr')]);
        const second = await save([pref('theme', 200, 'light'), pref('lang', 50, 'de')]);
        assert.equal(second.base, first.cursor);
        assert.ok(second.cursor > second.base);
        assert.deepEqual(second.conflicts, [pref('lang', 100, 'fr')]);
        const page = await list();
        assert.deepEqual(page.items, [pref('lang', 100, 'fr'), pref('theme', 200, 'light')]);
        assert.equal(page.cursor, second.cursor);
    });

    it('stores a tombstone with NULL data (the engine, over a stand-in collection with deletes)', async () => {
        const { id, query, save } = await userWith('t', null);
        const ticks = { ...preferences, id: 'spec-ticks', version: 1, allowDelete: true, isValidItemId: () => true, isValidValue: () => true };
        await query('INSERT INTO sync_settings (user_id, collections) VALUES ($1, $2::text[])', [id, ['spec-ticks']]);
        await save([pref('a', 1, 'x')], ticks);
        await save([{ id: 'a', updatedAt: 2, deleted: true }], ticks);
        const { rows } = await query(
            "SELECT data IS NULL AS no_data, deleted FROM synced_items WHERE user_id = $1 AND collection = 'spec-ticks' AND item_id = 'a'", [id]);
        assert.deepEqual(rows, [{ no_data: true, deleted: true }]);
    });

    it('two concurrent writes by one user keep both items, in strictly increasing seq', async () => {
        const { id, query, save } = await userWith('f');
        const results = await Promise.all([save([pref('theme', 1, 'dark')]), save([pref('lang', 1, 'fr')])]);
        const [early, late] = [...results].sort((a, b) => a.base - b.base);
        assert.equal(early.base, 0);
        assert.equal(late.base, early.cursor);
        assert.ok(late.cursor > early.cursor);
        const { rows } = await query('SELECT item_id, seq FROM synced_items WHERE user_id = $1 ORDER BY seq', [id]);
        assert.deepEqual(rows.map((row) => row.item_id).sort(), ['lang', 'theme']);
        assert.ok(Number(rows[1].seq) > Number(rows[0].seq));
    });

    it('pages by seq with `more`, and keeps versions apart', async () => {
        const { save, list } = await userWith('g');
        const keys = ['theme', 'lang', 'simpleMode', 'autoRunWebRTC', 'autoRunDnsLeak'];
        const values = { theme: 'dark', lang: 'fr' };
        const saved = await save(keys.map((key, i) => pref(key, i + 1, values[key] ?? true)));
        const page1 = await list({ limit: 2 });
        assert.equal(page1.more, true);
        assert.deepEqual(page1.items.map(({ id }) => id), ['theme', 'lang']);
        const page2 = await list({ limit: 2, since: page1.cursor });
        const page3 = await list({ limit: 2, since: page2.cursor });
        assert.deepEqual(page2.items.map(({ id }) => id), ['simpleMode', 'autoRunWebRTC']);
        assert.deepEqual(page3.items.map(({ id }) => id), ['autoRunDnsLeak']);
        assert.equal(page3.more, false);
        assert.equal(page3.cursor, saved.cursor);

        const next = { ...preferences, version: preferences.version + 1 };
        const other = await save([pref('theme', 99, 'light')], next);
        assert.equal(other.base, 0);
        assert.deepEqual((await list({ collection: next })).items, [pref('theme', 99, 'light')]);
        assert.deepEqual((await list()).items[0], pref('theme', 1, 'dark'));
    });

    it('sync settings: undecided, decided, and a write to a collection not enabled stores nothing', async () => {
        const { id, query, transaction, save } = await userWith('h', null);
        assert.deepEqual(await readSyncSettings(query, id), { decided: false, collections: [] });
        assert.equal(await save([pref('theme', 1, 'dark')]), null);
        assert.deepEqual(await saveSyncSettings(transaction, { userId: id, collections: ['connectivity'] }), { decided: true, collections: ['connectivity'] });
        assert.deepEqual(await readSyncSettings(query, id), { decided: true, collections: ['connectivity'] });
        assert.equal(await isSyncEnabled(query, id, 'connectivity'), true);
        assert.equal(await isSyncEnabled(query, id, 'preferences'), false);
        assert.equal(await save([pref('theme', 1, 'dark')]), null);
        const { rows: [count] } = await query('SELECT count(*)::int AS n FROM synced_items WHERE user_id = $1', [id]);
        assert.equal(count.n, 0);
    });

    it('sync settings: turning a collection off deletes its rows in every version; others and other users stay', async (t) => {
        const mine = await userWith('i');
        const theirs = await userWith('j');
        for (const user of [mine, theirs]) {
            await user.save([pref('theme', 1, 'dark')]);
            await user.save([pref('theme', 1, 'dark')], { ...preferences, version: preferences.version - 1 });
            await user.save([mine], connectivity);
        }
        const count = async (user) => (await mine.query(
            'SELECT collection, count(*)::int AS n FROM synced_items WHERE user_id = $1 GROUP BY collection ORDER BY collection', [user.id])).rows;
        await saveSyncSettings(mine.transaction, { userId: mine.id, collections: ['connectivity'] });
        assert.deepEqual(await count(mine), [{ collection: 'connectivity', n: 1 }]);
        await saveSyncSettings(mine.transaction, { userId: mine.id, collections: [] });
        assert.deepEqual(await count(mine), []);
        assert.deepEqual(await count(theirs), [{ collection: 'connectivity', n: 1 }, { collection: 'preferences', n: 2 }]);
        const { rows } = await mine.query(
            'EXPLAIN DELETE FROM synced_items WHERE user_id = $1 AND collection <> ALL($2::text[])', [mine.id, ['connectivity']]);
        t.diagnostic(rows.map((row) => row['QUERY PLAN']).join(' | '));
    });
});
