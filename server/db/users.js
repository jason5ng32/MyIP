// Users repository over a `query(text, params)` function passed in by the caller.

// Insert-if-absent (ON CONFLICT DO NOTHING, race-free); returns the row, existing or new.
export const ensureUser = async (query, id) => {
    if (typeof id !== 'string' || !id) throw new TypeError('ensureUser needs a non-empty id');
    await query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);
    const { rows: [row] } = await query('SELECT id, created_at FROM users WHERE id = $1', [id]);
    return row ? { id: row.id, createdAt: row.created_at } : null;
};
