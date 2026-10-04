// ASN summary from Cloudflare Radar (`/api/cfradar?view=asn`) with a
// per-owner session cache keyed 'AS<n>'. Owners (IpInfos, QueryIP) each
// create their own cache with useAsnInfo(); IpDetailPanel fills whichever
// cache it is handed through loadAsnInfoInto().
//
// Relative imports keep this file importable from the Node test runner.
import { reactive } from 'vue';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';

// Cache-buster: bump on response-shape changes (sent as `v=`).
export const ASN_INFO_VERSION = 3;

export const asnInfoUrl = (asnNumber) => `/api/cfradar?view=asn&asn=${asnNumber}&v=${ASN_INFO_VERSION}`;

// Fetch `asn` ('AS13335') into `cache` unless already there; resolves to the
// cached body, or null on a network / parse failure or a 503 (the backend's
// "data still loading" during boot) — nothing cached, so the next call
// retries. Any other parsed body is cached, error bodies included.
export const loadAsnInfoInto = async (cache, asn) => {
    try {
        if (cache[asn]) return cache[asn];
        const asnNumber = asn.replace('AS', '');
        const response = await fetchWithTimeout(asnInfoUrl(asnNumber));
        if (response.status === 503) return null;
        const data = await response.json();
        cache['AS' + asnNumber] = data;
        return data;
    } catch (error) {
        console.error('Error fetching ASN info:', error);
        return null;
    }
};

// A fresh session cache (optionally seeded) and a loader bound to it.
export const useAsnInfo = (initial = {}) => {
    const asnInfos = reactive({ ...initial });
    const loadAsnInfo = (asn) => loadAsnInfoInto(asnInfos, asn);
    return { asnInfos, loadAsnInfo };
};
