// ipleak.net — fresh 40-char session subdomain on `-1.ipleak.net` forces a
// unique DNS resolution. Response is `{ ip: { "<ip1>": <count>, ... } }`;
// the IP with the highest hit count is the resolver we report.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const SESSION_LENGTH = 40;
const HOST_SUFFIX = '-1.ipleak.net';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const generateSession = () => {
    const bytes = new Uint8Array(SESSION_LENGTH);
    crypto.getRandomValues(bytes);
    let session = '';
    for (let i = 0; i < SESSION_LENGTH; i++) {
        session += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return session;
};

const pickTopIp = (ipMap) => {
    if (!ipMap || typeof ipMap !== 'object') return null;
    let topIp = null;
    let topCount = -1;
    for (const [ip, count] of Object.entries(ipMap)) {
        const n = Number(count);
        if (!Number.isFinite(n) || n <= topCount) continue;
        topCount = n;
        topIp = ip;
    }
    return topIp;
};

export const ipleak = {
    id: 'ipleak',
    name: 'ipleak.net',
    async run() {
        const host = `${generateSession()}${HOST_SUFFIX}`;
        const response = await fetchWithTimeout(`https://${host}/dnsdetection/`);
        if (!response.ok) throw new Error('ipleak: response not ok');
        const data = await response.json();
        const ip = pickTopIp(data?.ip);
        if (!ip) throw new Error('ipleak: no IP in response');
        return { ip };
    },
};
