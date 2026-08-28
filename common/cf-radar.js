// Cloudflare Radar data layer behind the single /api/cfradar route. Each
// RADAR_VIEWS entry is one `?view=` value: the guard middlewares that
// validate/normalize its query params (reused from common/guards.js), the
// edge-cache TTL the route middleware in backend-server.js applies, and the
// fetch function that produces the response payload. api/cf-radar.js
// dispatches over this registry — adding Radar data means one view function
// plus one registry row here, never a new route.

import { fetchUpstream } from './fetch-with-timeout.js';
import { requireValidASN, requireValidCountry } from './guards.js';
import { providersOf, peersOf, customerCountOf } from './as-rel-db.js';
import logger from './logger.js';

// -- shared Radar client ----------------------------------------------------

// CLOUDFLARE_API is the pre-rename spelling — keep reading it so existing
// deployments don't lose the key on upgrade.
export const hasRadarApiKey = () =>
    Boolean(process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API);

export async function fetchFromCloudflare(endpoint) {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const response = await fetchUpstream(url, {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json',
        },
    });
    // Outage pages come back as HTML — fail on status instead of JSON.parse.
    if (!response.ok) {
        throw new Error(`Cloudflare Radar responded ${response.status}`);
    }
    return response.json();
}

// -- view: asn — per-ASN entity info + 7d HTTP traffic profile --------------

// The five Radar segments backing one response, keyed by the field name
// cleanUpResponseData expects.
const SEGMENTS = {
    asnInfo: (asn) => `/radar/entities/asns/${asn}`,
    ipVersion: (asn) => `/radar/http/summary/ip_version?asn=${asn}&dateRange=7d`,
    httpProtocol: (asn) => `/radar/http/summary/http_protocol?asn=${asn}&dateRange=7d`,
    deviceType: (asn) => `/radar/http/summary/device_type?asn=${asn}&dateRange=7d`,
    botType: (asn) => `/radar/http/summary/bot_class?asn=${asn}&dateRange=7d`,
    routesStats: (asn) => `/radar/bgp/routes/stats?asn=${asn}`,
    rels: (asn) => `/radar/entities/asns/${asn}/rel`,
    quality: (asn) => `/radar/quality/speed/summary?asn=${asn}`,
};

// Fetch all segments in parallel. A failed segment is dropped rather than
// failing the whole response — cleanUpResponseData / filterData already
// tolerate sparse data (small ASNs), so partial results degrade to missing
// fields. Only a full wipe-out is an error (fetchAsnProfile throws).
const getAllASNData = async (asn) => {
    const names = Object.keys(SEGMENTS);
    const settled = await Promise.allSettled(names.map((name) => fetchFromCloudflare(SEGMENTS[name](asn))));
    const data = {};
    const failed = [];
    settled.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            data[names[i]] = result.value;
        } else {
            failed.push({ name: names[i], reason: result.reason });
        }
    });
    return { data, failed };
};

// Clean up Cloudflare Radar return data to uniform field names.
// Optional-chaining everywhere because CF Radar returns sparse data for
// small / private / new ASNs (e.g. AS64512 is in the RFC 6996 private range
// and has no info at all; many smaller ASNs have asn info but no traffic
// summaries). Missing fields fall through as undefined and get stripped
// downstream in filterData via the NaN check.
function cleanUpResponseData(data) {
    return {
        asnName: data.asnInfo?.result?.asn?.name,
        asnCountryCode: data.asnInfo?.result?.asn?.country,
        asnOrgName: data.asnInfo?.result?.asn?.orgName,
        estimatedUsers: data.asnInfo?.result?.asn?.estimatedUsers?.estimatedUsers,
        IPv4_Pct: data.ipVersion?.result?.summary_0?.IPv4,
        IPv6_Pct: data.ipVersion?.result?.summary_0?.IPv6,
        HTTP_Pct: data.httpProtocol?.result?.summary_0?.http,
        HTTPS_Pct: data.httpProtocol?.result?.summary_0?.https,
        Desktop_Pct: data.deviceType?.result?.summary_0?.desktop,
        Mobile_Pct: data.deviceType?.result?.summary_0?.mobile,
        Bot_Pct: data.botType?.result?.summary_0?.bot,
        Human_Pct: data.botType?.result?.summary_0?.human,
        prefixesV4: data.routesStats?.result?.stats?.distinct_prefixes_ipv4,
        prefixesV6: data.routesStats?.result?.stats?.distinct_prefixes_ipv6,
        speedDownload: data.quality?.result?.summary_0?.bandwidthDownload,
        speedUpload: data.quality?.result?.summary_0?.bandwidthUpload,
        latency: data.quality?.result?.summary_0?.latencyIdle,
        jitter: data.quality?.result?.summary_0?.jitterIdle,
    };
}

