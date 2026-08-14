// Cloudflare IPv4 — hits 1.0.0.1/cdn-cgi/trace and reads `ip=` from the
// trace body. Chained ahead of MyExternalIP IPv4 in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../parse-trace.js';

export const cloudflareV4 = {
    id: 'cloudflare-v4',
    name: 'Cloudflare IPv4',
    run: async () => {
        const response = await fetchWithTimeout('https://1.0.0.1/cdn-cgi/trace');
        const data = await response.text();
        return parseTrace(data).ip ?? '';
    },
};
