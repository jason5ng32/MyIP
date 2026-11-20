// Lifetime feature use counts (achievements only, never a quota): the counted features and their repository.

// `<kind>:<name>` ids, one per counted route: `ipdb:` an IP source, `tool:` a tool.
export const FEATURE_USES = Object.freeze({
    ipchecking: 'ipdb:ipchecking',
    invisibility: 'tool:invisibility',
    dnsleaktest: 'tool:dnsleaktest',
    persona: 'tool:persona',
    ipblocklist: 'tool:ipblocklist',
});

const KNOWN_FEATURES = new Set(Object.values(FEATURE_USES));

export const isCountedFeature = (feature) => KNOWN_FEATURES.has(feature);

// Adds one use, creating the users row and the counter row when absent, in one statement.
export const recordFeatureUse = async (query, userId, feature) => {
    if (!isCountedFeature(feature)) throw new TypeError(`Unknown feature: ${feature}`);
    await query(`WITH new_user AS (INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING)
        INSERT INTO feature_uses (user_id, feature, times) VALUES ($1, $2, 1)
        ON CONFLICT (user_id, feature) DO UPDATE SET times = feature_uses.times + 1`, [userId, feature]);
};

// The user's uses over every feature.
export const sumFeatureUses = async (query, userId) => {
    const { rows: [row] } = await query('SELECT COALESCE(SUM(times), 0)::bigint AS total FROM feature_uses WHERE user_id = $1', [userId]);
    return Number(row?.total ?? 0);
};
