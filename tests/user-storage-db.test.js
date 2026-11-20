// Optional spec against a real Postgres at DATABASE_URL_TEST; skipped when it is unset.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, describe, it } from 'node:test';

import { createUserStorage } from '../server/db/user-storage.js';
import { ensureUser } from '../server/db/users.js';
import { listAchievements, unlockAchievement } from '../server/db/achievements.js';
import { FEATURE_USES, recordFeatureUse, sumFeatureUses } from '../server/db/feature-uses.js';

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
                // Child rows first: both tables reference users.
                await query('DELETE FROM achievements WHERE user_id = ANY($1::text[])', [created]);
                await query('DELETE FROM feature_uses WHERE user_id = ANY($1::text[])', [created]);
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
});
