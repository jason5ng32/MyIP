// /api/asn-history — RIPEstat routing-history for a CIDR prefix (the
// frontend quantizes the user's IP to /24 v4 or /48 v6 first, so all IPs
// in the same prefix collapse to one CF edge cache entry). Org names per
// ASN come from RIPEstat as-overview, fetched in parallel, best-effort.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

const prefixLength = (prefix) => parseInt((prefix || '').split('/')[1], 10);

// BGP-meaningful prefix floor per family. Shorter prefixes are leaks /
// default routes that happen to cover the IP but don't attribute it.
const MIN_PREFIX = { v4: 8, v6: 19 };

// Below this peer count an announcement is route noise / brief misconfig.
const MIN_PEERS = 30;

// RIPEstat polite-citizen marker; overridable per deployment.
const SOURCE_APP = process.env.RIPESTAT_SOURCE_APP || 'myip';

// Shorter timeout for the org enrichment calls — they're best-effort, we'd
// rather return ASN-only history than make the user wait the full upstream
// timeout for a slow secondary lookup.
const ORG_FETCH_TIMEOUT_MS = 8000;

function summarizeOrigin(entry, minLen) {
    const acceptedPrefixes = (entry.prefixes || []).filter(p => prefixLength(p.prefix) >= minLen);
    if (acceptedPrefixes.length === 0) return null;

    const allTimes = [];
    for (const p of acceptedPrefixes) {
        for (const t of p.timelines || []) allTimes.push(t);
    }
    if (allTimes.length === 0) return null;

    let firstSeen = allTimes[0].starttime;
    let lastSeen = allTimes[0].endtime;
    let maxPeers = 0;
    for (const t of allTimes) {
        if (t.starttime < firstSeen) firstSeen = t.starttime;
        if (t.endtime > lastSeen) lastSeen = t.endtime;
        if ((t.full_peers_seeing || 0) > maxPeers) maxPeers = t.full_peers_seeing;
    }

    if (maxPeers < MIN_PEERS) return null;

    return {
        asn: String(entry.origin),
        org: null,
        firstSeen,
        lastSeen,
        peers: Math.round(maxPeers),
        prefixes: acceptedPrefixes.map(p => p.prefix),
    };
}

// Holder is typically "<HANDLE> - <Company>, <CC>"; strip the leading handle.
function extractOrgFromHolder(holder) {
    if (!holder || typeof holder !== 'string') return null;
    const dashIdx = holder.indexOf(' - ');
    return dashIdx > 0 ? holder.slice(dashIdx + 3).trim() : holder.trim();
}

// Best-effort. Any failure (timeout, non-2xx, parse error) yields null so the
// parent Promise.all never rejects and the row falls back to ASN-only display.
async function fetchAsOrgName(asn) {
    try {
        const url = `https://stat.ripe.net/data/as-overview/data.json`
            + `?resource=AS${encodeURIComponent(asn)}&sourceapp=${SOURCE_APP}`;
        const res = await fetchUpstream(url, { timeoutMs: ORG_FETCH_TIMEOUT_MS });
        if (!res.ok) return null;
        const payload = await res.json();
        return extractOrgFromHolder(payload?.data?.holder);
    } catch (error) {
        logger.warn({ err: error, asn }, 'as-overview lookup failed');
        return null;
    }
}

export default async (req, res) => {
    // Prefix presence + validity guaranteed by requireValidPrefix middleware.
    // Frontend quantizes the user's IP to /24 (v4) or /48 (v6) so every IP in
    // the same prefix collapses to one cache entry at CF's edge.
    const prefix = req.query.prefix;
    const family = prefix.includes(':') ? 'v6' : 'v4';
    const minLen = MIN_PREFIX[family];

    try {
        const url = `https://stat.ripe.net/data/routing-history/data.json`
            + `?resource=${encodeURIComponent(prefix)}&sourceapp=${SOURCE_APP}`;
        const apiRes = await fetchUpstream(url);
        if (!apiRes.ok) {
            logger.warn({ prefix, status: apiRes.status }, 'RIPEstat routing-history non-2xx');
            return res.status(502).json({ error: 'Upstream error' });
        }
        const payload = await apiRes.json();
        const origins = payload?.data?.by_origin || [];

        const history = origins
            .map(entry => summarizeOrigin(entry, minLen))
            .filter(Boolean)
            .sort((a, b) => (b.lastSeen || '').localeCompare(a.lastSeen || ''));

        // Org enrichment is strictly best-effort: anything that goes wrong here
        // leaves rows with org=null, but the ASN-keyed timeline still ships.
        try {
            const uniqueAsns = [...new Set(history.map(row => row.asn))];
            const orgPairs = await Promise.all(
                uniqueAsns.map(async asn => [asn, await fetchAsOrgName(asn)])
            );
            const orgByAsn = Object.fromEntries(orgPairs);
            for (const row of history) {
                row.org = orgByAsn[row.asn] || null;
            }
        } catch (error) {
            logger.warn({ err: error, prefix }, 'as-overview batch failed; returning ASN-only history');
        }

        res.json({ prefix, history });
    } catch (error) {
        logger.error({ err: error, prefix }, 'asn-history handler failed');
        res.status(500).json({ error: error.message });
    }
};
