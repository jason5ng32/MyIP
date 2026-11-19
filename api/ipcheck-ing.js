import logger from '../server/logger.js';
import { toPublicAnswer } from '../server/ipcheck-ing-extended.js';
import { isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

export default async (req, res) => {
    // Presence, validity and public routability guaranteed by the
    // requirePublicIP middleware — a reserved address never reaches here.
    const ipAddress = req.query.ip;

    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const lang = req.query.lang || 'en';

    try {
        const apiResponse = await requestIpCheckingApi('/ipinfo', {
            query: { ip: ipAddress, lang },
            forwardFrom: req,
        });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        res.json(toPublicAnswer(await apiResponse.json()));
    } catch (error) {
        logger.error({ err: error, ip: ipAddress, lang }, 'ipcheck-ing handler failed');
        res.status(500).json({ error: error.message });
    }
}