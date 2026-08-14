// Handler for /api/outages — global internet outage feed for the Pulse panel.
// Merges two Cloudflare Radar sources into one recent-events list:
//   - /radar/annotations/outages   (manually verified outages, with a cause)
//   - /radar/traffic_anomalies     (auto-detected drops, all statuses)
// A verified anomaly is often promoted to an outage entry for the same event,
// so anomalies that match an outage's subject and start time are dropped.
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

const DATE_RANGE = '30d';
const MAX_EVENTS = 30;
// An anomaly counts as a duplicate of an outage when they share a subject
// (location or ASN) and start within this window of each other.
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const fetchFromRadar = async (endpoint) => {
    const url = `https://api.cloudflare.com/client/v4${endpoint}`;
    const response = await fetchUpstream(url, {
        headers: {
            'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API}`,
            'Content-Type': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`Cloudflare Radar responded ${response.status}`);
    }
    return response.json();
};

// Both kinds normalize to one flat shape; anomaly-only fields stay null on
// outages and vice versa. `endDate: null` means the event is still ongoing.
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

export default async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    if (!process.env.CLOUDFLARE_API_KEY && !process.env.CLOUDFLARE_API) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    // One failed source degrades to a partial feed; both failing is an error.
    const [outagesResult, anomaliesResult] = await Promise.allSettled([
        fetchFromRadar(`/radar/annotations/outages?dateRange=${DATE_RANGE}&limit=50`),
        fetchFromRadar(`/radar/traffic_anomalies?dateRange=${DATE_RANGE}&limit=100`),
    ]);

    if (outagesResult.status === 'rejected' && anomaliesResult.status === 'rejected') {
        logger.error({ err: outagesResult.reason }, 'net-outages: both Radar sources failed');
        return res.status(500).json({ error: 'Internal server error' });
    }
    if (outagesResult.status === 'rejected' || anomaliesResult.status === 'rejected') {
        const failed = outagesResult.status === 'rejected' ? outagesResult : anomaliesResult;
        logger.warn({ err: failed.reason }, 'net-outages: one Radar source failed');
    }

    const outages = normalizeOutages(
        outagesResult.status === 'fulfilled' ? outagesResult.value?.result?.annotations || [] : []);
    const anomalies = normalizeAnomalies(
        anomaliesResult.status === 'fulfilled' ? anomaliesResult.value?.result?.trafficAnomalies || [] : []);

    res.json({ events: mergeEvents(outages, anomalies) });
};