// Distinct relationship partners from Radar /rel rows. A pair listed as both
// transit and peer counts as transit only (same dedupe as asn-connectivity).
export const countAsnRels = (rows, asn) => {
    const upstreams = new Set();
    const downstreams = new Set();
    const peers = new Set();
    for (const row of rows) {
        if (row.rel === 'provider-customer') {
            if (row.asn2 === asn) upstreams.add(row.asn1);
            else if (row.asn1 === asn) downstreams.add(row.asn2);
        } else if (row.rel === 'peer') {
            peers.add(row.asn1 === asn ? row.asn2 : row.asn1);
        }
    }
    for (const p of upstreams) peers.delete(p);
    for (const p of downstreams) peers.delete(p);
    return { upstreamCount: upstreams.size, downstreamCount: downstreams.size, peerCount: peers.size };
};

// Rel counts prefer Radar's path-observed rows; when the segment failed or
// came back empty, fall back to the local CAIDA snapshot. All-zero counts
// (AS unknown to both) are dropped so the frontend hides the fields.
function resolveRelCounts(rows, asn) {
    const counts = Array.isArray(rows) && rows.length > 0
        ? countAsnRels(rows, asn)
        : {
            upstreamCount: providersOf(asn).length,
            downstreamCount: customerCountOf(asn),
            peerCount: peersOf(asn).length,
        };
    return Object.values(counts).every(v => v === 0) ? {} : counts;
}

// Format output
function formatData(data) {
    const { asnName, asnCountryCode, asnOrgName, estimatedUsers, IPv4_Pct, IPv6_Pct, HTTP_Pct, HTTPS_Pct, Desktop_Pct, Mobile_Pct, Bot_Pct, Human_Pct, prefixesV4, prefixesV6, upstreamCount, downstreamCount, peerCount, speedDownload, speedUpload, latency, jitter } = data;
    return {
        asnName,
        asnCountryCode,
        asnOrgName,
        estimatedUsers: parseFloat(estimatedUsers).toLocaleString(),
        prefixesV4: parseFloat(prefixesV4).toLocaleString(),
        prefixesV6: parseFloat(prefixesV6).toLocaleString(),
        upstreamCount: parseFloat(upstreamCount).toLocaleString(),
        downstreamCount: parseFloat(downstreamCount).toLocaleString(),
        peerCount: parseFloat(peerCount).toLocaleString(),
        speedDownload: `${parseFloat(speedDownload).toFixed(1)} Mbps`,
        speedUpload: `${parseFloat(speedUpload).toFixed(1)} Mbps`,
        latency: `${Math.round(parseFloat(latency))} ms`,
        jitter: `${parseFloat(jitter).toFixed(1)} ms`,
        IPv4_Pct: `${parseFloat(IPv4_Pct).toFixed(2)}%`,
        IPv6_Pct: `${parseFloat(IPv6_Pct).toFixed(2)}%`,
        HTTP_Pct: `${parseFloat(HTTP_Pct).toFixed(2)}%`,
        HTTPS_Pct: `${parseFloat(HTTPS_Pct).toFixed(2)}%`,
        Desktop_Pct: `${parseFloat(Desktop_Pct).toFixed(2)}%`,
        Mobile_Pct: `${parseFloat(Mobile_Pct).toFixed(2)}%`,
        Bot_Pct: `${parseFloat(Bot_Pct).toFixed(2)}%`,
        Human_Pct: `${parseFloat(Human_Pct).toFixed(2)}%`,
    };
}

