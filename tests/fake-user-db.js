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
};

// `{ query, users, achievements, uses, calls }`; `now()` stamps new rows,
// and a foreign key to users is enforced like Postgres would.
export const fakeUserDb = ({ now = () => new Date() } = {}) => {
    const users = new Map();
    const achievements = new Map(); // `${user}\u0000${name}` → { user, name, at }
    const uses = new Map(); // `${user}\u0000${feature}` → times
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
            default:
                throw new Error(`unexpected SQL: ${sql}`);
        }
    };

    return { query, users, achievements, uses, calls };
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
