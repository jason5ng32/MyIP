// Wrapper around fetch that aborts after timeoutMs. Same call shape as fetch,
// with an extra trailing timeout arg. Timeouts surface as AbortError, which
// the getips callers already handle in their try/catch (returning {ip: null}).
//
// Written manually instead of relying on AbortSignal.timeout() so older Safari
// and Firefox (< 100 / < 16) still work.
export function fetchWithTimeout(input, init = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If the caller already passed a signal, chain it — aborting either one
    // aborts the underlying fetch.
    const callerSignal = init.signal;
    if (callerSignal) {
        if (callerSignal.aborted) {
            controller.abort();
        } else {
            callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    return fetch(input, { ...init, signal: controller.signal })
        .finally(() => clearTimeout(timer));
}
