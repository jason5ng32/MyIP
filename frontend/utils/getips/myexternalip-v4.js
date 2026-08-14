// MyExternalIP IPv4 — ipv4.myexternalip.com JSON endpoint. Fallback hop for
// the Cloudflare IPv4 chain in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const myExternalIPV4 = {
    id: 'myexternalip-v4',
    name: 'MyExternalIP IPv4',
    run: async () => {
        const response = await fetchWithTimeout('https://ipv4.myexternalip.com/json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    },
};
