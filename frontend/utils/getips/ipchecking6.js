// IPCheck.ing IPv6 — resolves via 6.ipcheck.ing. The JSON endpoint (trace as
// internal fallback) is reserved for the upstream site; every other
// deployment goes straight to trace. Chained ahead of IPify IPv6 in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../ip/parse-trace.js';

const getFromTrace = async () => {
    const response = await fetchWithTimeout('https://6.ipcheck.ing/cdn-cgi/trace');
    const data = await response.text();
    return parseTrace(data).ip ?? '';
};

const getFromJson = async () => {
    try {
        const response = await fetchWithTimeout('https://6.ipcheck.ing');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('Error fetching IP from IPCheck.ing IPv6 JSON:', error);
        return getFromTrace();
    }
};

export const ipChecking6 = {
    id: 'ipchecking-v6',
    name: 'IPCheck.ing IPv6',
    run: (useJsonEndpoint) => (useJsonEndpoint ? getFromJson() : getFromTrace()),
};