// Filter out non-existent fields — a missing upstream value formats into a
// string leading with "NaN" whatever unit suffix it carries.
function filterData(data) {
    for (const key in data) {
        if (String(data[key]).startsWith('NaN')) {
            delete data[key];
        }
    }
    return data;
}

const fetchAsnProfile = async ({ asn }) => {
    const { data, failed } = await getAllASNData(asn);
    if (failed.length === Object.keys(SEGMENTS).length) {
        throw failed[0].reason instanceof Error
            ? failed[0].reason
            : new Error('all Radar segments failed');
    }
    if (failed.length > 0) {
        logger.warn({ err: failed[0].reason, asn, segments: failed.map((f) => f.name) }, 'cf-radar: partial Radar segment failure');
    }
    const cleaned = cleanUpResponseData(data);
    Object.assign(cleaned, resolveRelCounts(data.rels?.result?.rels, Number(asn)));
    return filterData(formatData(cleaned));
};

// -- view: country-traffic — country online-activity heatmap ----------------

// Aggregates Radar's hourly HTTP-requests timeseries (requests track people
// being online better than NetFlows bytes) into a Monday-first 7×24
// weekday/hour matrix. Country-level on purpose: global ASNs have no single
// diurnal rhythm, and ~250 cache keys let the 30-day edge cache absorb
// nearly every request.
//
// 28d × 1h ≈ 4 samples per weekday/hour cell — one week alone would let a
// single holiday skew the heatmap.
const seriesEndpoint = (country, humanOnly) =>
    `/radar/http/timeseries?location=${country}${humanOnly ? '&botClass=LIKELY_HUMAN' : ''}&dateRange=28d&aggInterval=1h`;

// Mean of Radar's MIN0_MAX-normalized values per weekday/hour cell, re-scaled
// so the busiest cell is 1. Stays in UTC — the response is edge-cached across
// timezones, so the frontend does the hour rotation. Null when the series
// covers less than a full week of hourly points. Exported for tests.
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

const fetchCountryTraffic = async (query) => {
    // Strict '1' keeps the cache key space to two variants per country.
    const humanOnly = query.human === '1';
    const json = await fetchFromCloudflare(seriesEndpoint(query.country, humanOnly));
    // null (no usable series) is a valid, cacheable answer.
    return { trafficMatrix: buildTrafficMatrix(json?.result?.serie_0) };
};

// -- view: outages — global internet outage feed for the Pulse panel -------

// Merges two Radar sources into one recent-events list:
//   - /radar/annotations/outages   (manually verified outages, with a cause)
//   - /radar/traffic_anomalies     (auto-detected drops, all statuses)
// A verified anomaly is often promoted to an outage entry for the same event,
// so anomalies that match an outage's subject and start time are dropped.

const DATE_RANGE = '30d';
const MAX_EVENTS = 30;
// An anomaly counts as a duplicate of an outage when they share a subject
// (location or ASN) and start within this window of each other.
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Both kinds normalize to one flat shape; anomaly-only fields stay null on
// outages and vice versa. `endDate: null` means the event is still ongoing.
// Exported for tests.
export const normalizeOutages = (annotations) => annotations.map((entry) => ({
    kind: 'outage',
    id: `o-${entry.id}`,
    startDate: entry.startDate,
    endDate: entry.endDate || null,
    locations: (entry.locationsDetails || []).map((loc) => loc.code),
    asns: (entry.asnsDetails || []).map((detail) => ({ asn: Number(detail.asn), name: detail.name })),
    cause: entry.outage?.outageCause || 'UNKNOWN',
    level: entry.outage?.outageType || null,
    description: entry.description || null,
    scope: entry.scope || null,
    linkedUrl: entry.linkedUrl || null,
}));

