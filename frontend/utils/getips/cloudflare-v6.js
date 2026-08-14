// Cloudflare IPv6 — hits the v6 literal 2606:4700:4700::1111/cdn-cgi/trace
// and reads `ip=` from the trace body. Chained ahead of MyExternalIP IPv6
// in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';
import { parseTrace } from '../parse-trace.js';

export const cloudflareV6 = {
    id: 'cloudflare-v6',
    name: 'Cloudflare IPv6',
    run: async () => {
        const response = await fetchWithTimeout('https://[2606:4700:4700::1111]/cdn-cgi/trace');
        const data = await response.text();
        return parseTrace(data).ip ?? '';
    },
};
