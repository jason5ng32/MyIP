// BGP-prefix helpers. Routing on the public internet happens at prefix
// granularity, not per-IP — the default-free zone won't accept anything
// smaller than /24 (IPv4) or /48 (IPv6). Quantizing a query IP down to
// that floor before hitting the upstream lets Cloudflare's edge dedupe
// asn-history responses across every IP in the same prefix.

import { isValidIP } from './valid-ip.js';

const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;

// Expand an IPv6 address (with optional `::` compression) into 8 hextet
// strings. Returns null on any structural failure.
function expandIPv6(ip) {
    const halves = ip.split('::');
    if (halves.length > 2) return null;

    const hasShorthand = halves.length === 2;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = hasShorthand && halves[1] ? halves[1].split(':') : [];
    const explicit = left.length + right.length;

    if (!hasShorthand && explicit !== 8) return null;
    if (hasShorthand && explicit > 7) return null; // `::` must elide at least one group

    const gap = hasShorthand ? 8 - explicit : 0;
    const hextets = [...left, ...Array(gap).fill('0'), ...right];

    if (hextets.length !== 8) return null;
    return hextets.every(h => HEX_GROUP.test(h)) ? hextets : null;
}

/**
 * Quantize a single IP to its BGP DFZ floor prefix.
 *   IPv4 → /24 (e.g. `8.8.8.8` → `8.8.8.0/24`)
 *   IPv6 → /48 (e.g. `2001:4860:4860::8888` → `2001:4860:4860::/48`)
 * Returns null when input is not a recognizable IP.
 */
export function toBgpPrefix(ip) {
    if (!isValidIP(ip)) return null;

    if (ip.includes('.') && !ip.includes(':')) {
        const [a, b, c] = ip.split('.');
        return `${a}.${b}.${c}.0/24`;
    }

    const hextets = expandIPv6(ip);
    if (!hextets) return null;
    // Canonicalize each kept hextet to lowercase without leading zeros so
    // semantically identical inputs map to the same cache key. `0x0001` and
    // `1` would otherwise collide as different URLs at the CF edge.
    const first3 = hextets.slice(0, 3).map(h => parseInt(h, 16).toString(16));
    return `${first3[0]}:${first3[1]}:${first3[2]}::/48`;
}

/**
 * Accept any well-formed CIDR string (IP + length within family bounds).
 * Intentionally not strict about the specific length — the frontend decides
 * the quantization policy; the guard just rejects junk.
 */
export function isValidBgpPrefix(prefix) {
    if (typeof prefix !== 'string') return false;
    const slash = prefix.indexOf('/');
    if (slash <= 0 || slash === prefix.length - 1) return false;

    const address = prefix.slice(0, slash);
    const lengthStr = prefix.slice(slash + 1);
    if (!/^\d+$/.test(lengthStr)) return false;

    if (!isValidIP(address)) return false;

    const length = Number(lengthStr);
    const isV6 = address.includes(':');
    const max = isV6 ? 128 : 32;
    return length >= 0 && length <= max;
}
