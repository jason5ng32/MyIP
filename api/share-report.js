// Shareable diagnostic report storage — POST /api/report validates an
// untrusted report against the shared schema whitelist and stores it in
// Cloudflare Workers KV (REST API, TTL-expired); GET /api/report/:id fetches
// one for the read-only /r/:id page (and for AI agents given a share link).
//
// The whole feature is env-gated: without the three CLOUDFLARE_* variables
// below both endpoints answer 503 and /api/configs reports
// `reportSharing: false`, so the share-link UI never shows.
//
// Abuse layering (write side): schema whitelist (no free-form text can be
// stored), a size cap (REPORT_MAX_BYTES), 128-bit unguessable ids, KV TTL.
// Rate limiting is
// deliberately NOT done here — it's a deployment concern: edge rules cover
// the hosted site, and the env-gated global /api limiter in
// backend-server.js (SECURITY_RATE_LIMIT) covers self-hosts.

import crypto from 'node:crypto';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { validateReport, REPORT_TTL_DAYS, REPORT_MAX_BYTES } from '../common/report-schema.js';
import logger from '../server/logger.js';

// --- env / KV plumbing -------------------------------------------------------

// Read at request time (not module load) so tests and late-loaded dotenv both work.
const kvConfig = () => {
    const apiKey = process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
    if (!apiKey || !accountId || !namespaceId) return null;
    return { apiKey, accountId, namespaceId };
};

// Exposed for /api/configs (booleanized there).
export const isReportSharingConfigured = () => kvConfig() !== null;

// A tampered ttlDays is not worth a 400 — anything outside the whitelist is
// forced down to the shortest retention (1 day). Exported for tests.
export const normalizeTtlDays = (ttlDays) =>
    (REPORT_TTL_DAYS.includes(ttlDays) ? ttlDays : REPORT_TTL_DAYS[0]);

const kvValueUrl = ({ accountId, namespaceId }, key, queryString = '') =>
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}${queryString}`;

// Surface Cloudflare's own error message (truncated) in thrown errors —
// a bare status code turns "multipart required" into a guessing game.
const kvErrorDetail = (response) =>
    response.text().then((text) => text.slice(0, 300)).catch(() => '');

// --- handlers ------------------------------------------------------------------

// POST /api/report — body: { report, ttlDays }
const createReport = async (req, res) => {
    // defensive; route gating covers this, but the smoke test asserts on it.
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    const config = kvConfig();
    if (!config) {
        return res.status(503).json({ error: 'Report sharing is not configured' });
    }

    const { report, ttlDays } = req.body ?? {};
    const { ok, errors } = validateReport(report);
    if (!ok) {
        return res.status(400).json({ error: 'Invalid report', details: errors });
    }
    const serialized = JSON.stringify(report);
    if (Buffer.byteLength(serialized, 'utf8') > REPORT_MAX_BYTES) {
        return res.status(413).json({ error: 'Report too large' });
    }

    try {
        const id = crypto.randomBytes(16).toString('base64url');
        const ttlSeconds = normalizeTtlDays(ttlDays) * 24 * 60 * 60;
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        // Stored value is a { expiresAt, report } wrapper so readers (the
        // report page, AI agents fetching the link) can show when the report
        // will disappear — KV's own TTL isn't readable via the values GET.
        //
        // The KV write endpoint requires multipart/form-data with `value` +
        // `metadata` fields (a raw body is a 400); fetch derives the
        // multipart boundary from the FormData, so no manual Content-Type.
        const form = new FormData();
        form.append('value', JSON.stringify({ expiresAt, report }));
        form.append('metadata', '{}');
        const response = await fetchUpstream(
            kvValueUrl(config, id, `?expiration_ttl=${ttlSeconds}`),
            {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
                body: form,
            },
        );
        if (!response.ok) throw new Error(`KV write responded ${response.status}: ${await kvErrorDetail(response)}`);

        return res.status(201).json({ id, expiresAt });
    } catch (error) {
        logger.error({ err: error }, 'Report share create failed');
        return res.status(500).json({ error: error.message });
    }
};

// GET /api/report/:id — id format is enforced by requireValidReportId().
export const getReport = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    const config = kvConfig();
    if (!config) {
        return res.status(503).json({ error: 'Report sharing is not configured' });
    }

    try {
        const response = await fetchUpstream(kvValueUrl(config, req.params.id), {
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
        });
        if (response.status === 404) {
            return res.status(404).json({ error: 'Report not found or expired' });
        }
        if (!response.ok) throw new Error(`KV read responded ${response.status}: ${await kvErrorDetail(response)}`);
        // Stored values are validated { expiresAt, report } JSON; parse and
        // re-serialize so a corrupt KV value fails here, not in the client.
        return res.status(200).json(JSON.parse(await response.text()));
    } catch (error) {
        logger.error({ err: error, reportId: req.params.id }, 'Report share read failed');
        return res.status(500).json({ error: error.message });
    }
};

export default createReport;
