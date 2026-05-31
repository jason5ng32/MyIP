// Centralized RIPEstat client. Each typed helper picks a timeout matching
// its endpoint's normal latency; callers can override per call.

import { fetchUpstream } from './fetch-with-timeout.js';
import { lookupAsOrgName } from './as-org-db.js';

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

/** routing-history: historical AS announcements for a prefix or IP.
 *  Slow analytical endpoint — scans years of BGP data, regularly takes
 *  10–20s for prefixes with long history. */
export function fetchRoutingHistory(resource, { timeoutMs = 25000 } = {}) {
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

/**
 * Two-tier AS org-name resolver: local CAIDA as2org first (µs), RIPEstat
 * as-overview fallback when the snapshot doesn't have the ASN. Best-effort —
 * any failure yields null so callers can fall back to ASN-only display.
 *
 * `onError(error, asn)` is an optional observability hook invoked on the
 * fallback failure/catch path. asn-history passes a warn logger here;
 * asn-connectivity omits it and stays silent — preserve that asymmetry.
 */
export async function resolveAsnOrgName(asn, { onError } = {}) {
    const local = lookupAsOrgName(asn);
    if (local) return local;
    try {
        const res = await fetchAsOverview(asn);
        if (!res.ok) return null;
        const payload = await res.json();
        return extractOrgFromHolder(payload?.data?.holder);
    } catch (error) {
        if (onError) onError(error, asn);
        return null;
    }
}
