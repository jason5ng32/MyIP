// /api/ooni-blocking — per-country blocking view for a domain over the last
// 30 days, built from OONI's open aggregation API (web_connectivity test,
// probe_cc × blocking_type axes). Powers the default view of the frontend
// CensorshipCheck tool; classification lives in common/ooni-blocking.js.
//
// OONI matches `domain` against the exact tested hostname, so a single query
// misses most of the dataset (e.g. `bbc.com` has ~6 rows while `www.bbc.com`
// has 152 countries). We query the apex and www. variants in parallel and
// merge; one variant failing only degrades the merge, both failing is a 500.
//
// The date window is computed server-side and aligned to UTC days so the
// cache key (the URL) stays stable within a day — the route is wrapped in
// `cacheable()` and CF absorbs repeat lookups of popular domains.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { classifyOoniCountries, OONI_WINDOW_DAYS } from '../common/ooni-blocking.js';
import logger from '../common/logger.js';

const OONI_AGGREGATION_URL = 'https://api.ooni.io/api/v1/aggregation';

const utcDay = (date) => date.toISOString().slice(0, 10);

const fetchAggregationOnce = async (hostname, since, until) => {
    const params = new URLSearchParams({
        domain: hostname,
        test_name: 'web_connectivity',
        since,
        until,
        axis_x: 'probe_cc',
        axis_y: 'blocking_type',
    });
    const response = await fetchUpstream(`${OONI_AGGREGATION_URL}?${params}`);
    if (!response.ok) {
        throw new Error(`OONI aggregation responded with status ${response.status}`);
    }
    const data = await response.json();
    return Array.isArray(data.result) ? data.result : [];
};

// OONI's API intermittently throws 5xx under load. Those fail fast, so one
// immediate retry usually rides out the blip. Timeouts (AbortError) are NOT
// retried — a saturated upstream would just cost the visitor another 8s.
const fetchAggregation = async (hostname, since, until) => {
    try {
        return await fetchAggregationOnce(hostname, since, until);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        return await fetchAggregationOnce(hostname, since, until);
    }
};

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Presence, shape and lowercasing guaranteed by requireValidDomain.
    const domain = req.query.domain;
    const apex = domain.replace(/^www\./, '');
    const variants = [...new Set([apex, `www.${apex}`])];

    const now = new Date();
    const until = utcDay(now);
    const since = utcDay(new Date(now.getTime() - OONI_WINDOW_DAYS * 24 * 60 * 60 * 1000));

    try {
        const settled = await Promise.allSettled(variants.map((v) => fetchAggregation(v, since, until)));
        const fulfilled = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
        if (fulfilled.length === 0) {
            throw settled[0].reason;
        }
        if (fulfilled.length < settled.length) {
            logger.warn({ domain }, 'ooni-blocking: one hostname variant query failed, serving partial merge');
        }
        res.json({
            domain: apex,
            since,
            until,
            countries: classifyOoniCountries(fulfilled.flat()),
        });
    } catch (error) {
        logger.error({ err: error, domain }, 'ooni-blocking handler failed');
        res.status(500).json({ error: error.message });
    }
};
