// bash.ws — a client-chosen session id becomes a wildcard zone: loading any
// `*.<id>.bash.ws` URL forces a DNS lookup (the fetch itself fails on TLS,
// which is fine), then `/dnsleak/test/<id>?json` lists what its resolver
// saw: `[{ ip, type: 'ip' | 'dns' | 'conclusion', ... }]`.
import { fetchWithTimeout } from '../fetch-with-timeout.js';

const ID_LENGTH = 20;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const generateId = () => {
    const bytes = new Uint8Array(ID_LENGTH);
    crypto.getRandomValues(bytes);
    let id = '';
    for (let i = 0; i < ID_LENGTH; i++) {
        id += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return id;
};

// First entry the upstream tagged as a resolver (`type: 'dns'`).
export const pickDnsIp = (entries) => {
    if (!Array.isArray(entries)) return null;
    const hit = entries.find((entry) => entry?.type === 'dns' && typeof entry.ip === 'string');
    return hit ? hit.ip : null;
};

export const bashws = {
    id: 'bashws',
    name: 'bash.ws',
    async run() {
        const id = generateId();
        // Trigger only — the certificate does not cover this depth, so the
        // request errors after the lookup has already reached upstream.
        await fetchWithTimeout(`https://ex.1.${id}.bash.ws/css/z.css`, {
            mode: 'no-cors',
            timeoutMs: 2500,
        }).catch(() => {});
        const response = await fetchWithTimeout(`https://bash.ws/dnsleak/test/${id}?json`);
        if (!response.ok) throw new Error('bashws: response not ok');
        const data = await response.json();
        const ip = pickDnsIp(data);
        if (!ip) throw new Error('bashws: no resolver IP in response');
        return { ip };
    },
};
