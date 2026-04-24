// Enhanced DNS leak detection — thin proxy to the main IPCheck.ing API.
//
//   - validates the 32-hex token locally (fail fast before any network hop),
//   - forwards request headers (notably Authorization: Bearer <Firebase ID>),
//   - attaches the apikey query param,
//   - passes the upstream status + JSON back to the caller verbatim so the
//     frontend can surface "Sign in required" / "Invalid token" etc.
//
//   GET /api/dnsleaktest/session/:token

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

const TOKEN_RE = /^[0-9a-f]{32}$/;
const SUPPORTED_LANGS = ['zh-CN', 'en', 'fr', 'tr'];

export async function getSessionResult(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = req.params?.token;
    if (!token || !TOKEN_RE.test(token)) {
        return res.status(400).json({ error: 'Invalid token' });
    }

    const apiKey = process.env.IPCHECKING_API_KEY;
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    if (!apiKey || !apiEndpoint) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const lang = SUPPORTED_LANGS.includes(req.query.lang) ? req.query.lang : 'zh-CN';

    const url = new URL(`${apiEndpoint}/dnsleaktest/session/${token}`);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('lang', lang);

    try {
        const apiResponse = await fetchUpstream(url, {
            headers: { ...req.headers },
        });

        // Parse as JSON if we can, otherwise just keep an empty object so the
        // client still gets a proper status code.
        const data = await apiResponse.json().catch(() => ({}));

        res.set('Cache-Control', 'no-store');
        res.status(apiResponse.status).json(data);
    } catch (error) {
        logger.error({ err: error }, 'dnsleaktest upstream fetch failed');
        res.status(502).json({ error: 'Upstream fetch failed', detail: error.message });
    }
}
