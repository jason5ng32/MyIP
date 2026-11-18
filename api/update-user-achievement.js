import logger from '../server/logger.js';
import { isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

export default async (req, res) => {
    // defensive; app.put() in backend-server.js already gates method
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const achievement = req.body;
    if (!achievement) {
        return res.status(400).json({ error: 'Achievement name is required' });
    }

    try {
        const apiResponse = await requestIpCheckingApi('/updateuserachievements', {
            method: 'PUT',
            body: req.body,
            forwardFrom: req,
        });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'update-user-achievement upstream request failed');
        res.status(500).json({ error: error.message });
    }

}