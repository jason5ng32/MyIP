// Visit beacon + endpoint config for the "Earth Online" feature.
//
// PULSE_URL is the full URL of the pulse backend from build-time
// env; unset disables the feature entirely (no entry point, no requests).
// The beacon fires once per page load from App.vue — an app-level concern,
// deliberately NOT tied to any component: every route (homepage, standalone
// tools, /privacy) counts.
//
// Hard guarantee: this call must never affect the rest of the app. It is
// fire-and-forget (never awaited), rejections are swallowed, the outer
// try/catch blocks any synchronous throw, and the request is idle-scheduled
// so it can't even compete with the app's own boot fetches.
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';

export const PULSE_URL = ((import.meta.env ?? {}).VITE_PULSE_URL || '').replace(/\/+$/, '');
export const isPulseEnabled = Boolean(PULSE_URL);

export const sendVisitBeacon = () => {
    if (!isPulseEnabled) return;
    try {
        const fire = () => {
            fetchWithTimeout(`${PULSE_URL}/beacon`, { method: 'POST', keepalive: true })
                .catch(() => { /* fire-and-forget — the next page load tries again */ });
        };
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fire, { timeout: 3000 });
        } else {
            setTimeout(fire, 1000); // Safari fallback
        }
    } catch {
        /* the beacon is never worth an error */
    }
};
