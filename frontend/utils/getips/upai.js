// Upai — pubstatic.b0.upaiyun.com `_upnode` debug endpoint (timestamped to
// dodge caches). Fallback hop for the IPIP.net chain in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const upai = {
    id: 'upai',
    name: 'Upai',
    run: async () => {
        const url = `https://pubstatic.b0.upaiyun.com/?_upnode&t=${Date.now()}`;
        const response = await fetchWithTimeout(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.remote_addr;
    },
};
