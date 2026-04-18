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

// Back-end preset: 8s default for server-to-server upstream calls.
export const fetchUpstream = (url, init = {}) =>
    fetchWithTimeout(url, { timeoutMs: 8000, ...init });
