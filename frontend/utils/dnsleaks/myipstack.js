// dns.myipstack.com (hide.me) — a fresh label on `.dns.myipstack.com`
// forces a unique DNS lookup; `/getRemoteAddress?name=<label>` echoes the
// resolver as plain text `proto:ip:port`, e.g. `udp:1.2.3.4:41321`.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const generatePrefix = () => {
    const unixTime = Date.now().toString();
    const fixedString = 'jason5ng32';
    const randomString = Math.random().toString(36).substring(2, 11);
    return unixTime + fixedString + randomString;
};

// `proto:ip:port` → ip; the IP may itself contain colons (IPv6), so split on
// the first and last colon only.
export const parseRemoteAddress = (text) => {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    const first = trimmed.indexOf(':');
    const last = trimmed.lastIndexOf(':');
    if (first < 0 || last <= first) return null;
    const ip = trimmed.slice(first + 1, last);
    return ip || null;
};

export const myipstack = {
    id: 'myipstack',
    name: 'dns.myipstack.com',
    async run() {
        const label = generatePrefix();
        const response = await fetchWithTimeout(
            `https://${label}.dns.myipstack.com/getRemoteAddress?name=${label}`,
        );
        if (!response.ok) throw new Error('myipstack: response not ok');
        const ip = parseRemoteAddress(await response.text());
        if (!ip) throw new Error('myipstack: no IP in response');
        return { ip };
    },
};
