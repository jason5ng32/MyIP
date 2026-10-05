// Pure helpers for the ASN Profile tool: announced-space sizing over a
// prefix list. CIDR arithmetic comes from ip-math.js.

import { parseCidr, aggregateCidrs, addressCount } from './ip-math.js';

const IPV4_SPACE = 2 ** 32;

// Size of one prefix: IPv4 in addresses, IPv6 in /48s (the longest prefix
// the global table carries). A v6 prefix longer than /48 has count null.
// Invalid input → null.
export const prefixSize = (cidr) => {
    const parsed = parseCidr(typeof cidr === 'string' ? cidr.trim() : cidr);
    if (!parsed) return null;
    const { family, prefix } = parsed;
    if (family === 4) return { family, prefix, count: 2 ** (32 - prefix) };
    return { family, prefix, count: prefix <= 48 ? 2 ** (48 - prefix) : null };
};

// Distinct IPv4 addresses a prefix list covers. Overlaps (a covering route
// plus its more-specifics) count once; IPv6 and junk entries are ignored.
export const announcedIpv4 = (prefixes) => aggregateCidrs(prefixes).v4
    .reduce((sum, cidr) => sum + Number(addressCount(parseCidr(cidr).prefix, 4)), 0);

// Share of the whole IPv4 space (2^32), as a percentage.
export const ipv4SharePercent = (addresses) => {
    const count = Number(addresses);
    if (!Number.isFinite(count) || count <= 0) return 0;
    return (Math.min(count, IPV4_SPACE) / IPV4_SPACE) * 100;
};
