// IP address arithmetic shared by the IP Calculator (front-end) and rdap.js's
// CIDR containment (back-end). Both families are BigInt: 32-bit `<<` goes
// negative on 240.0.0.0, and IPv6 counts exceed Number anyway.
//
//   Parsed = { family: 4 | 6, value: bigint }
//   Cidr   = { family, prefix, address, network, aligned }
//
// Every export is pure, never throws, and returns null (false for predicates)
// on unusable input. Parsers are strict — `01.2.3.4` is rejected because
// inet_aton would read the octet as octal; ip-calc.js labels such forms
// instead. No imports, so valid-ip.js could adopt this file without a cycle.

const BITS = { 4: 32, 6: 128 };
const MAX = { 4: (1n << 32n) - 1n, 6: (1n << 128n) - 1n };

const V4_OCTET = /^(0|[1-9]\d{0,2})$/;
const HEX_GROUP = /^[0-9a-fA-F]{1,4}$/;
const V6_CHARS = /^[0-9a-fA-F:.]+$/;

const isFamily = (family) => family === 4 || family === 6;
const isBig = (v) => typeof v === 'bigint';
const inFamily = (value, family) => isBig(value) && value >= 0n && value <= MAX[family];
const isPrefix = (prefix, family) =>
    Number.isInteger(prefix) && prefix >= 0 && prefix <= BITS[family];

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export const parseIPv4 = (str) => {
    if (typeof str !== 'string') return null;
    const parts = str.split('.');
    if (parts.length !== 4) return null;
    let value = 0n;
    for (const part of parts) {
        if (!V4_OCTET.test(part)) return null;
        const n = Number(part);
        if (n > 255) return null;
        value = (value << 8n) | BigInt(n);
    }
    return { family: 4, value };
};

// One `::` at most, 1–4 hex per group, and a dotted-quad tail only as the
// final token (`::ffff:192.0.2.1`), which then stands in for two groups.
export const parseIPv6 = (str) => {
    if (typeof str !== 'string' || str === '' || !V6_CHARS.test(str)) return null;

    let text = str;
    let embeddedV4 = false;
    if (str.includes('.')) {
        const lastColon = str.lastIndexOf(':');
        const tail = str.slice(lastColon + 1);
        if (lastColon < 0 || !tail.includes('.')) return null;
        const quad = parseIPv4(tail);
        if (!quad) return null;
        const hi = (quad.value >> 16n).toString(16);
        const lo = (quad.value & 0xffffn).toString(16);
        text = `${str.slice(0, lastColon + 1)}${hi}:${lo}`;
        embeddedV4 = true;
    }

    const halves = text.split('::');
    if (halves.length > 2) return null;
    const shorthand = halves.length === 2;
    const left = halves[0] === '' ? [] : halves[0].split(':');
    const right = shorthand && halves[1] !== '' ? halves[1].split(':') : [];
    const explicit = left.length + right.length;
    if (shorthand ? explicit > 7 : explicit !== 8) return null;

    const groups = [...left, ...Array(shorthand ? 8 - explicit : 0).fill('0'), ...right];
    let value = 0n;
    for (const group of groups) {
        if (!HEX_GROUP.test(group)) return null;
        value = (value << 16n) | BigInt(parseInt(group, 16));
    }
    return { family: 6, value, embeddedV4 };
};

export const parseIp = (str) => parseIPv4(str) || parseIPv6(str);

export const ipToBigInt = (str) => parseIp(str)?.value ?? null;

// `a.b.c.d/n`, `x::/n`, or (IPv4 only) `a.b.c.d/m.m.m.m` with a contiguous
// dotted mask. Host bits are kept on `address`; `network` has them cleared.
export const parseCidr = (str) => {
    if (typeof str !== 'string') return null;
    const slash = str.indexOf('/');
    if (slash <= 0 || slash !== str.lastIndexOf('/')) return null;
    const parsed = parseIp(str.slice(0, slash));
    if (!parsed) return null;
    const { family, value } = parsed;

    const rhs = str.slice(slash + 1);
    let prefix = null;
    if (/^\d{1,3}$/.test(rhs)) {
        prefix = Number(rhs);
    } else if (family === 4) {
        const mask = parseIPv4(rhs);
        prefix = mask ? maskToPrefix(mask.value, 4) : null;
    }
    if (prefix === null || !isPrefix(prefix, family)) return null;

    const network = value & prefixToMask(prefix, family);
    return { family, prefix, address: value, network, aligned: network === value };
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const toOctets = (value) => {
    if (!inFamily(value, 4)) return null;
    return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 0xffn));
};

export const toHextets = (value) => {
    if (!inFamily(value, 6)) return null;
    return Array.from({ length: 8 }, (_, i) => Number((value >> BigInt((7 - i) * 16)) & 0xffffn));
};

