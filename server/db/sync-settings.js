// Account sync settings repository: which collections a user syncs (no row = all of them), and the delete of every
// other collection's items.
import { SYNC_COLLECTION_IDS } from '../../common/sync-collections.js';

// Stored ids → the ones the registry still has, in registry order.
const known = (ids) => SYNC_COLLECTION_IDS.filter((id) => ids.includes(id));

// The stored collections, or null when the user has no row.
const storedCollections = async (query, userId) => {
    const { rows: [row] } = await query('SELECT collections FROM sync_settings WHERE user_id = $1', [userId]);
    return row ? row.collections ?? [] : null;
};

// `{ collections }`: the stored ones, or every registry collection when the user has no row.
export const readSyncSettings = async (query, userId) => {
    const stored = await storedCollections(query, userId);
    return { collections: stored ? known(stored) : [...SYNC_COLLECTION_IDS] };
};

// Whether `collectionId` syncs for the user: a row that lists it, or no row and a registry collection.
export const isSyncEnabled = async (query, userId, collectionId) => (
    await storedCollections(query, userId) ?? SYNC_COLLECTION_IDS).includes(collectionId);

/**
 * Stores the enabled collections and deletes the user's synced items of every
 * other collection (all versions, tombstones too) in one transaction, under
 * the same users row lock item writes take. The users row must exist.
 */
export const saveSyncSettings = (transaction, { userId, collections }) => transaction(async (query) => {
    const { rows: [user] } = await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user) throw new Error('Sync settings need an existing user');
    const enabled = known(collections);
    await query(`INSERT INTO sync_settings (user_id, collections) VALUES ($1, $2::text[])
        ON CONFLICT (user_id) DO UPDATE SET collections = EXCLUDED.collections, updated_at = now()`, [userId, enabled]);
    // Bounded by the primary key's (user_id, collection) prefix: one user's rows are contiguous and few.
    await query('DELETE FROM synced_items WHERE user_id = $1 AND collection <> ALL($2::text[])', [userId, enabled]);
    return { collections: enabled };
});
