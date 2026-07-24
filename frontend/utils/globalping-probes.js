// Session-cached lookup of which countries currently have online Globalping
// probes. Drives CensorshipCheck's "add to realtime verification" buttons:
// a country without probes gets a disabled button up front instead of a
// dead-end measurement. The list changes slowly, so one fetch per session
// is plenty; a failed fetch clears the cache so the next call can retry,
// and callers treat "unknown" as available (fail-open — Globalping's
// partial allocation just skips locations it can't fill).

import { fetchWithTimeout } from './fetch-with-timeout.js';

const PROBES_URL = 'https://api.globalping.io/v1/probes';
const REQUEST_TIMEOUT_MS = 10000;

let probeCountriesPromise = null;

export const getProbeCountries = () => {
    if (!probeCountriesPromise) {
        probeCountriesPromise = (async () => {
            const response = await fetchWithTimeout(PROBES_URL, { timeoutMs: REQUEST_TIMEOUT_MS });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const probes = await response.json();
            return new Set(
                (Array.isArray(probes) ? probes : [])
                    .map((p) => p?.location?.country)
                    .filter(Boolean)
            );
        })().catch((err) => {
            probeCountriesPromise = null;
            throw err;
        });
    }
    return probeCountriesPromise;
};