// Anomaly statuses hidden from the feed. Live data carries values beyond the
// documented VERIFIED/UNVERIFIED pair (e.g. TP = third-party confirmed), so
// this is a blocklist, not an allowlist. Empty today — every status ships;
// add 'UNVERIFIED' here to restrict the feed to confirmed events only.
const EXCLUDED_ANOMALY_STATUSES = new Set([]);

export const normalizeAnomalies = (anomalies) => anomalies
    .filter((entry) => !EXCLUDED_ANOMALY_STATUSES.has(entry.status))
    .map((entry) => ({
        kind: 'anomaly',
        id: `a-${entry.uuid}`,
        startDate: entry.startDate,
        endDate: entry.endDate || null,
        locations: entry.locationDetails?.code ? [entry.locationDetails.code] : [],
        asns: entry.asnDetails?.asn
            ? [{ asn: Number(entry.asnDetails.asn), name: entry.asnDetails.name }]
            : [],
        cause: null,
        level: null,
        description: null,
        scope: null,
        linkedUrl: null,
    }));

export const mergeEvents = (outages, anomalies) => {
    const isDuplicate = (anomaly) => outages.some((outage) => {
        const sharesSubject = anomaly.locations.some((code) => outage.locations.includes(code))
            || anomaly.asns.some((a) => outage.asns.some((o) => o.asn === a.asn));
        if (!sharesSubject) return false;
        return Math.abs(Date.parse(anomaly.startDate) - Date.parse(outage.startDate)) <= DEDUPE_WINDOW_MS;
    });
    // Two-level order, consumed by the frontend as-is: ongoing events first
    // (endDate null), ended ones after, newest-first inside each group. The
    // cap then favors ongoing events by construction.
    return [...outages, ...anomalies.filter((anomaly) => !isDuplicate(anomaly))]
        .sort((a, b) => {
            const aOngoing = a.endDate === null;
            const bOngoing = b.endDate === null;
            if (aOngoing !== bOngoing) return aOngoing ? -1 : 1;
            return Date.parse(b.startDate) - Date.parse(a.startDate);
        })
        .slice(0, MAX_EVENTS);
};

const fetchOutages = async () => {
    // One failed source degrades to a partial feed; both failing is an error.
    const [outagesResult, anomaliesResult] = await Promise.allSettled([
        fetchFromCloudflare(`/radar/annotations/outages?dateRange=${DATE_RANGE}&limit=50`),
        fetchFromCloudflare(`/radar/traffic_anomalies?dateRange=${DATE_RANGE}&limit=100`),
    ]);

    if (outagesResult.status === 'rejected' && anomaliesResult.status === 'rejected') {
        throw outagesResult.reason instanceof Error
            ? outagesResult.reason
            : new Error('both Radar sources failed');
    }
    if (outagesResult.status === 'rejected' || anomaliesResult.status === 'rejected') {
        const failed = outagesResult.status === 'rejected' ? outagesResult : anomaliesResult;
        logger.warn({ err: failed.reason }, 'cf-radar: one outage source failed');
    }

    const outages = normalizeOutages(
        outagesResult.status === 'fulfilled' ? outagesResult.value?.result?.annotations || [] : []);
    const anomalies = normalizeAnomalies(
        anomaliesResult.status === 'fulfilled' ? anomaliesResult.value?.result?.trafficAnomalies || [] : []);

    return { events: mergeEvents(outages, anomalies) };
};

// -- view registry ----------------------------------------------------------

// guards: run by the dispatcher before fetch — each 400s invalid input and
//         normalizes params in place, so cache keys stay canonical.
// ttl:    edge-cache seconds, read by the /api/cfradar route middleware.
// fetch:  async (req.query) => payload; throws on upstream failure.
export const RADAR_VIEWS = {
    'asn': {
        guards: [requireValidASN()],
        ttl: 30 * 24 * 60 * 60,
        fetch: fetchAsnProfile,
    },
    'country-traffic': {
        guards: [requireValidCountry()],
        ttl: 30 * 24 * 60 * 60,
        fetch: fetchCountryTraffic,
    },
    'outages': {
        guards: [],
        ttl: 60 * 60,
        fetch: fetchOutages,
    },
};
