// GET /api/ipblocklist?ip= — which blocklists an IP is on, from the private
// IPCheck.ing API (`/iphitlist`: live DNSBL lookups plus static threat lists).
// `?ip` is validated by requirePublicIP(). Sign-in is enforced upstream, so
// the caller's headers (auth token) are forwarded as-is.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../server/logger.js';

// A cold DNSBL pass queries dozens of zones under per-zone deadlines; well
// past the default 8s, and the frontend waits a little longer than this.
export const IP_BLOCKLIST_TIMEOUT_MS = 30000;

export default async (req, res) => {
    const apiKey = process.env.IPCHECKING_API_KEY;
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    if (!apiKey || !apiEndpoint) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const url = new URL(`${apiEndpoint}/iphitlist`);
    url.searchParams.set('ip', req.query.ip);
    url.searchParams.set('key', apiKey);

    try {
        const apiResponse = await fetchUpstream(url, {
            headers: { ...req.headers },
            timeoutMs: IP_BLOCKLIST_TIMEOUT_MS,
        });

        // Monthly quota exhausted: not a failure — pass status + code through
        // so the frontend shows the quota hint.
        if (apiResponse.status === 429) {
            const errorData = await apiResponse.json().catch(() => ({}));
            return res.status(429).json({ error: errorData.error || 'Monthly quota exceeded', code: 'quota_exceeded' });
        }

        // Sign-in problems are the visitor's state, not a failure: pass the
        // status through so the frontend prompts sign-in.
        if (apiResponse.status === 401 || apiResponse.status === 403) {
            const errorData = await apiResponse.json().catch(() => ({}));
            return res.status(apiResponse.status).json({ error: errorData.message || 'Sign in required' });
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
