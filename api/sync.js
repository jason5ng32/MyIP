// GET /api/sync/:collection (a page of the signed-in user's synced items changed after a cursor) and PUT /api/sync/:collection (merge a device's items in), from user storage; 409 for a collection the account turned off.
import logger from '../server/logger.js';
import { userStorage } from '../server/db/user-storage.js';
import { ensureUser } from '../server/db/users.js';
import { listSyncedItems, saveSyncedItems } from '../server/db/synced-items.js';
import { isSyncEnabled } from '../server/db/sync-settings.js';
import { SYNC_MAX_ITEMS_PER_REQUEST, SYNC_OFF_CODE } from '../common/sync-collections.js';

const POSITIVE_INT = /^[1-9]\d{0,9}$/;
const NON_NEGATIVE_INT = /^(0|[1-9]\d{0,15})$/;
const INT4_MAX = 2_147_483_647;

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isEditTime = (value) => Number.isSafeInteger(value) && value > 0;

const syncOff = (res) => res.status(409).json({ error: 'Sync is off for this collection', code: SYNC_OFF_CODE });

// `?v=` and `?since=` → `{ version, since }`, or `{ error }`.
export const parseSyncRead = (query) => {
    const { v, since = '0' } = query ?? {};
    if (typeof v !== 'string' || !POSITIVE_INT.test(v) || Number(v) > INT4_MAX) return { error: 'Invalid version' };
    if (typeof since !== 'string' || !NON_NEGATIVE_INT.test(since) || !Number.isSafeInteger(Number(since))) {
        return { error: 'Invalid cursor' };
    }
    return { version: Number(v), since: Number(since) };
};

// A PUT body → `{ items }` (`{ id, updatedAt, deleted, value? }`), or `{ error }` when its shape is off; values are checked later, per item.
export const parseSyncWrite = (body, collection) => {
    if (!isPlainObject(body)) return { error: 'Invalid body' };
    if (body.version !== collection.version) return { error: 'Unsupported version' };
    if (!Array.isArray(body.items)) return { error: 'Invalid items' };
    if (body.items.length > SYNC_MAX_ITEMS_PER_REQUEST) return { error: 'Too many items' };
    const seen = new Set();
    const items = [];
    for (const item of body.items) {
        if (!isPlainObject(item) || !collection.isValidItemId(item.id) || !isEditTime(item.updatedAt)
            || (item.deleted !== undefined && typeof item.deleted !== 'boolean')) {
            return { error: 'Invalid item' };
        }
        if (seen.has(item.id)) return { error: 'Duplicate item' };
        seen.add(item.id);
        items.push(item.deleted
            ? { id: item.id, updatedAt: item.updatedAt, deleted: true }
            : { id: item.id, updatedAt: item.updatedAt, deleted: false, value: item.value });
    }
    return { items };
};

// Both handlers over one storage; requireValidSyncCollection(), requireUser() and requireUserStorage() run first. `now` is the specs' seam.
export const createSyncHandlers = (storage = userStorage, { now = Date.now } = {}) => {
    const read = async (req, res) => {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const parsed = parseSyncRead(req.query);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        const { userId, syncCollection: collection } = res.locals;
        try {
            const { query } = await storage.getDb();
            await ensureUser(query, userId);
            if (!await isSyncEnabled(query, userId, collection.id)) return syncOff(res);
            res.json(await listSyncedItems(query, {
                userId, collection: collection.id, version: parsed.version, since: parsed.since, limit: collection.pageSize,
            }));
        } catch (err) {
            logger.error({ err, collection: collection.id }, 'synced items read failed');
            res.status(500).json({ error: 'Sync unavailable' });
        }
    };

    const write = async (req, res) => {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
        const { userId, syncCollection: collection } = res.locals;
        const parsed = parseSyncWrite(req.body, collection);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        try {
            const { query, transaction } = await storage.getDb();
            await ensureUser(query, userId);
            const saved = await saveSyncedItems(transaction, {
                userId, collection, version: collection.version, items: parsed.items, now: now(),
            });
            if (!saved) return syncOff(res);
            res.json(saved);
        } catch (err) {
            logger.error({ err, collection: collection.id }, 'synced items save failed');
            res.status(500).json({ error: 'Sync not saved' });
        }
    };

    return { read, write };
};

const handlers = createSyncHandlers();

export default handlers.read;
export const writeSyncedItems = handlers.write;
