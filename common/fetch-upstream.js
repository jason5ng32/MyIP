// Shared upstream fetch helper for backend API handlers.
// Mirrors the front-end's frontend/utils/fetch-with-timeout.js pattern but
// lives under common/ since it's used by the Express handlers under api/.
//
// Default timeout is 8s (vs 5s on the front-end) because server-to-server
// latency into third-party IP / ASN / map providers can run higher than
// client-to-server on a good network.
//
// Timeouts surface as AbortError, which callers already handle via their
// try/catch blocks (returning 500 with error.message).

export async function fetchUpstream(url, init = {}) {
    const { timeoutMs = 8000, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Chain the caller's signal if they passed one — aborting either one
    // aborts the underlying fetch.
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
