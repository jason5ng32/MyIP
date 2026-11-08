// POST /api/bulk-lookup — geolocation for up to 200 IPs per call, for the Bulk
// IP Lookup tool. Body `{ ips, lang }`; answers `{ source: { id, build },
// results }` from the local source in server/bulk-lookup-sources.js.
import { isUsablePublicIP } from '../common/valid-ip.js';
import { BULK_LOOKUP_MAX_IPS } from '../common/bulk-lookup-limits.js';
import { bulkLookupSource } from '../server/bulk-lookup-sources.js';
import logger from '../server/logger.js';

const MAX_IP_LENGTH = 45; // longest IPv6 text form (IPv4-mapped, full)
const MAX_LANG_LENGTH = 35;

const orNull = (value) => (value === undefined || value === null || value === 'N/A' || value === '' ? null : value);

// The fields the tool stores per row; localized names come in `lang`.
const compactResult = (ip, data) => ({
    ip,
    country: orNull(data.country_code),
    city: orNull(data.city),
    region: orNull(data.region),
    latitude: orNull(data.latitude),
    longitude: orNull(data.longitude),
    asn: orNull(data.asn),
    org: orNull(data.org),
});

// The page extracts, normalizes and dedupes before posting, so anything but a
// clean list of distinct public IPs is refused whole — nothing is cleaned here.
const isCleanIP = (ip) => typeof ip === 'string' && ip.length <= MAX_IP_LENGTH && isUsablePublicIP(ip);

export const createBulkLookup = (getSource = bulkLookupSource) => (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { ips, lang } = req.body ?? {};
    if (!Array.isArray(ips) || ips.length === 0 || ips.length > BULK_LOOKUP_MAX_IPS) {
        return res.status(400).json({ error: `ips must be an array of 1-${BULK_LOOKUP_MAX_IPS} IPs` });
    }
    if (!ips.every(isCleanIP)) {
        return res.status(400).json({ error: 'ips must all be public IPs' });
    }
    if (new Set(ips).size !== ips.length) {
        return res.status(400).json({ error: 'ips must not repeat' });
    }
    if (lang !== undefined && (typeof lang !== 'string' || lang.length > MAX_LANG_LENGTH)) {
        return res.status(400).json({ error: 'Invalid lang' });
    }

    const source = getSource();
    const results = [];
    let logged = false;
    for (const ip of ips) {
        try {
            results.push(compactResult(ip, source.lookup(ip, lang)));
        } catch (error) {
            // Data not loaded: the whole batch would fail the same way.
            if (error.statusCode === 503) {
                return res.status(503).json({ error: error.message });
            }
            if (!logged) logger.error({ err: error, ip, source: source.id }, 'bulk lookup failed for an IP');
            logged = true;
        }
    }

    res.json({ source: { id: source.id, build: source.build?.() ?? null }, results });
};

export default createBulkLookup();
