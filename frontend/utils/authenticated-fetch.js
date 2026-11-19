// Authenticated fetch wrapper: attaches the Firebase ID token for /api/* proxy
// calls and enforces a client-side timeout so a hung backend can't pin the
// request open indefinitely. Every caller hits an /api/* proxy whose upstream is
// capped at 8s (fetchUpstream); the 10s client default sits just above that so
// the server's own error surfaces instead of the browser aborting first.
import { useMainStore } from '../store.js';
import { fetchWithTimeout } from './fetch-with-timeout.js';

// Bounded label for a failed authenticatedFetch
export const fetchErrorLabel = (error) => (error?.status ? `HTTP ${error.status}` : 'network');

// Log one IP-geolocation source failing, at the level it deserves: a 403 or a
// reached daily limit (429) is a warning, everything else an error.
export const logSourceFetchFailure = (message, error) => {
    if (error?.status === 403 || error?.status === 429) console.warn(message, error);
    else console.error(message, error);
};

export async function authenticatedFetch(url, method = 'GET', body = null, timeoutMs = 10000) {
    const store = useMainStore();
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : null, // If body is provided, convert it to a JSON string
        timeoutMs,
    };

    // Check if the URL is a proxy API that needs authentication
    const isProxyApi = url.startsWith('/api/');

    if (isProxyApi && store.user) {
        const idToken = await store.user.getIdToken();
        options.headers.Authorization = `Bearer ${idToken}`;
    }

    try {
        // fetchWithTimeout aborts at timeoutMs; the AbortError lands in the catch
        // below, so a stuck request fails fast and the caller can fail over.
        const response = await fetchWithTimeout(url, options);

        if (!response.ok) {
            let errorDetail = '';
            let errorData = null;
            try {
                // Get specific error information
                errorData = await response.json();
                errorDetail = errorData.message || JSON.stringify(errorData);
            } catch {
                errorDetail = response.statusText;
            }
            const httpError = new Error(`HTTP error! Status: ${response.status} - ${errorDetail}`);
            httpError.status = response.status;
            // The body's error code and reason (SERVICE_ERROR_CODE / AUTH_REASON).
            if (typeof errorData?.code === 'string') httpError.code = errorData.code;
            if (typeof errorData?.reason === 'string') httpError.reason = errorData.reason;
            throw httpError;
        }

        return response.json();
    } catch (error) {
        // Timeout aborts keep their identity: rewrapping would hide the
        // AbortError name from sentry-init's beforeSend filter, which drops
        // them as visitor connectivity noise rather than defects.
        if (error.name === 'AbortError') throw error;
        // Status, code and reason ride along on the wrapper so callers can
        // label their log line (fetchErrorLabel) and branch on the code; a
        // network-level failure has none.
        const wrapped = new Error(`Fetch failed: ${error.message}`);
        if (error.status !== undefined) {
            for (const field of ['status', 'code', 'reason']) {
                if (error[field] !== undefined) wrapped[field] = error[field];
            }
        }
        throw wrapped;
    }
}