export const formatIPv4 = (value) => toOctets(value)?.join('.') ?? null;

// RFC 5952: lowercase, no leading zeros, the longest run of two or more zero
// groups becomes `::` (first run wins a tie), a lone zero group stays.
export const formatIPv6 = (value, { expanded = false } = {}) => {
    const hextets = toHextets(value);
    if (!hextets) return null;
    if (expanded) return hextets.map((h) => h.toString(16).padStart(4, '0')).join(':');

    let bestStart = -1;
    let bestLen = 0;
    for (let i = 0; i < 8; i += 1) {
        if (hextets[i] !== 0) continue;
        let j = i;
        while (j < 8 && hextets[j] === 0) j += 1;
        if (j - i > bestLen) {
            bestStart = i;
            bestLen = j - i;
        }
        i = j;
    }
    const hex = hextets.map((h) => h.toString(16));
    if (bestLen < 2) return hex.join(':');
    const head = hex.slice(0, bestStart).join(':');
    const tail = hex.slice(bestStart + bestLen).join(':');
    return `${head}::${tail}`;
};

export const formatIp = (parsed) => {
    if (!parsed || !isFamily(parsed.family)) return null;
    return parsed.family === 4 ? formatIPv4(parsed.value) : formatIPv6(parsed.value);
};

export const formatCidr = (cidr, { network = true } = {}) => {
    if (!cidr || !isFamily(cidr.family)) return null;
    const ip = formatIp({ family: cidr.family, value: network ? cidr.network : cidr.address });
    return ip === null ? null : `${ip}/${cidr.prefix}`;
};

/* ------------------------------------------------------------------ */
/* Masks & counts                                                      */
/* ------------------------------------------------------------------ */

export const prefixToMask = (prefix, family) => {
    if (!isFamily(family) || !isPrefix(prefix, family)) return null;
    const bits = BITS[family];
    return ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix);
};

// Null unless the mask is ones followed by zeros.
export const maskToPrefix = (mask, family) => {
    if (!isFamily(family) || !inFamily(mask, family)) return null;
    for (let prefix = 0; prefix <= BITS[family]; prefix += 1) {
        if (prefixToMask(prefix, family) === mask) return prefix;
    }
    return null;
};

export const wildcardMask = (prefix, family) => {
    const mask = prefixToMask(prefix, family);
    return mask === null ? null : MAX[family] ^ mask;
};

export const addressCount = (prefix, family) => {
    if (!isFamily(family) || !isPrefix(prefix, family)) return null;
    return 1n << BigInt(BITS[family] - prefix);
};

// IPv4 loses network + broadcast except on /31 (RFC 3021 point-to-point)
// and /32; IPv6 has no broadcast, every address is assignable.
export const usableCount = (prefix, family) => {
    const count = addressCount(prefix, family);
    if (count === null) return null;
    if (family === 6 || prefix >= 31) return count;
    return count - 2n;
};

// Smallest block that holds `count` addresses (number or bigint).
export const smallestPrefixFor = (count, family) => {
    if (!isFamily(family)) return null;
    let need;
    try {
        need = BigInt(count);
    } catch {
        return null;
    }
    if (need < 1n) return null;
    for (let prefix = BITS[family]; prefix >= 0; prefix -= 1) {
        if (addressCount(prefix, family) >= need) return prefix;
    }
    return null;
};

/* ------------------------------------------------------------------ */
/* Block info                                                          */
/* ------------------------------------------------------------------ */

export const cidrInfo = (str) => {
    const cidr = parseCidr(str);
    if (!cidr) return null;
    const { family, prefix, address, network, aligned } = cidr;
    const mask = prefixToMask(prefix, family);
    const wildcard = wildcardMask(prefix, family);
    const lastAddress = network | wildcard;
    const hostRange = family === 4 && prefix < 31;
    return {
        family,
        prefix,
        cidr: formatCidr(cidr),
        address,
        network,
        broadcast: family === 4 ? lastAddress : null,
        first: hostRange ? network + 1n : network,
        last: hostRange ? lastAddress - 1n : lastAddress,
        lastAddress,
        mask,
        wildcard,
        count: addressCount(prefix, family),
        usable: usableCount(prefix, family),
        aligned,
    };
};

/* ------------------------------------------------------------------ */
/* Containment & ordering                                              */
/* ------------------------------------------------------------------ */

export const prefixContains = (network, prefix, family, value) => {
    if (!isFamily(family) || !isPrefix(prefix, family) || !isBig(network) || !isBig(value)) return false;
    const shift = BigInt(BITS[family] - prefix);
    return (value >> shift) === (network >> shift);
};

export const cidrContains = (cidrStr, ipStr) => {
    const cidr = parseCidr(cidrStr);
    const ip = parseIp(ipStr);
    if (!cidr || !ip || cidr.family !== ip.family) return null;
    return prefixContains(cidr.network, cidr.prefix, cidr.family, ip.value);
};

