// Builds and sends requests to the IPCheck.ing API.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { SERVICE_ERROR_CODE, AUTH_REASON } from '../common/codes/service-errors.js';

// The only incoming headers that travel upstream.
export const FORWARDED_HEADERS = ['authorization', 'accept-language', 'user-agent', 'cf-connecting-ip', 'x-forwarded-for'];

const FORWARDED = new Set(FORWARDED_HEADERS);

// The listed headers present in `incoming`, keyed in lower case.
export const pickForwardedHeaders = (incoming) => {
    const picked = {};
    for (const [name, value] of Object.entries(incoming ?? {})) {
        const lower = name.toLowerCase();
        if (FORWARDED.has(lower) && value !== undefined) picked[lower] = value;
    }
    return picked;
};

// `${endpoint}${path}` with the system key under `keyParam`, then each
// defined `query` entry, all encoded by URLSearchParams.
export const buildIpCheckingUrl = (endpoint, path, { key, keyParam = 'key', query = {} } = {}) => {
    const url = new URL(`${endpoint}${path}`);
    url.searchParams.set(keyParam, key);
    for (const [name, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(name, String(value));
    }
    return url;
};

const settings = () => ({
    key: process.env.IPCHECKING_API_KEY,
    endpoint: process.env.IPCHECKING_API_ENDPOINT,
});

export const isIpCheckingApiConfigured = () => {
    const { key, endpoint } = settings();
    return Boolean(key && endpoint);
};

// Resolves null without a request when the key or endpoint is missing, else
// the upstream Response as received. `forwardFrom` is the incoming request
// whose listed headers go along; `body` is sent as JSON.
export const requestIpCheckingApi = async (path, {
    keyParam, query, method, body, forwardFrom, timeoutMs,
} = {}) => {
    const { key, endpoint } = settings();
    if (!key || !endpoint) return null;

    const url = buildIpCheckingUrl(endpoint, path, { key, keyParam, query });
    const headers = pickForwardedHeaders(forwardFrom?.headers);
    const init = { headers };
    if (method) init.method = method;
    if (body !== undefined) {
        headers['content-type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    if (timeoutMs) init.timeoutMs = timeoutMs;
    return fetchUpstream(url, init);
};

const DEFAULT_ERROR_TEXT = { 401: 'Sign in required', 403: 'Sign in required', 429: 'Monthly quota exceeded' };

const AUTH_REASONS = new Set(Object.values(AUTH_REASON));

// The uniform body { error, code?, reason? } for a failed upstream Response:
// 401 / 403 → auth, its reason the upstream `code` when it is a known auth
// reason, else sign_in_required; 429 → quota; any other status → no code.
export const ipCheckingApiErrorBody = async (response) => {
    const data = await response.json().catch(() => null);
    const upstreamText = typeof data?.error === 'string' && data.error ? data.error : undefined;
    const error = upstreamText ?? DEFAULT_ERROR_TEXT[response.status] ?? `Upstream status ${response.status}`;
    if (response.status === 401 || response.status === 403) {
        const reason = AUTH_REASONS.has(data?.code) ? data.code : AUTH_REASON.SIGN_IN_REQUIRED;
        return { error, code: SERVICE_ERROR_CODE.AUTH, reason };
    }
    if (response.status === 429) return { error, code: SERVICE_ERROR_CODE.QUOTA };
    return { error };
};
