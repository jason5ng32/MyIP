// MyExternalIP IPv6 — ipv6.myexternalip.com JSON endpoint. Fallback hop for
// the Cloudflare IPv6 chain in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const myExternalIPV6 = {
    id: 'myexternalip-v6',
    name: 'MyExternalIP IPv6',
    run: async () => {
        const response = await fetchWithTimeout('https://ipv6.myexternalip.com/json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    },
};
