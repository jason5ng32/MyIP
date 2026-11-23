// GET /api/usage: the signed-in user's level and quota from the IPCheck.ing API, relayed as `{ userLevel, quota }`.
import logger from '../server/logger.js';
import { isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

export default async (req, res) => {
    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    try {
        const apiResponse = await requestIpCheckingApi('/usage', { forwardFrom: req, endUserId: res.locals.userId });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        const { userLevel, quota } = await apiResponse.json();
        res.json({ userLevel, quota });
    } catch (error) {
        logger.error({ err: error }, 'usage upstream request failed');
        res.status(500).json({ error: error.message });
    }
}
