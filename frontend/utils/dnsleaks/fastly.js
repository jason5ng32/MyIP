// fastly-analytics.com — a fresh prefix on `.u.fastly-analytics.com` forces a
// unique DNS lookup upstream; `/debug_resolver` echoes back the resolver's
// outbound IP in `dns_resolver_info.ip` (client info in `client_ip_info`,
// which we ignore — the homepage card re-does geo via MaxMind).
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const generatePrefix = () => {
    const unixTime = Date.now().toString();
    const fixedString = 'jason5ng32';
    const randomString = Math.random().toString(36).substring(2, 11);
    return unixTime + fixedString + randomString;
};

export const fastly = {
    id: 'fastly',
    name: 'fastly.com',
    async run() {
        const host = `${generatePrefix()}.u.fastly-analytics.com`;
        const response = await fetchWithTimeout(`https://${host}/debug_resolver`);
        if (!response.ok) throw new Error('fastly: response not ok');
        const data = await response.json();
        if (!data?.dns_resolver_info?.ip) throw new Error('fastly: missing dns_resolver_info.ip');
        return { ip: data.dns_resolver_info.ip };
    },
};
