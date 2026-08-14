import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

export default async (req, res) => {
    // Presence, validity and public routability guaranteed by the
    // requirePublicIP middleware — a reserved address never reaches here.
    const ipAddress = req.query.ip;

    const key = process.env.IPCHECKING_API_KEY;

    if (!key) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    // Build request
    const lang = req.query.lang || 'en';
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/ipinfo?key=${key}&ip=${ipAddress}&lang=${lang}`);

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
        logger.error({ err: error, ip: ipAddress, lang }, 'ipcheck-ing handler failed');
        res.status(500).json({ error: error.message });
    }
}