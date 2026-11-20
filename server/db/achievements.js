// Achievements repository over a `query(text, params)` function passed in by the caller; the users row must exist.

// The user's unlocked achievements as `[{ name, achievedAt }]`.
export const listAchievements = async (query, userId) => {
    const { rows } = await query('SELECT name, achieved_at FROM achievements WHERE user_id = $1 ORDER BY achieved_at, name', [userId]);
    return rows.map((row) => ({ name: row.name, achievedAt: row.achieved_at }));
};

// Unlocks once (a repeat keeps the first time); returns `{ name, achievedAt }`.
export const unlockAchievement = async (query, userId, name) => {
    await query('INSERT INTO achievements (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING', [userId, name]);
    const { rows: [row] } = await query('SELECT achieved_at FROM achievements WHERE user_id = $1 AND name = $2', [userId, name]);
    return row ? { name, achievedAt: row.achieved_at } : null;
};