export const cidrOverlaps = (aStr, bStr) => {
    const a = parseCidr(aStr);
    const b = parseCidr(bStr);
    if (!a || !b || a.family !== b.family) return null;
    return prefixContains(a.network, a.prefix, a.family, b.network)
        || prefixContains(b.network, b.prefix, b.family, a.network);
};

// IPv4 sorts before IPv6; within a family, numerically.
export const compareIps = (a, b) => {
    if (a.family !== b.family) return a.family < b.family ? -1 : 1;
    if (a.value === b.value) return 0;
    return a.value < b.value ? -1 : 1;
};

/* ------------------------------------------------------------------ */
/* Set operations                                                      */
/* ------------------------------------------------------------------ */

// Children of `cidrStr` at `newPrefix`. `total` is exact; `subnets` stops at
// `limit` so a /8 → /32 request never materialises 16M strings.
export const splitCidr = (cidrStr, newPrefix, { limit = 1024 } = {}) => {
    const cidr = parseCidr(cidrStr);
    if (!cidr || !isPrefix(newPrefix, cidr.family) || newPrefix < cidr.prefix) return null;
    const { family, network } = cidr;
    const total = 1n << BigInt(newPrefix - cidr.prefix);
    const size = addressCount(newPrefix, family);
    const emit = total < BigInt(limit) ? Number(total) : limit;
    const subnets = [];
    for (let i = 0n; i < BigInt(emit); i += 1n) {
        subnets.push(`${formatIp({ family, value: network + i * size })}/${newPrefix}`);
    }
    return { family, prefix: newPrefix, total, subnets, truncated: BigInt(emit) < total };
};

const isAligned = (network, prefix, family) =>
    (network & (addressCount(prefix, family) - 1n)) === 0n;

// Minimal covering set per family: bare IPs become host routes, contained
// blocks are absorbed, aligned siblings merge upward (4 × /26 → one /24).
export const aggregateCidrs = (list) => {
    const out = { v4: [], v6: [], invalid: [] };
    if (!Array.isArray(list)) return out;
    const blocks = { 4: [], 6: [] };
    for (const token of list) {
        const text = typeof token === 'string' ? token.trim() : '';
        const cidr = parseCidr(text);
        if (cidr) {
            blocks[cidr.family].push({ network: cidr.network, prefix: cidr.prefix });
            continue;
        }
        const ip = parseIp(text);
        if (ip) {
            blocks[ip.family].push({ network: ip.value, prefix: BITS[ip.family] });
            continue;
        }
        out.invalid.push(token);
    }

    for (const family of [4, 6]) {
        const sorted = blocks[family].sort((a, b) => {
            if (a.network !== b.network) return a.network < b.network ? -1 : 1;
            return a.prefix - b.prefix;
        });
        const stack = [];
        for (const block of sorted) {
            const top = stack[stack.length - 1];
            if (top && top.prefix <= block.prefix
                && prefixContains(top.network, top.prefix, family, block.network)) continue;
            stack.push(block);
            while (stack.length >= 2) {
                const a = stack[stack.length - 2];
                const b = stack[stack.length - 1];
                const size = addressCount(a.prefix, family);
                if (a.prefix === 0 || a.prefix !== b.prefix || b.network !== a.network + size
                    || !isAligned(a.network, a.prefix - 1, family)) break;
                stack.splice(-2, 2, { network: a.network, prefix: a.prefix - 1 });
            }
        }
        out[family === 4 ? 'v4' : 'v6'] = stack.map(
            (b) => `${formatIp({ family, value: b.network })}/${b.prefix}`,
        );
    }
    return out;
};

// Greedy cover of an inclusive range with the fewest CIDRs: at each step
// take the largest block aligned at `cur` that still fits before `end`.
export const rangeToCidrs = (startStr, endStr) => {
    const start = parseIp(startStr);
    const end = parseIp(endStr);
    if (!start || !end || start.family !== end.family || start.value > end.value) return null;
    const { family } = start;
    const bits = BITS[family];
    const cidrs = [];
    let cur = start.value;
    while (cur <= end.value) {
        let prefix = 0;
        for (; prefix <= bits; prefix += 1) {
            const size = addressCount(prefix, family);
            if (isAligned(cur, prefix, family) && cur + size - 1n <= end.value) break;
        }
        cidrs.push(`${formatIp({ family, value: cur })}/${prefix}`);
        cur += addressCount(prefix, family);
    }
    return { family, cidrs };
};

export const cidrToRange = (cidrStr) => {
    const info = cidrInfo(cidrStr);
    if (!info) return null;
    return { family: info.family, start: info.network, end: info.lastAddress };
};
