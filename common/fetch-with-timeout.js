// Single-source fetch wrapper with an AbortController-based timeout.
// Shared by both front-end (imported via a thin re-export at
// frontend/utils/fetch-with-timeout.js) and back-end API handlers.
//
// Two named exports:
//   - fetchWithTimeout(url, init)  — default 5s timeout. Front-end default,
//     suits client-to-server latency.
//   - fetchUpstream(url, init)     — default 8s timeout. Back-end preset for
//     server-to-server calls into third-party IP / ASN / map providers.
//
// Both accept a `timeoutMs` in init to override, and both chain any
// caller-provided `signal` so aborting either one aborts the underlying
// fetch. Timeouts surface as AbortError — callers already handle that
// via try/catch. Written without AbortSignal.timeout() for broader
// browser compatibility.

export async function fetchWithTimeout(url, init = {}) {
    const { timeoutMs = 5000, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const callerSignal = rest.signal;
    if (callerSignal) {
        if (callerSignal.aborted) {
            controller.abort();
        } else {
            callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    try {
        return await fetch(url, { ...rest, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// Optional User-Agent for fetchUpstream calls. Backend boot injects a
// project-identifying UA (see common/upstream-ua.js) because some upstream
// WAFs hard-block undici's default `User-Agent: node`. Injection keeps this
// file browser-safe: the frontend bundle never touches fs / process.
let upstreamUserAgent = null;

export const setUpstreamUserAgent = (ua) => {
    upstreamUserAgent = ua || null;
};

// True when caller-supplied headers already carry a User-Agent (any casing;
// plain object or Headers instance) — pass-through handlers forward the
// visitor's headers and must not have them overridden or duplicated. The
// array-of-pairs headers form isn't used in this repo; treat it as opting
// out of injection rather than attempting a merge.
const headersCarryUA = (h) => {
    if (!h) return false;
    if (typeof h.has === 'function') return h.has('user-agent');
    if (Array.isArray(h)) return true;
    return Object.keys(h).some((k) => k.toLowerCase() === 'user-agent');
};

// Back-end preset: 8s default for server-to-server upstream calls, plus the
// default User-Agent above unless the caller already set one.
export const fetchUpstream = (url, init = {}) => {
    const headers = upstreamUserAgent && !headersCarryUA(init.headers)
        ? { ...init.headers, 'User-Agent': upstreamUserAgent }
        : init.headers;
    return fetchWithTimeout(url, { timeoutMs: 8000, ...init, headers });
};
