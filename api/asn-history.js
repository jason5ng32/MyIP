// /api/asn-history — RIPEstat routing-history for a CIDR prefix (the
// frontend quantizes the user's IP to /24 v4 or /48 v6 first, so all IPs
// in the same prefix collapse to one CF edge cache entry). Org names per
// ASN come from RIPEstat as-overview, fetched in parallel, best-effort.
//
// `peers` is the peak RIS-peer count for a row (raw RIPE observation, not
// global BGP reach). We also emit `peersPct` — each row's peers normalized
// by the response's max — so the UI can show a relative visibility metric
// instead of an absolute count that users might mistake for "the whole
// internet". The max-of-response baseline is a fair proxy for "active RIS
// peers" since well-propagated announcements typically saturate the panel.

import {
    fetchRoutingHistory,
    resolveAsnOrgName,
} from '../common/ripestat.js';
import logger from '../common/logger.js';

const prefixLength = (prefix) => parseInt((prefix || '').split('/')[1], 10);

// BGP-meaningful prefix floor per family. Shorter prefixes are leaks /
// default routes that happen to cover the IP but don't attribute it.
const MIN_PREFIX = { v4: 8, v6: 19 };

// Below this peer count an announcement is route noise / brief misconfig.
const MIN_PEERS = 30;

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

// Two-tier resolver lives in common/ripestat.js. Here we pass a warn hook so
// a failed as-overview fallback stays observable (asn-connectivity omits it
// and stays silent — keep that difference).
const resolveOrgName = (asn) =>
    resolveAsnOrgName(asn, {
        onError: (error) => logger.warn({ err: error, asn }, 'as-overview lookup failed'),
    });

export default async (req, res) => {
    // Prefix presence + validity guaranteed by requireValidPrefix middleware.
    const prefix = req.query.prefix;
    const family = prefix.includes(':') ? 'v6' : 'v4';
    const minLen = MIN_PREFIX[family];

    try {
        const apiRes = await fetchRoutingHistory(prefix);
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

        // Relative visibility: each row's peers / max peers in this response.
        // Most-propagated row is 100%; sparse ones surface as low percentages.
        const peersMax = history.reduce((m, r) => Math.max(m, r.peers), 0);
        for (const row of history) {
            row.peersPct = peersMax > 0 ? Math.round((row.peers / peersMax) * 100) : 0;
        }

        // Org enrichment is strictly best-effort: anything that goes wrong here
        // leaves rows with org=null, but the ASN-keyed timeline still ships.
        try {
            const uniqueAsns = [...new Set(history.map(row => row.asn))];
            const orgPairs = await Promise.all(
                uniqueAsns.map(async asn => [asn, await resolveOrgName(asn)])
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
        // RIPEstat routing-history can exceed our timeout for prefixes with long
        // history — surface that as 504 so it's distinguishable from real 5xx.
        if (error?.name === 'AbortError') {
            logger.warn({ prefix }, 'asn-history upstream timeout');
            return res.status(504).json({ error: 'Upstream timeout' });
        }
        logger.error({ err: error, prefix }, 'asn-history handler failed');
        res.status(500).json({ error: error.message });
    }
};
