// Enhanced DNS leak detection — thin proxy to the IPCheck.ing API.
//
//   - validates the 32-hex token locally (fail fast before any network hop),
//   - forwards the listed caller headers (notably Authorization: Bearer <Firebase ID>),
//   - attaches the apikey query param and forwards ?lang untouched,
//   - passes the upstream status back with its JSON verbatim on success and
//     the coded error body on failure, so the frontend can tell sign-in and
//     quota apart from other failures.
//
//   GET /api/dnsleaktest/session/:token

import logger from '../server/logger.js';
import { ipCheckingApiErrorBody, isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

const TOKEN_RE = /^[0-9a-f]{32}$/;

export async function getSessionResult(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = req.params?.token;
    if (!token || !TOKEN_RE.test(token)) {
        return res.status(400).json({ error: 'Invalid token' });
    }

    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    // The upstream resolves any tag onto the languages it has, so the caller's
    // value rides along untouched; omitting it lets the upstream default apply.
    const lang = typeof req.query.lang === 'string' && req.query.lang ? req.query.lang : undefined;

    try {
        const apiResponse = await requestIpCheckingApi(`/dnsleaktest/session/${token}`, {
            keyParam: 'apikey',
            query: { lang },
            forwardFrom: req,
        });

        // Parse as JSON if we can, otherwise just keep an empty object so the
        // client still gets a proper status code.
        const data = apiResponse.ok
            ? await apiResponse.json().catch(() => ({}))
            : await ipCheckingApiErrorBody(apiResponse);

        res.status(apiResponse.status).json(data);
    } catch (error) {
        logger.error({ err: error }, 'dnsleaktest upstream fetch failed');
        res.status(502).json({ error: 'Upstream fetch failed', detail: error.message });
    }
}
