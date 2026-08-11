import whoiser from 'whoiser';
import { isValidIP, isPrivateIP } from '../common/valid-ip.js';
import { rdapDomain, rdapIp } from '../common/rdap.js';
import logger from '../common/logger.js';

function isValidDomain(domain) {
    const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainPattern.test(domain);
}

// A whoiser.domain() response is considered usable if at least one of
// its WHOIS-server keys carries a non-empty `__raw` text block. An
// empty object, or one with only metadata but no raw text, means the
// TLD doesn't have a reachable port-43 server (common for newer gTLDs
// like .ing / .app) — that's when we fall back to RDAP.
function domainHasWhoisText(result) {
    if (!result || typeof result !== 'object') return false;
    return Object.values(result).some(
        (v) => v && typeof v === 'object' && typeof v.__raw === 'string' && v.__raw.length > 0,
    );
}

export default async (req, res) => {
    const query = req.query.q;
    // typeof check also rejects the array form (?q=a&q=b) express produces.
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'No address provided' });
    }
    if (!isValidIP(query) && !isValidDomain(query)) {
        return res.status(400).json({ error: 'Invalid IP or address' });
    }
    // Non-public address space has no registry record at all — asking RDAP or
    // WHOIS about it burns an upstream call to earn a guaranteed failure.
    // Visitors pasting their LAN address land here routinely.
    if (isValidIP(query) && isPrivateIP(query)) {
        return res.status(400).json({ error: 'Private or reserved IP address' });
    }

    // IP path: RDAP first — authoritative-RIR HTTPS + JSON, immune to the
    // port-43 referral mess (rwhois://host:port referrals point at a
    // protocol WHOIS clients can't speak). whoiser stays as fallback,
    // pinned to one hop (`follow: 1`) so it never chases a referral.
    if (isValidIP(query)) {
        try {
            return res.json(await rdapIp(query));
        } catch (e) {
            logger.warn({ err: e, query }, 'whois: RDAP IP lookup failed, trying WHOIS');
        }
        try {
            const ipinfo = await whoiser.ip(query, { timeout: 5000, follow: 1, raw: true });
            return res.json(ipinfo);
        } catch (e) {
            logger.error({ err: e, query }, 'Failed to get IP info');
            return res.status(500).json({ error: e.message });
        }
    }

    // Domain path: whoiser first (rich port-43 data for legacy gTLDs),
    // fall back to RDAP only when whoiser returned nothing useful.
    let domaininfo = null;
    try {
        domaininfo = await whoiser.domain(query, {
            ignorePrivacy: false,
            timeout: 5000,
            follow: 2,
            raw: true,
        });
    } catch {
        // Swallow — we'll attempt RDAP next; only bubble up if that
        // fails too.
    }

    if (domainHasWhoisText(domaininfo)) {
        return res.json(domaininfo);
    }

    try {
        const rdap = await rdapDomain(query);
        return res.json(rdap);
    } catch (e) {
        if (e.message.startsWith('No RDAP endpoint for ')) {
            logger.warn({ query }, 'whois: TLD has no RDAP endpoint');
            return res.status(404).json({ error: e.message });
        }
        logger.error({ err: e, query }, 'Failed to get RDAP info');
        return res.status(500).json({ error: e.message });
    }
};
