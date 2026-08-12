// IPCheck.ing IPv6/4 — resolves via 64.ipcheck.ing (answers with whichever
// stack the visitor reaches it on). On the original site the JSON endpoint
// is preferred (trace as internal fallback); mirrors go straight to trace.
// Runs as a single-hop chain in index.js — no external fallback.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../parse-trace.js';

const getFromTrace = async () => {
    const response = await fetchWithTimeout('https://64.ipcheck.ing/cdn-cgi/trace');
    const data = await response.text();
    return parseTrace(data).ip ?? '';
};

const getFromJson = async () => {
    try {
        const response = await fetchWithTimeout('https://64.ipcheck.ing');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('Error fetching IP from IPCheck.ing IPv6/4 JSON:', error);
        return getFromTrace();
    }
};

export const ipChecking64 = {
    id: 'ipchecking-64',
    name: 'IPCheck.ing IPv6/4',
    run: (originalSite) => (originalSite ? getFromJson() : getFromTrace()),
};
