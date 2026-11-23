// GET /api/achievements (the signed-in user's unlocked achievements and total feature uses) and PUT /api/achievements (unlock one), from user storage.
import logger from '../server/logger.js';
import { userStorage } from '../server/db/user-storage.js';
import { ensureUser } from '../server/db/users.js';
import { listAchievements, unlockAchievement as unlockStoredAchievement } from '../server/db/achievements.js';
import { sumFeatureUses } from '../server/db/feature-uses.js';
import { ACHIEVEMENT_NAMES } from '../common/codes/achievements.js';

const KNOWN_NAMES = new Set(ACHIEVEMENT_NAMES);

// Both handlers over one storage; requireUser() and requireUserStorage() run first.
export const createAchievementHandlers = (storage = userStorage) => {
    const list = async (req, res) => {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
        const userId = res.locals.userId;
        try {
            const { query } = await storage.getDb();
            await ensureUser(query, userId);
            const [rows, totalUses] = await Promise.all([listAchievements(query, userId), sumFeatureUses(query, userId)]);
            const achievements = Object.fromEntries(rows.map(({ name, achievedAt }) => [
                name, { achieved: true, achievedTime: achievedAt.getTime() },
            ]));
            res.json({ achievements, totalUses });
        } catch (err) {
            logger.error({ err }, 'achievements read failed');
            res.status(500).json({ error: 'Achievements unavailable' });
        }
    };

    const unlock = async (req, res) => {
        if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
        const name = req.body?.name;
        if (typeof name !== 'string' || !KNOWN_NAMES.has(name)) {
            return res.status(400).json({ error: 'Unknown achievement' });
        }
        const userId = res.locals.userId;
        try {
            const { query } = await storage.getDb();
            await ensureUser(query, userId);
            const row = await unlockStoredAchievement(query, userId, name);
            if (!row) throw new Error('Unlocked achievement not found');
            res.json({ name, achievedTime: row.achievedAt.getTime() });
        } catch (err) {
            logger.error({ err }, 'achievement unlock failed');
            res.status(500).json({ error: 'Achievement not saved' });
        }
    };

    return { list, unlock };
};

const handlers = createAchievementHandlers();

export default handlers.list;
export const unlockAchievement = handlers.unlock;
