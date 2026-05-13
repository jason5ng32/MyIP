// Centralized RIPEstat client. Each typed helper picks a timeout matching
// its endpoint's normal latency; callers can override per call.

import { fetchUpstream } from './fetch-with-timeout.js';

const BASE_URL = 'https://stat.ripe.net/data';
const SOURCE_APP = process.env.RIPESTAT_SOURCE_APP || 'myip';

function fetchRipestat(endpoint, resource, { timeoutMs = 8000 } = {}) {
    const search = new URLSearchParams({ resource, sourceapp: SOURCE_APP });
    return fetchUpstream(`${BASE_URL}/${endpoint}/data.json?${search}`, { timeoutMs });
}

/** as-overview: AS metadata including `holder` (org name w/ handle prefix). */
export function fetchAsOverview(asn, { timeoutMs = 3000 } = {}) {
    return fetchRipestat('as-overview', `AS${asn}`, { timeoutMs });
}

/** routing-history: historical AS announcements for a prefix or IP. */
export function fetchRoutingHistory(resource, { timeoutMs = 8000 } = {}) {
    return fetchRipestat('routing-history', resource, { timeoutMs });
}

/**
 * Strip RIPEstat's "<HANDLE> - " prefix from a `holder` field so the UI
 * sees just the readable company name.
 */
export function extractOrgFromHolder(holder) {
    if (!holder || typeof holder !== 'string') return null;
    const dash = holder.indexOf(' - ');
    return dash > 0 ? holder.slice(dash + 3).trim() : holder.trim();
}
