// edns.ip-api.com — a fresh ~30-char subdomain on `edns.ip-api.com` forces a
// unique DNS lookup upstream; the resolver's outbound IP comes back in
// `data.dns.ip`. See https://ip-api.com/docs/dns
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const generatePrefix = () => {
    const unixTime = Date.now().toString();
    const fixedString = 'jason5ng32';
    const randomString = Math.random().toString(36).substring(2, 11);
    return unixTime + fixedString + randomString;
};

export const ipApi = {
    id: 'ipapi',
    name: 'ip-api.com',
    async run() {
        const host = `${generatePrefix()}.edns.ip-api.com`;
        const response = await fetchWithTimeout(`https://${host}/json`);
        if (!response.ok) throw new Error('ipapi: response not ok');
        const data = await response.json();
        if (!data?.dns?.ip) throw new Error('ipapi: missing dns.ip');
        return { ip: data.dns.ip };
    },
};
