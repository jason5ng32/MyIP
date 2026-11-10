// Client for `/api/asn-history` (RIPEstat routing history per BGP prefix),
// used by IpAsnBlock. Fills an owner's session cache keyed by the prefix:
// the response body on success, `{ error: true }` on failure — the shape
// ASNHistory.vue reads.
//
// Relative imports keep this file importable from the Node test runner.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const asnHistoryUrl = (prefix) => `/api/asn-history?prefix=${encodeURIComponent(prefix)}`;

// Fetch `prefix` ('1.1.1.0/24') into `cache` unless already there; resolves
// to the cache entry. Non-2xx answers and network failures are cached as
// `{ error: true }`.
export const loadAsnHistoryInto = async (cache, prefix) => {
    try {
        if (cache[prefix]) return cache[prefix];
        // RIPEstat routing-history is a slow analytical endpoint (10–20s on
        // cold prefixes). Backend caps it at 25s; browser waits 26s so the
        // server's 504 surfaces instead of the browser aborting first.
        const response = await fetchWithTimeout(asnHistoryUrl(prefix), { timeoutMs: 26000 });
        cache[prefix] = response.ok ? await response.json() : { error: true };
    } catch (error) {
        console.error('Error fetching ASN history:', error);
        cache[prefix] = { error: true };
    }
    return cache[prefix];
};
