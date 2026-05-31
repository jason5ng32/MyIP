// browserleaks.net — fresh 12-char token on `.dns4.browserleaks.net` forces
// a unique DNS lookup. The response keys are the resolver IPs themselves;
// each value is a metadata array (which we ignore here, the homepage card
// only displays the IP and we re-do geo via MaxMind).
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const TOKEN_LENGTH = 12;
const HOST_SUFFIX = '.dns4.browserleaks.net';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const generateToken = () => {
    const bytes = new Uint8Array(TOKEN_LENGTH);
    crypto.getRandomValues(bytes);
    let token = '';
    for (let i = 0; i < TOKEN_LENGTH; i++) {
        token += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return token;
};

const pickIp = (data) => {
    if (!data || typeof data !== 'object') return null;
    const ips = Object.keys(data).filter(
        (ip) => Array.isArray(data[ip]) && data[ip].length > 0,
    );
    if (!ips.length) return null;
    ips.sort();
    return ips[0];
};

export const browserleaks = {
    id: 'browserleaks',
    name: 'browserleaks.net',
    async run() {
        const host = `${generateToken()}${HOST_SUFFIX}`;
        const response = await fetchWithTimeout(`https://${host}/`);
        if (!response.ok) throw new Error('browserleaks: response not ok');
        const data = await response.json();
        const ip = pickIp(data);
        if (!ip) throw new Error('browserleaks: no IP in response');
        return { ip };
    },
};
