// bash.ws — obtain a session from /id, probe ex.1.<id>.bash.ws once,
// then read the resolvers recorded for that session. Protocol reference:
// https://github.com/macvk/dnsleaktest/blob/master/dnsleaktest.py
import { fetchWithTimeout } from '../fetch-with-timeout.js';

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
        const idResponse = await fetchWithTimeout('https://bash.ws/id');
        if (!idResponse.ok) throw new Error('bashws: ID response not ok');
        const id = (await idResponse.text()).trim();
        if (!/^[a-z0-9]{1,63}$/i.test(id)) throw new Error('bashws: invalid test ID');

        // TLS may fail after DNS resolution; the result endpoint determines
        // whether the probe actually reached the provider.
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
