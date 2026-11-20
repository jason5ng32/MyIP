import logger from '../server/logger.js';
import { isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

export default async (req, res) => {
    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    try {
        const apiResponse = await requestIpCheckingApi('/userinfo', { forwardFrom: req, endUserId: res.locals.userId });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'get-user-info upstream request failed');
        res.status(500).json({ error: error.message });
    }
}