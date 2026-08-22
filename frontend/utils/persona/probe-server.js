// Where the network says this browser comes from — the one thing a page
// cannot observe about itself. Read from the Cloudflare trace endpoint the
// IP lookup chain already uses; no extra infrastructure in the path.

const TRACE_URL = 'https://cloudflare.com/cdn-cgi/trace';
const TIMEOUT_MS = 6000;

const withTimeout = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { cache: 'no-store', signal: controller.signal, ...options });
    } finally {
        clearTimeout(timer);
    }
};

// key=value lines, one per line.
export const parseTraceBody = (text) => {
    const fields = {};
    for (const line of String(text).split('\n')) {
        const index = line.indexOf('=');
        if (index > 0) fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
    return fields;
};

/**
 * Cloudflare's own verdict on the connection. `loc` is an independent second
 * opinion on the exit country.
 */
export const probeTrace = async () => {
    try {
        const response = await withTimeout(TRACE_URL);
        if (!response.ok) return { available: false, reason: `http-${response.status}` };
        const fields = parseTraceBody(await response.text());
        return {
            available: true,
            country: (fields.loc || '').toUpperCase(),
            colo: fields.colo || '',
            httpProtocol: fields.http || '',
            tlsVersion: fields.tls || '',
        };
    } catch (error) {
        return { available: false, reason: error.name === 'AbortError' ? 'timeout' : 'unreachable' };
    }
};
