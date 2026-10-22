// every1dns.net — any fresh label on `.map.help.every1dns.net` forces a
// unique DNS lookup (the record is keyed by that label); the response echoes
// the resolver as `{ ip, protocol, dnssec, isp: { asn, name }, … }`. Only
// `ip` is used — the homepage card re-does geo via MaxMind.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const HOST_SUFFIX = '.map.help.every1dns.net';

export const every1dns = {
    id: 'every1dns',
    name: 'every1dns.net',
    async run() {
        const host = `${crypto.randomUUID()}${HOST_SUFFIX}`;
        const response = await fetchWithTimeout(`https://${host}/`);
        if (!response.ok) throw new Error('every1dns: response not ok');
        const data = await response.json();
        if (typeof data?.ip !== 'string') throw new Error('every1dns: missing ip');
        return { ip: data.ip };
    },
};
