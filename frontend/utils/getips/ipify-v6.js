// IPify IPv6 — api6.ipify.org JSON endpoint. Fallback hop for the
// IPCheck.ing IPv6 chain in index.js.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

export const ipifyV6 = {
    id: 'ipify-v6',
    name: 'IPify IPv6',
    run: async () => {
        const response = await fetchWithTimeout('https://api6.ipify.org?format=json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.ip;
    },
};
