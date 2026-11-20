// Middleware counting one use of a feature for a signed-in caller once the route has answered below 400, without touching the response.
import logger from './logger.js';
import { userStorage } from './db/user-storage.js';
import { isCountedFeature, recordFeatureUse } from './db/feature-uses.js';

// `storage` and `record` are the seams specs replace.
export const countFeatureUse = (feature, { storage = userStorage, record = recordFeatureUse } = {}) => {
    if (!isCountedFeature(feature)) throw new TypeError(`Unknown feature: ${feature}`);

    // Fire-and-forget: a failure is logged, never thrown.
    const count = async (userId) => {
        try {
            const { query } = await storage.getDb();
            await record(query, userId, feature);
        } catch (err) {
            logger.warn({ err, feature }, 'Feature use not counted');
        }
    };

    return (req, res, next) => {
        res.on('finish', () => {
            const userId = res.locals?.userId;
            if (!userId || res.statusCode >= 400) return;
            if (!storage.isConfigured() || !storage.isReady()) return;
            count(userId);
        });
        next();
    };
};
