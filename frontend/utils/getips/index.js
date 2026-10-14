// Chain runner + public entry points for the homepage IP-card sources.
//
// Each source in this directory is a self-describing provider:
//   { id, name, run(originalSite) }
// where `run()` hits one upstream and resolves to the raw IP string (or
// throws). Validation and fallback live HERE, not in the providers: every
// hop is gated by isValidIP, and an upstream that answers with garbage is
// treated exactly like one that failed — the chain advances to the next
// provider. Per-hop failures stay console.warn on purpose (invisible to
// Sentry); the health signal is the ip-source:exhausted event the consuming
// card emits when a whole chain comes back empty.
//
// Contract with IpInfos.vue: each getIPFromXxx resolves to `{ ip, source }`
// where `source` is the display name of the winning provider, and never
// throws — an exhausted chain resolves `{ ip: null, source }` carrying the
// last provider's name.
import { isValidIP, isIPv6 } from '../valid-ip.js';
import { ipChecking4 } from './ipchecking4.js';
import { ipChecking6 } from './ipchecking6.js';
import { ipChecking64 } from './ipchecking64.js';
import { cloudflareV4 } from './cloudflare-v4.js';
import { cloudflareV6 } from './cloudflare-v6.js';
import { ipifyV4 } from './ipify-v4.js';
import { ipifyV6 } from './ipify-v6.js';
import { myExternalIPV4 } from './myexternalip-v4.js';
import { myExternalIPV6 } from './myexternalip-v6.js';
import { ipipNet } from './ipipnet.js';
import { upai } from './upai.js';

const isIPv4 = (ip) => isValidIP(ip) && !isIPv6(ip);
const isOnlyIPv6 = (ip) => isValidIP(ip) && isIPv6(ip);

// Walk the providers in order; first hop whose IP passes validator wins.
export const runChain = async (providers, originalSite, validator = isValidIP) => {
    for (const provider of providers) {
        try {
            const ip = await provider.run(originalSite);
            if (validator(ip)) return { ip, source: provider.name };
            console.warn(`Invalid IP from ${provider.name}:`, ip);
        } catch (error) {
            console.warn(`Error fetching IP from ${provider.name}:`, error);
        }
    }
    return { ip: null, source: providers[providers.length - 1].name };
};

export const getIPFromIPChecking4 = (originalSite) => runChain([ipChecking4, cloudflareV4, ipifyV4, myExternalIPV4], originalSite, isIPv4);
export const getIPFromIPChecking6 = (originalSite) => runChain([ipChecking6, ipifyV6], originalSite, isOnlyIPv6);
export const getIPFromIPChecking64 = (originalSite) => runChain([ipChecking64], originalSite);
export const getIPFromCloudflare_V4 = (originalSite) => runChain([cloudflareV4, myExternalIPV4], originalSite, isIPv4);
export const getIPFromCloudflare_V6 = (originalSite) => runChain([cloudflareV6, myExternalIPV6], originalSite, isOnlyIPv6);
export const getIPFromIPIP = (originalSite) => runChain([ipipNet, upai], originalSite);
