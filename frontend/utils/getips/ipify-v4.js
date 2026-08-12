// IPify IPv4 — api4.ipify.org JSON endpoint. Fallback hop for the
// IPCheck.ing IPv4 chain in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const ipifyV4 = {
    id: 'ipify-v4',
    name: 'IPify IPv4',
    run: async () => {
        const response = await fetchWithTimeout('https://api4.ipify.org?format=json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    },
};
