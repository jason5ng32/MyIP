// Synced items: the pure merge plan of one write and the repository over the caller's `query` / `transaction`.
import { SYNC_TOMBSTONE_TTL_MS, syncValueBytes } from '../../common/sync-collections.js';
import { isSyncEnabled } from './sync-settings.js';

// Why an item of an otherwise valid write was not stored.
export const SYNC_REFUSAL = Object.freeze({
    INVALID: 'invalid',
    TOO_LARGE: 'too_large',
    NO_DELETE: 'no_delete',
    FULL: 'full',
});

// The stored row (or null) against an incoming edit time: 'insert', 'keep' (stored as new or newer) or 'replace'.
export const mergeDecision = (stored, updatedAt) => {
    if (!stored) return 'insert';
    return stored.updatedAt >= updatedAt ? 'keep' : 'replace';
};

/**
 * One write's shape-checked items (`{ id, updatedAt, deleted, value? }`, ids
 * unique) against the stored items of that collection and version (`stored`:
 * id → item) and their live count → `{ writes, conflicts, refused }`, in
 * request order. Edit times are clamped to `now`; a kept stored item is
 * returned as a conflict; a new live item past `maxItems`, or a new row past
 * `maxRows` (`rowCount`: live items and tombstones), is refused. The
 * request's deletes free their room first, wherever they sit in it; a delete
 * of an id that has no row writes nothing.
 */
export const planSyncWrite = ({ collection, items, stored, liveCount, rowCount = liveCount, now }) => {
    const writes = [];
    const conflicts = [];
    const refused = [];
    const maxRows = collection.maxRows ?? Infinity;
    const replaces = (id, sent) => mergeDecision(stored.get(id) ?? null, Math.min(sent, now)) !== 'keep';
    const freed = collection.allowDelete
        ? items.filter(({ id, updatedAt, deleted }) => deleted && stored.get(id)?.deleted === false && replaces(id, updatedAt)).length
        : 0;
    let live = liveCount - freed;
    let rows = rowCount;
    for (const { id, updatedAt: sent, deleted, value } of items) {
        if (deleted && !collection.allowDelete) {
            refused.push({ id, reason: SYNC_REFUSAL.NO_DELETE });
            continue;
        }
        if (!deleted && syncValueBytes(value) > collection.maxItemBytes) {
            refused.push({ id, reason: SYNC_REFUSAL.TOO_LARGE });
            continue;
        }
        if (!deleted && !collection.isValidValue(id, value)) {
            refused.push({ id, reason: SYNC_REFUSAL.INVALID });
            continue;
        }
        const updatedAt = Math.min(sent, now);
        const current = stored.get(id) ?? null;
        if (deleted && !current) continue;
        if (mergeDecision(current, updatedAt) === 'keep') {
            conflicts.push(current);
            continue;
        }
        const wasLive = Boolean(current && !current.deleted);
        if (!deleted && !wasLive && (live >= collection.maxItems || (!current && rows >= maxRows))) {
            refused.push({ id, reason: SYNC_REFUSAL.FULL });
            continue;
        }
        if (!deleted && !wasLive) live += 1;
        if (!current) rows += 1;
        writes.push(deleted ? { id, updatedAt, deleted: true } : { id, updatedAt, deleted: false, value });
    }
    return { writes, conflicts, refused };
};

// A row → `{ id, updatedAt, deleted, value? }`; a tombstone carries no value.
const toItem = (row) => (row.deleted
    ? { id: row.item_id, updatedAt: Number(row.updated_at), deleted: true }
    : { id: row.item_id, updatedAt: Number(row.updated_at), deleted: false, value: row.data });

// One page of the user's items in a collection and version changed after `since`, in `seq` order.
export const listSyncedItems = async (query, { userId, collection, version, since, limit }) => {
    const { rows } = await query(`SELECT item_id, updated_at, deleted, data, seq FROM synced_items
        WHERE user_id = $1 AND collection = $2 AND schema_version = $3 AND seq > $4
        ORDER BY seq LIMIT $5`, [userId, collection, version, since, limit + 1]);
    const page = rows.slice(0, limit);
    return {
        cursor: page.length ? Number(page.at(-1).seq) : since,
        more: rows.length > limit,
        items: page.map(toItem),
    };
};

/**
 * Merges a write into one collection and version under the user's row lock
 * (so that user's `seq` values commit in order and a racing settings change
 * waits), after removing the user's expired tombstones of that collection.
 * The users row must exist. Resolves with null when the user has not enabled
 * the collection (nothing written), else `{ base, cursor, conflicts, refused }`:
 * the highest `seq` before and after the write.
 */
export const saveSyncedItems = (transaction, { userId, collection, version, items, now }) => transaction(async (query) => {
    const { rows: [user] } = await query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user) throw new Error('Synced items need an existing user');
    if (!await isSyncEnabled(query, userId, collection.id)) return null;
    await query(`DELETE FROM synced_items
        WHERE user_id = $1 AND collection = $2 AND deleted AND updated_at < $3`,
    [userId, collection.id, now - SYNC_TOMBSTONE_TTL_MS]);
    const { rows: [state] } = await query(`SELECT COALESCE(MAX(seq), 0) AS base, COUNT(*) FILTER (WHERE NOT deleted) AS live, COUNT(*) AS total
        FROM synced_items WHERE user_id = $1 AND collection = $2 AND schema_version = $3`,
    [userId, collection.id, version]);
    const { rows: storedRows } = items.length
        ? await query(`SELECT item_id, updated_at, deleted, data, seq FROM synced_items
            WHERE user_id = $1 AND collection = $2 AND schema_version = $3 AND item_id = ANY($4::text[])`,
        [userId, collection.id, version, items.map(({ id }) => id)])
        : { rows: [] };

    const stored = new Map(storedRows.map((row) => [row.item_id, toItem(row)]));
    const plan = planSyncWrite({
        collection, items, stored, liveCount: Number(state.live), rowCount: Number(state.total), now,
    });
    const base = Number(state.base);
    let cursor = base;
    if (plan.writes.length) {
        // One statement for the whole write: the items ride one jsonb parameter, each row taking a new `seq`.
        const { rows: written } = await query(`INSERT INTO synced_items
            (user_id, collection, schema_version, item_id, updated_at, deleted, data, seq)
            SELECT $1, $2, $3, w.id, w.updated_at, w.deleted, w.value, nextval('synced_items_seq')
            FROM ROWS FROM (jsonb_to_recordset($4::jsonb) AS (id text, updated_at bigint, deleted boolean, value jsonb))
                WITH ORDINALITY AS w(id, updated_at, deleted, value, n)
            ORDER BY w.n
            ON CONFLICT (user_id, collection, schema_version, item_id) DO UPDATE
            SET updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, data = EXCLUDED.data, seq = EXCLUDED.seq
            RETURNING seq`,
        [userId, collection.id, version, JSON.stringify(plan.writes.map(({ id, updatedAt, deleted, value }) => ({
            id, updated_at: updatedAt, deleted, value,
        })))]);
        cursor = written.reduce((max, row) => Math.max(max, Number(row.seq)), base);
    }
    return { base, cursor, conflicts: plan.conflicts, refused: plan.refused };
});
