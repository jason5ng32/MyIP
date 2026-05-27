// Barrel + retry runner for the homepage DNS leak test providers.
//
// Each provider in this directory is a single async function that, on
// every call, generates a fresh subdomain prefix, hits its upstream, and
// returns either { ip, testUrl } or throws. They are stateless and have
// no Vue / store dependency — the consuming component (DnsLeaksTest.vue)
// writes results into its reactive `leakTest[]` array and runs the
// MaxMind geo lookup separately.

export { runIpApi } from './ipapi.js';
export { runSurfshark } from './surfshark.js';
export { runIpleak } from './ipleak.js';
export { runBrowserLeaks } from './browserleaks.js';

// Invoke `provider` up to `attempts` times. Each invocation regenerates
// its subdomain prefix, so retries trigger fresh DNS lookups upstream
// rather than returning cached failures. `opts.onUrl(host)` fires on
// every attempt so the UI can display the host currently being probed.
// Returns the first successful result; throws the last error if all
// attempts failed.
export async function runWithRetry(provider, opts = {}, attempts = 3) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            return await provider(opts);
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
