// POST /api/persona/evaluate — Persona Check.
//
// Thin proxy to the IPCheck.ing API, which owns the evaluation this
// deployment deliberately does not carry. One observation in, one graded
// report out; per-visitor, never cached. The listed caller headers travel
// upstream (the evaluator needs the request context); results come back as
// ids and enums, and the front end renders its own four-language copy.

import logger from '../server/logger.js';
import { ipCheckingApiErrorBody, isIpCheckingApiConfigured, requestIpCheckingApi } from '../server/ipcheck-ing-api.js';

export default async (req, res) => {
    // Defensive method gate (the route is POST-only) — covered by tests.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!isIpCheckingApiConfigured()) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    if (!req.body?.persona?.country) {
        return res.status(400).json({ error: 'No persona provided' });
    }

    try {
        const apiResponse = await requestIpCheckingApi('/persona/evaluate', {
            method: 'POST',
            body: req.body,
            forwardFrom: req,
        });

        // The status passes through, the payload verbatim on success and as
        // the coded error body on failure, so the frontend can tell a
        // rejected request from an unreachable evaluator and degrade to its
        // error line rather than a blank report.
        const data = apiResponse.ok
            ? await apiResponse.json().catch(() => ({}))
            : await ipCheckingApiErrorBody(apiResponse);
        return res.status(apiResponse.status).json(data);
    } catch (error) {
        logger.error({ err: error }, 'persona evaluate upstream fetch failed');
        return res.status(502).json({ error: 'Upstream fetch failed' });
    }
};
