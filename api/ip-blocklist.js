// GET /api/ipblocklist?ip= — which blocklists an IP is on, from the
// IPCheck.ing API (`/iphitlist`: live DNSBL lookups plus static threat lists).
// `?ip` is validated by requirePublicIP(). Sign-in is enforced upstream, so
// the listed caller headers (auth token included) are forwarded.

import logger from '../server/logger.js';
import { ipCheckingApiErrorBody, isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

// A cold DNSBL pass queries dozens of zones under per-zone deadlines; well
// past the default 8s, and the frontend waits a little longer than this.
export const IP_BLOCKLIST_TIMEOUT_MS = 30000;

export default async (req, res) => {
    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    try {
        const apiResponse = await requestIpCheckingApi('/iphitlist', {
            query: { ip: req.query.ip },
            forwardFrom: req,
            timeoutMs: IP_BLOCKLIST_TIMEOUT_MS,
        });

        // Quota (429) and sign-in (401/403) are the visitor's state, not a
        // failure: pass the status through with the coded body so the
        // frontend shows the matching hint.
        if (apiResponse.status === 429 || apiResponse.status === 401 || apiResponse.status === 403) {
            return res.status(apiResponse.status).json(await ipCheckingApiErrorBody(apiResponse));
        }

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        res.json(await apiResponse.json());
    } catch (error) {
        logger.error({ err: error, ip: req.query.ip }, 'ip-blocklist upstream request failed');
        res.status(500).json({ error: error.message });
    }
};
