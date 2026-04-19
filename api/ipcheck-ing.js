import { fetchUpstream } from '../common/fetch-with-timeout.js';

export default async (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
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
        console.error("Error during API request:", error);
        res.status(500).json({ error: error.message });
    }
}