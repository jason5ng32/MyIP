// In-memory stand-in for the user storage tables, answering exactly the repositories' SQL (server/db/), for specs.

const normalize = (text) => text.replace(/\s+/g, ' ').trim();

const SQL = {
    insertUser: 'INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
    selectUser: 'SELECT id, created_at FROM users WHERE id = $1',
    listAchievements: 'SELECT name, achieved_at FROM achievements WHERE user_id = $1 ORDER BY achieved_at, name',
    insertAchievement: 'INSERT INTO achievements (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
    selectAchievement: 'SELECT achieved_at FROM achievements WHERE user_id = $1 AND name = $2',
    recordUse: 'WITH new_user AS (INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING) '
        + 'INSERT INTO feature_uses (user_id, feature, times) VALUES ($1, $2, 1) '
        + 'ON CONFLICT (user_id, feature) DO UPDATE SET times = feature_uses.times + 1',
    sumUses: 'SELECT COALESCE(SUM(times), 0)::bigint AS total FROM feature_uses WHERE user_id = $1',
    lockUser: 'SELECT id FROM users WHERE id = $1 FOR UPDATE',
    listSynced: 'SELECT item_id, updated_at, deleted, data, seq FROM synced_items '
        + 'WHERE user_id = $1 AND collection = $2 AND schema_version = $3 AND seq > $4 ORDER BY seq LIMIT $5',
    pruneTombstones: 'DELETE FROM synced_items WHERE user_id = $1 AND collection = $2 AND deleted AND updated_at < $3',
    syncState: 'SELECT COALESCE(MAX(seq), 0) AS base, COUNT(*) FILTER (WHERE NOT deleted) AS live '
        + 'FROM synced_items WHERE user_id = $1 AND collection = $2 AND schema_version = $3',
    selectSynced: 'SELECT item_id, updated_at, deleted, data, seq FROM synced_items '
        + 'WHERE user_id = $1 AND collection = $2 AND schema_version = $3 AND item_id = ANY($4::text[])',
    upsertSynced: 'INSERT INTO synced_items (user_id, collection, schema_version, item_id, updated_at, deleted, data, seq) '
        + "SELECT $1, $2, $3, w.id, w.updated_at, w.deleted, w.value, nextval('synced_items_seq') "
        + 'FROM ROWS FROM (jsonb_to_recordset($4::jsonb) AS (id text, updated_at bigint, deleted boolean, value jsonb)) '
        + 'WITH ORDINALITY AS w(id, updated_at, deleted, value, n) ORDER BY w.n '
        + 'ON CONFLICT (user_id, collection, schema_version, item_id) DO UPDATE '
        + 'SET updated_at = EXCLUDED.updated_at, deleted = EXCLUDED.deleted, data = EXCLUDED.data, seq = EXCLUDED.seq '
        + 'RETURNING seq',
    readSettings: 'SELECT collections FROM sync_settings WHERE user_id = $1',
    syncEnabled: 'SELECT 1 AS enabled FROM sync_settings WHERE user_id = $1 AND $2 = ANY(collections)',
    upsertSettings: 'INSERT INTO sync_settings (user_id, collections) VALUES ($1, $2::text[]) '
        + 'ON CONFLICT (user_id) DO UPDATE SET collections = EXCLUDED.collections, updated_at = now()',
    deleteDisabled: 'DELETE FROM synced_items WHERE user_id = $1 AND collection <> ALL($2::text[])',
};

