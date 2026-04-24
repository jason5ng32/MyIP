import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

// If length is not 28 and is not a combination of letters and numbers, return false
function isValidUserID(userID) {
    if (typeof userID !== 'string') return false;
    if (userID.length !== 28 || !/^[a-zA-Z0-9]+$/.test(userID)) return false;
    return true;
}

export default async (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({ error: 'No ID provided' });
    }

    // Check if address is valid
    if (!isValidUserID(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    const apikey = process.env.IPCHECKING_API_KEY;

    if (!apikey) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/getpdresult/${id}?apikey=${apikey}`);

    try {
        const apiResponse = await fetchUpstream(url, {
            headers: {
                ...req.headers,
            }
        });

        // Catch upstream error
        if (!apiResponse.ok) {
            let errorDetail = '';
            try {
                const errorData = await apiResponse.json();
                errorDetail = errorData.message || JSON.stringify(errorData);
            } catch {
                errorDetail = apiResponse.statusText;
            }
            throw new Error(`API responded with status: ${apiResponse.status} - ${errorDetail}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        logger.error({ err: error }, 'invisibility-test upstream request failed');
        res.status(500).json({ error: error.message });
    }

};