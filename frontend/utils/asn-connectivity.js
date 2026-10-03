// Client for `/api/asn-connectivity` (CAIDA topology + neighbour lists),
// used by IpDetailPanel. Fills an owner's session cache keyed by the numeric ASN
// string: `{ graph }` on success, `{ error: true }` on failure — the shape
// ASNConnectivity.vue reads.
//
// Relative imports keep this file importable from the Node test runner.
import { fetchWithTimeout } from './fetch-with-timeout.js';

// Cache-buster: bump on graph algorithm / schema changes. The route sits
// behind a 30-day max-age that caches in browsers too, where no purge reaches.
export const ASN_CONNECTIVITY_VERSION = 5;

export const asnConnectivityUrl = (asn) =>
    `/api/asn-connectivity?asn=${encodeURIComponent(asn)}&v=${ASN_CONNECTIVITY_VERSION}`;

// Fetch `asn` ('13335') into `cache` unless already there; resolves to the
// cache entry. Failures are cached as `{ error: true }`.
export const loadAsnConnectivityInto = async (cache, asn) => {
    if (cache[asn]) return cache[asn];
    try {
        // The backend is a sub-ms local lookup; a tight cap is fine.
        const response = await fetchWithTimeout(asnConnectivityUrl(asn), { timeoutMs: 5000 });
        cache[asn] = response.ok ? { graph: await response.json() } : { error: true };
    } catch (error) {
        console.error('Error fetching ASN connectivity:', error);
        cache[asn] = { error: true };
    }
    return cache[asn];
};
