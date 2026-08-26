// Backend for /api/cfradar-traffic — country online-activity heatmap.
// GET /api/cfradar-traffic?country=XX[&human=1]. Aggregates Cloudflare
// Radar's hourly HTTP-requests timeseries (requests track people being
// online better than NetFlows bytes) into a Monday-first 7×24 weekday/hour
// matrix. Country-level on purpose: global ASNs have no single diurnal
// rhythm, and ~250 cache keys let the 30-day edge cache absorb nearly
// every request.
import { fetchFromCloudflare } from './cf-radar.js';
import logger from '../common/logger.js';

// 28d × 1h ≈ 4 samples per weekday/hour cell — one week alone would let a
// single holiday skew the heatmap.
const seriesEndpoint = (country, humanOnly) =>
    `/radar/http/timeseries?location=${country}${humanOnly ? '&botClass=LIKELY_HUMAN' : ''}&dateRange=28d&aggInterval=1h`;

// Mean of Radar's MIN0_MAX-normalized values per weekday/hour cell, re-scaled
// so the busiest cell is 1. Stays in UTC — the response is edge-cached across
// timezones, so the frontend does the hour rotation. Null when the series
// covers less than a full week of hourly points.
export const buildTrafficMatrix = (serie) => {
    const timestamps = serie?.timestamps;
    const values = serie?.values;
    if (!Array.isArray(timestamps) || !Array.isArray(values)) return null;

    const sums = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let usable = 0;
    timestamps.forEach((ts, i) => {
        const value = parseFloat(values[i]);
        const ms = Date.parse(ts);
        if (!Number.isFinite(value) || !Number.isFinite(ms)) return;
        const date = new Date(ms);
        const day = (date.getUTCDay() + 6) % 7; // getUTCDay is Sunday-first
        sums[day][date.getUTCHours()] += value;
        counts[day][date.getUTCHours()] += 1;
        usable += 1;
    });
    if (usable < 7 * 24) return null;

    const means = sums.map((row, d) => row.map((sum, h) => (counts[d][h] ? sum / counts[d][h] : 0)));
    const max = Math.max(...means.flat());
    if (max <= 0) return null;
    return means.map((row) => row.map((v) => Math.round((v / max) * 1000) / 1000));
};

export default async (req, res) => {
    if (!process.env.CLOUDFLARE_API_KEY && !process.env.CLOUDFLARE_API) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const country = req.query.country;
    // Strict '1' keeps the cache key space to two variants per country.
    const humanOnly = req.query.human === '1';
    try {
        const json = await fetchFromCloudflare(seriesEndpoint(country, humanOnly));
        // null (no usable series) is a valid, cacheable answer.
        res.json({ trafficMatrix: buildTrafficMatrix(json?.result?.serie_0) });
    } catch (error) {
        logger.error({ err: error, country }, 'cf-radar-traffic handler failed');
        res.status(500).json({ error: 'Internal server error' });
    }
};
