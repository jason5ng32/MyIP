import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

export default async (req, res) => {
    const key = process.env.IPCHECKING_API_KEY;

    if (!key) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    // Build request
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/userinfo?key=${key}`);

    try {
        const apiResponse = await fetchUpstream(url, {
            headers: {
                ...req.headers,
            }
        });

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