// IPCheck.ing IPv4 — resolves via 4.ipcheck.ing. On the original site the
// JSON endpoint is preferred (trace as internal fallback); mirrors go
// straight to trace. Chained ahead of IPify IPv4 in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../parse-trace.js';

const getFromTrace = async () => {
    const response = await fetchWithTimeout('https://4.ipcheck.ing/cdn-cgi/trace');
    const data = await response.text();
    return parseTrace(data).ip ?? '';
};

const getFromJson = async () => {
    try {
        const response = await fetchWithTimeout('https://4.ipcheck.ing');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.warn('Error fetching IP from IPCheck.ing IPv4 JSON:', error);
        return getFromTrace();
    }
};

export const ipChecking4 = {
    id: 'ipchecking-v4',
    name: 'IPCheck.ing IPv4',
    run: (originalSite) => (originalSite ? getFromJson() : getFromTrace()),
};
