import logger from '../server/logger.js';
import { ipCheckingApiErrorBody, isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

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

    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    try {
        const apiResponse = await requestIpCheckingApi(`/getpdresult/${id}`, {
            keyParam: 'apikey',
            forwardFrom: req,
            endUserId: res.locals.userId,
        });

        // Upstream 404 = "result not computed yet" — a normal answer while
        // the frontend polls after starting a test, not a failure. Translate
        // to 200 {status:'pending'}
        if (apiResponse.status === 404) {
            return res.json({ status: 'pending' });
        }

        // Upstream 429 (quota) and 401/403 (sign-in): the visitor's state,
        // not an error for us. Status passes through with the coded body so
        // the frontend shows the matching hint; kept off the error logger.
        if (apiResponse.status === 429 || apiResponse.status === 401 || apiResponse.status === 403) {
            return res.status(apiResponse.status).json(await ipCheckingApiErrorBody(apiResponse));
        }

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