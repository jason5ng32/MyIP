// IPIP.net — myip.ipip.net JSON endpoint, dual-stack answer. Chained ahead
// of Upai in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const ipipNet = {
    id: 'ipip',
    name: 'IPIP.net',
    run: async () => {
        const response = await fetchWithTimeout('https://myip.ipip.net/json');
        const data = await response.json();
        return data.data.ip;
    },
};
