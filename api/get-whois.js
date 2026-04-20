import whoiser from 'whoiser';
import { isValidIP } from '../common/valid-ip.js';
import { rdapDomain } from '../common/rdap.js';

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
    if (!query) {
        return res.status(400).json({ error: 'No address provided' });
    }
    if (!isValidIP(query) && !isValidDomain(query)) {
        return res.status(400).json({ error: 'Invalid IP or address' });
    }

    if (isValidIP(query)) {
        try {
            const ipinfo = await whoiser.ip(query, { timeout: 5000, raw: true });
            return res.json(ipinfo);
        } catch (e) {
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
        return res.status(500).json({ error: e.message });
    }
};