// `{ query, users, achievements, uses, syncedItems, syncSettings, calls }`; `now()` stamps new rows,
// a foreign key to users is enforced like Postgres would, and bigint columns come back as text.
export const fakeUserDb = ({ now = () => new Date() } = {}) => {
    const users = new Map();
    const achievements = new Map(); // `${user}\u0000${name}` → { user, name, at }
    const uses = new Map(); // `${user}\u0000${feature}` → times
    // `${user}\u0000${collection}\u0000${version}\u0000${item}` → a synced_items row (data parsed, as jsonb arrives)
    const syncedItems = new Map();
    const syncSettings = new Map(); // user → { collections, updated_at }
    let seq = 0;
    const syncedOf = (user, collection, version) => [...syncedItems.values()]
        .filter((row) => row.user_id === user && row.collection === collection && row.schema_version === version);
    const asRead = (row) => ({ ...structuredClone(row), updated_at: String(row.updated_at), seq: String(row.seq) });
    const calls = [];
    const needUser = (id) => {
        if (!users.has(id)) throw Object.assign(new Error('violates foreign key constraint'), { severity: 'ERROR', code: '23503' });
    };

    const query = async (text, params = []) => {
        const sql = normalize(text);
        calls.push({ text: sql, params });
        const [id, value] = params;
        switch (sql) {
            case SQL.insertUser:
                if (!users.has(id)) users.set(id, { id, created_at: now() });
                return { rows: [] };
            case SQL.selectUser:
                return { rows: users.has(id) ? [users.get(id)] : [] };
            case SQL.listAchievements:
                return {
                    rows: [...achievements.values()].filter((row) => row.user === id)
                        .sort((a, b) => a.at - b.at || a.name.localeCompare(b.name))
                        .map((row) => ({ name: row.name, achieved_at: row.at })),
                };
            case SQL.insertAchievement: {
                needUser(id);
                const key = `${id}\u0000${value}`;
                if (!achievements.has(key)) achievements.set(key, { user: id, name: value, at: now() });
                return { rows: [] };
            }
            case SQL.selectAchievement: {
                const row = achievements.get(`${id}\u0000${value}`);
                return { rows: row ? [{ achieved_at: row.at }] : [] };
            }
            case SQL.recordUse: {
                if (!users.has(id)) users.set(id, { id, created_at: now() });
                const key = `${id}\u0000${value}`;
                uses.set(key, (uses.get(key) ?? 0) + 1);
                return { rows: [] };
            }
            case SQL.sumUses: {
                const total = [...uses.entries()].filter(([key]) => key.startsWith(`${id}\u0000`))
                    .reduce((sum, [, times]) => sum + times, 0);
                return { rows: [{ total: String(total) }] }; // bigint arrives as text
            }
            case SQL.lockUser:
                return { rows: users.has(id) ? [{ id }] : [] };
            case SQL.listSynced: {
                const [, collection, version, since, limit] = params;
                return {
                    rows: syncedOf(id, collection, version).filter((row) => row.seq > Number(since))
                        .sort((a, b) => a.seq - b.seq).slice(0, limit).map(asRead),
                };
            }
            case SQL.pruneTombstones:
                for (const [key, row] of syncedItems) {
                    if (row.user_id === id && row.collection === value && row.deleted && row.updated_at < params[2]) syncedItems.delete(key);
                }
                return { rows: [] };
            case SQL.syncState: {
                const rows = syncedOf(id, value, params[2]);
                const base = rows.reduce((max, row) => Math.max(max, row.seq), 0);
                return { rows: [{ base: String(base), live: String(rows.filter((row) => !row.deleted).length) }] };
            }
            case SQL.selectSynced: {
                const wanted = new Set(params[3]);
                return { rows: syncedOf(id, value, params[2]).filter((row) => wanted.has(row.item_id)).map(asRead) };
            }
            case SQL.upsertSynced: {
                needUser(id);
                const [, collection, version, json] = params;
                const written = JSON.parse(json).map((item) => {
                    seq += 1;
                    syncedItems.set([id, collection, version, item.id].join('\u0000'), {
                        user_id: id, collection, schema_version: version, item_id: item.id,
                        updated_at: item.updated_at, deleted: item.deleted, data: item.value ?? null, seq,
                    });
                    return { seq: String(seq) };
                });
                return { rows: written };
            }
            case SQL.readSettings:
                return { rows: syncSettings.has(id) ? [{ collections: [...syncSettings.get(id).collections] }] : [] };
            case SQL.syncEnabled:
                return { rows: syncSettings.get(id)?.collections.includes(value) ? [{ enabled: 1 }] : [] };
            case SQL.upsertSettings:
                needUser(id);
                syncSettings.set(id, { collections: [...value], updated_at: now() });
                return { rows: [] };
            case SQL.deleteDisabled:
                for (const [key, row] of syncedItems) {
                    if (row.user_id === id && !value.includes(row.collection)) syncedItems.delete(key);
                }
                return { rows: [] };
            default:
                throw new Error(`unexpected SQL: ${sql}`);
        }
    };

    return { query, users, achievements, uses, syncedItems, syncSettings, calls };
};

// A ready user storage over `db`, the shape requireUserStorage() and the handlers use.
export const fakeStorage = (db, { configured = true, ready = true } = {}) => ({
    isConfigured: () => configured,
    isReady: () => configured && ready,
    ensureReady: async () => configured && ready,
    getDb: async () => {
        if (!configured) throw new Error('User storage is not configured');
        return { query: db.query, transaction: (fn) => fn(db.query) };
    },
});
