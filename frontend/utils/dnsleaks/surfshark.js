// surfsharkdns.com — fresh 13-char subdomain on `ipv4.surfsharkdns.com`
// triggers a unique DNS resolution; the resolver IP comes back nested under
// arbitrary numeric keys, e.g. `{ "0": { IP: "1.2.3.4" }, "1": {...} }`.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const generatePrefix = () => {
    const fixedString = 'jn32';
    const randomString = Math.random().toString(36).substring(2, 11);
    return fixedString + randomString;
};

const pickLeakIp = (data) => {
    if (!data || typeof data !== 'object') return null;
    for (const key of Object.keys(data)) {
        if (data[key]?.IP) return data[key].IP;
    }
    return null;
};

export async function runSurfshark({ onUrl } = {}) {
    const host = `${generatePrefix()}.ipv4.surfsharkdns.com`;
    const url = `https://${host}`;
    onUrl?.(host);

    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('surfshark: response not ok');
    const data = await response.json();
    const ip = pickLeakIp(data);
    if (!ip) throw new Error('surfshark: no IP in response');
    return { ip, testUrl: host };
}
