// GET /api/sync (which collections the signed-in user syncs; all of them until the user turns one off) and PUT /api/sync (set them, deleting the items of every collection left out), from user storage.
import logger from '../server/logger.js';
import { userStorage } from '../server/db/user-storage.js';
import { ensureUser } from '../server/db/users.js';
import { readSyncSettings, saveSyncSettings } from '../server/db/sync-settings.js';
import { SYNC_COLLECTION_IDS } from '../common/sync-collections.js';

// A PUT body → `{ collections }`, or `{ error }` unless `collections` is an array of distinct registry ids.
export const parseSyncSettings = (body) => {
    const collections = body?.collections;
    if (!Array.isArray(collections)) return { error: 'Invalid collections' };
    if (!collections.every((id) => typeof id === 'string' && SYNC_COLLECTION_IDS.includes(id))) {
        return { error: 'Unknown collection' };
    }
    if (new Set(collections).size !== collections.length) return { error: 'Duplicate collection' };
    return { collections };
};

// Both handlers over one storage; requireUser() and requireUserStorage() run first.
export const createSyncSettingsHandlers = (storage = userStorage) => {
    const read = async (req, res) => {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const { userId } = res.locals;
        try {
            const { query } = await storage.getDb();
            await ensureUser(query, userId);
            res.json(await readSyncSettings(query, userId));
        } catch (err) {
            logger.error({ err }, 'sync settings read failed');
            res.status(500).json({ error: 'Sync settings unavailable' });
        }
    };

    const write = async (req, res) => {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
        const parsed = parseSyncSettings(req.body);
        if (parsed.error) return res.status(400).json({ error: parsed.error });
        const { userId } = res.locals;
        try {
            const { query, transaction } = await storage.getDb();
            await ensureUser(query, userId);
            res.json(await saveSyncSettings(transaction, { userId, collections: parsed.collections }));
        } catch (err) {
            logger.error({ err }, 'sync settings save failed');
            res.status(500).json({ error: 'Sync settings not saved' });
        }
    };

    return { read, write };
};

const handlers = createSyncSettingsHandlers();

export default handlers.read;
export const writeSyncSettings = handlers.write;
