// Barrel + retry runner for the homepage DNS leak test providers.
//
// Each provider in this directory is a self-describing object:
//   { id, name, run() }
// where `run()` generates a fresh subdomain prefix, hits the upstream, and
// resolves to `{ ip }` or throws. Providers are stateless and have no Vue /
// store dependency — the consuming component (DnsLeaksTest.vue) iterates a
// list of them, wires results into its reactive `leakTest[]`, and runs the
// MaxMind geo lookup separately.
import { isValidIP } from '../valid-ip.js';

export { ipApi } from './ipapi.js';
export { surfshark } from './surfshark.js';
export { ipleak } from './ipleak.js';
export { browserleaks } from './browserleaks.js';
export { fastly } from './fastly.js';

// Invoke `provider.run()` up to `attempts` times. Because each provider
// regenerates its prefix internally on every call, retries trigger fresh
// DNS lookups upstream rather than returning cached failures. A response
// whose `ip` fails `isValidIP` counts as a failed attempt too — garbage
// must never reach the MaxMind lookup downstream. Returns the first valid
// result; throws the last error if every attempt failed.
export async function runWithRetry(provider, attempts = 3) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            const result = await provider.run();
            if (!isValidIP(result?.ip)) {
                throw new Error(`${provider.id}: invalid IP in response`);
            }
            return result;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError;
}
