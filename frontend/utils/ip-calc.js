// Pure layer of the IP Calculator: classifies whatever was pasted (IPv4 /
// IPv6, prefix, number, range, prefix list) and derives what the result cards
// render. `calculate(raw)` is the component's single entry point; the parts
// are exported for tests and for the prefix slider (`analyzeCidr`).
//
// Nothing throws — junk yields `{ kind: 'invalid', reason }`, helpers return
// null. Analyzer output is display-ready (strings, counts via `formatCount`)
// so templates never meet a BigInt; only the classifier's `value` stays a
// BigInt for the bitmap. The lenient inet_aton grammar (`127.1`, `0177.0.0.1`)
// is accepted here and labelled obfuscated — the point is to show how a
// browser reads it. Block labels are IANA registry names and stay English;
// only `scope` is localised. MAC input belongs to the MAC Lookup tool; just
// the EUI-64 → MAC recovery inside an IPv6 interface id lives here.

import {
    parseIPv4, parseIPv6, parseIp, parseCidr, formatIPv4, formatIPv6, formatIp, formatCidr,
    toOctets, toHextets, cidrInfo, prefixContains, aggregateCidrs, rangeToCidrs,
} from './ip-math.js';

const MAX_V4 = (1n << 32n) - 1n;
const MAX_V6 = (1n << 128n) - 1n;

/* ------------------------------------------------------------------ */
/* Special-purpose address registries                                  */
/* ------------------------------------------------------------------ */

// `scope` is the localised word; `global` says whether the block is
// globally reachable (drives the success badge). Longest prefix wins.
const compileBlocks = (rows) => rows.map((row) => {
    const cidr = parseCidr(row.cidr);
    return { ...row, family: cidr.family, network: cidr.network, prefix: cidr.prefix };
});

export const IPV4_SPECIAL_BLOCKS = compileBlocks([
    { cidr: '0.0.0.0/8', id: 'this-network', label: 'This network', rfc: [791, 1122], scope: 'unspecified', global: false },
    { cidr: '0.0.0.0/32', id: 'this-host', label: 'This host on this network', rfc: [1122], scope: 'unspecified', global: false },
    { cidr: '10.0.0.0/8', id: 'private-10', label: 'Private-Use', rfc: [1918], scope: 'private', global: false },
    { cidr: '100.64.0.0/10', id: 'shared-cgnat', label: 'Shared Address Space (CGNAT)', rfc: [6598], scope: 'shared', global: false },
    { cidr: '127.0.0.0/8', id: 'loopback', label: 'Loopback', rfc: [1122], scope: 'loopback', global: false },
    { cidr: '169.254.0.0/16', id: 'link-local', label: 'Link-Local', rfc: [3927], scope: 'link-local', global: false },
    { cidr: '172.16.0.0/12', id: 'private-172', label: 'Private-Use', rfc: [1918], scope: 'private', global: false },
    { cidr: '192.0.0.0/24', id: 'ietf-protocol', label: 'IETF Protocol Assignments', rfc: [6890], scope: 'reserved', global: false },
    { cidr: '192.0.0.0/29', id: 'ds-lite', label: 'IPv4 Service Continuity Prefix (DS-Lite)', rfc: [7335], scope: 'reserved', global: false },
    { cidr: '192.0.0.8/32', id: 'dummy', label: 'IPv4 dummy address', rfc: [7600], scope: 'reserved', global: false },
    { cidr: '192.0.0.9/32', id: 'pcp-anycast', label: 'Port Control Protocol anycast', rfc: [7723], scope: 'global', global: true },
    { cidr: '192.0.0.10/32', id: 'turn-anycast', label: 'TURN anycast', rfc: [8155], scope: 'global', global: true },
    { cidr: '192.0.0.170/31', id: 'nat64-discovery', label: 'NAT64/DNS64 discovery', rfc: [8880, 7050], scope: 'reserved', global: false },
    { cidr: '192.0.2.0/24', id: 'test-net-1', label: 'Documentation (TEST-NET-1)', rfc: [5737], scope: 'documentation', global: false },
    { cidr: '192.31.196.0/24', id: 'as112-v4', label: 'AS112-v4', rfc: [7535], scope: 'global', global: true },
    { cidr: '192.52.193.0/24', id: 'amt', label: 'AMT', rfc: [7450], scope: 'global', global: true },
    { cidr: '192.88.99.0/24', id: '6to4-relay', label: '6to4 Relay Anycast (deprecated)', rfc: [3068, 7526], scope: 'reserved', global: false },
    { cidr: '192.168.0.0/16', id: 'private-192', label: 'Private-Use', rfc: [1918], scope: 'private', global: false },
    { cidr: '192.175.48.0/24', id: 'as112-direct', label: 'Direct Delegation AS112 Service', rfc: [7534], scope: 'global', global: true },
    { cidr: '198.18.0.0/15', id: 'benchmarking', label: 'Benchmarking', rfc: [2544], scope: 'reserved', global: false },
    { cidr: '198.51.100.0/24', id: 'test-net-2', label: 'Documentation (TEST-NET-2)', rfc: [5737], scope: 'documentation', global: false },
    { cidr: '203.0.113.0/24', id: 'test-net-3', label: 'Documentation (TEST-NET-3)', rfc: [5737], scope: 'documentation', global: false },
    { cidr: '224.0.0.0/4', id: 'multicast', label: 'Multicast', rfc: [1112, 5771], scope: 'multicast', global: false },
    { cidr: '224.0.0.0/24', id: 'mcast-local-control', label: 'Local Network Control Block', rfc: [5771], scope: 'multicast', global: false },
    { cidr: '224.0.1.0/24', id: 'mcast-internetwork', label: 'Internetwork Control Block', rfc: [5771], scope: 'multicast', global: false },
    { cidr: '232.0.0.0/8', id: 'mcast-ssm', label: 'Source-Specific Multicast', rfc: [4607], scope: 'multicast', global: false },
    { cidr: '233.0.0.0/8', id: 'mcast-glop', label: 'GLOP Block', rfc: [3180], scope: 'multicast', global: false },
    { cidr: '239.0.0.0/8', id: 'mcast-admin', label: 'Administratively Scoped', rfc: [2365], scope: 'multicast', global: false },
    { cidr: '240.0.0.0/4', id: 'reserved-240', label: 'Reserved (former Class E)', rfc: [1112], scope: 'reserved', global: false },
    { cidr: '255.255.255.255/32', id: 'broadcast', label: 'Limited Broadcast', rfc: [919, 8190], scope: 'broadcast', global: false },
]);

export const IPV6_SPECIAL_BLOCKS = compileBlocks([
    { cidr: '::/128', id: 'unspecified', label: 'Unspecified', rfc: [4291], scope: 'unspecified', global: false },
    { cidr: '::1/128', id: 'loopback', label: 'Loopback', rfc: [4291], scope: 'loopback', global: false },
    { cidr: '::ffff:0:0/96', id: 'ipv4-mapped', label: 'IPv4-mapped', rfc: [4291], scope: 'reserved', global: false },
    { cidr: '::/96', id: 'ipv4-compatible', label: 'IPv4-compatible (deprecated)', rfc: [4291], scope: 'reserved', global: false },
    { cidr: '64:ff9b::/96', id: 'nat64-wkp', label: 'NAT64 well-known prefix', rfc: [6052], scope: 'reserved', global: false },
    { cidr: '64:ff9b:1::/48', id: 'nat64-local', label: 'Local-use NAT64', rfc: [8215], scope: 'private', global: false },
    { cidr: '100::/64', id: 'discard', label: 'Discard-only', rfc: [6666], scope: 'reserved', global: false },
    { cidr: '2001::/23', id: 'ietf-protocol-v6', label: 'IETF Protocol Assignments', rfc: [2928], scope: 'reserved', global: false },
    { cidr: '2001::/32', id: 'teredo', label: 'Teredo', rfc: [4380], scope: 'global', global: true },
    { cidr: '2001:1::1/128', id: 'pcp-anycast-v6', label: 'Port Control Protocol anycast', rfc: [7723], scope: 'global', global: true },
    { cidr: '2001:1::2/128', id: 'turn-anycast-v6', label: 'TURN anycast', rfc: [8155], scope: 'global', global: true },
    { cidr: '2001:1::3/128', id: 'dnssd-srp-anycast', label: 'DNS-SD Service Registration Protocol anycast', rfc: [9665], scope: 'global', global: true },
    { cidr: '2001:2::/48', id: 'benchmarking-v6', label: 'Benchmarking', rfc: [5180], scope: 'reserved', global: false },
    { cidr: '2001:3::/32', id: 'amt-v6', label: 'AMT', rfc: [7450], scope: 'global', global: true },
    { cidr: '2001:4:112::/48', id: 'as112-v6', label: 'AS112-v6', rfc: [7535], scope: 'global', global: true },
    { cidr: '2001:10::/28', id: 'orchid', label: 'ORCHID (deprecated)', rfc: [4843], scope: 'reserved', global: false },
    { cidr: '2001:20::/28', id: 'orchid-v2', label: 'ORCHIDv2', rfc: [7343], scope: 'reserved', global: false },
    { cidr: '2001:30::/28', id: 'drone-rid', label: 'Drone Remote ID Protocol Entity Tags', rfc: [9374], scope: 'reserved', global: false },
    { cidr: '2001:db8::/32', id: 'documentation-v6', label: 'Documentation', rfc: [3849], scope: 'documentation', global: false },
    { cidr: '2002::/16', id: '6to4', label: '6to4', rfc: [3056], scope: 'global', global: true },
    { cidr: '2620:4f:8000::/48', id: 'as112-direct-v6', label: 'Direct Delegation AS112 Service', rfc: [7534], scope: 'global', global: true },
    { cidr: '3fff::/20', id: 'documentation-3fff', label: 'Documentation', rfc: [9637], scope: 'documentation', global: false },
    { cidr: '5f00::/16', id: 'srv6', label: 'Segment Routing (SRv6) SIDs', rfc: [9602], scope: 'reserved', global: false },
    { cidr: '2000::/3', id: 'global-unicast', label: 'Global Unicast', rfc: [4291], scope: 'global', global: true },
    { cidr: 'fc00::/7', id: 'ula', label: 'Unique Local', rfc: [4193], scope: 'private', global: false },
    { cidr: 'fe80::/10', id: 'link-local-v6', label: 'Link-Local', rfc: [4291], scope: 'link-local', global: false },
    { cidr: 'fec0::/10', id: 'site-local', label: 'Site-Local (deprecated)', rfc: [3879], scope: 'reserved', global: false },
    { cidr: 'ff00::/8', id: 'multicast-v6', label: 'Multicast', rfc: [4291], scope: 'multicast', global: false },
    { cidr: 'ff02::1:ff00:0/104', id: 'solicited-node', label: 'Solicited-Node Multicast', rfc: [4291], scope: 'multicast', global: false },
]);

// IPv6 space outside every registered block is unassigned by the IETF.
const RESERVED_IETF_V6 = { id: 'reserved-ietf', label: 'Reserved by IETF', rfc: [4291], scope: 'reserved', global: false };

export const IPV6_MULTICAST_SCOPES = {
    0: 'reserved',
    1: 'interface-local',
    2: 'link-local',
    3: 'realm-local',
    4: 'admin-local',
    5: 'site-local',
    8: 'organization-local',
    14: 'global',
    15: 'reserved',
};

// Every block containing `value`, most specific first.
export const lookupBlocks = (family, value) => {
    const table = family === 4 ? IPV4_SPECIAL_BLOCKS : IPV6_SPECIAL_BLOCKS;
    return table
        .filter((b) => prefixContains(b.network, b.prefix, family, value))
        .sort((a, b) => b.prefix - a.prefix)
        .map(({ id, label, rfc, scope, global, cidr }) => ({ id, label, rfc, scope, global, cidr }));
};

// IPv4 outside every block is plain global unicast (no block); IPv6 outside
// every block is IETF-reserved, which is a classification of its own.
const classify = (family, value) => {
    let blocks = lookupBlocks(family, value);
    if (family === 6 && blocks.length === 0) blocks = [{ ...RESERVED_IETF_V6, cidr: null }];
    const block = blocks[0] || null;
    return {
        block,
        blocks,
        scope: block ? block.scope : 'global',
        isGlobal: block ? block.global : true,
    };
};

/* ------------------------------------------------------------------ */
/* Small formatters                                                    */
/* ------------------------------------------------------------------ */

const hex = (value, width) => value.toString(16).padStart(width, '0');
const byteHex = (n) => n.toString(16).padStart(2, '0');

// `pow2` when the count is a power of two; `approx` once the digits stop
// being readable.
export const formatCount = (value) => {
    if (typeof value !== 'bigint' || value < 0n) return null;
    const exact = value.toString();
    const grouped = exact.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const pow2 = value > 0n && (value & (value - 1n)) === 0n ? value.toString(2).length - 1 : null;
    let approx = null;
    if (exact.length > 15) {
        const mantissa = (Number(exact.slice(0, 4)) / 1000).toFixed(2);
        approx = `${mantissa}×10^${exact.length - 1}`;
    }
    return { exact, grouped, pow2, approx };
};

// One-line rendering of a formatCount result.
export const countLabel = (count) => {
    if (!count) return '';
    return count.pow2 !== null && count.pow2 >= 10 ? `${count.grouped} (2^${count.pow2})` : count.grouped;
};

export const ptrName = (parsed) => {
    if (!parsed) return null;
    if (parsed.family === 4) {
        const octets = toOctets(parsed.value);
        return octets ? `${octets.reverse().join('.')}.in-addr.arpa` : null;
    }
    if (parsed.family !== 6 || typeof parsed.value !== 'bigint' || parsed.value < 0n || parsed.value > MAX_V6) return null;
    return `${hex(parsed.value, 32).split('').reverse().join('.')}.ip6.arpa`;
};

// Reverse zone of a block; only octet-aligned (v4) / nibble-aligned (v6)
// prefixes have one — RFC 2317 classless delegation is out of scope.
export const ptrZone = (cidr) => {
    const c = typeof cidr === 'string' ? parseCidr(cidr) : cidr;
    if (!c) return null;
    if (c.family === 4) {
        if (c.prefix % 8 !== 0) return null;
        const labels = toOctets(c.network).slice(0, c.prefix / 8).reverse();
        return [...labels, 'in-addr.arpa'].join('.');
    }
    if (c.prefix % 4 !== 0) return null;
    const nibbles = hex(c.network, 32).slice(0, c.prefix / 4).split('').reverse();
    return [...nibbles, 'ip6.arpa'].join('.');
};

/* ------------------------------------------------------------------ */
/* IPv4 derivations                                                    */
/* ------------------------------------------------------------------ */

// Spellings inet_aton-style parsers also accept — how an IP sneaks past a
// naive string filter.
export const obfuscatedForms = (value) => {
    const octets = toOctets(value);
    if (!octets) return null;
    const [a, b, c, d] = octets;
    return {
        decimal: value.toString(),
        hex: `0x${hex(value, 8)}`,
        octal: `0${value.toString(8)}`,
        dottedHex: octets.map((o) => `0x${o.toString(16)}`).join('.'),
        dottedOctal: octets.map((o) => `0${o.toString(8)}`).join('.'),
        short: [
            `${a}.${b}.${(c << 8) | d}`,
            `${a}.${(b << 16) | (c << 8) | d}`,
        ],
    };
};

export const ipv4ToEmbeddedForms = (value) => {
    const dotted = formatIPv4(value);
    if (dotted === null) return null;
    return {
        mapped: `::ffff:${dotted}`,
        mappedHex: formatIPv6((0xffffn << 32n) | value),
        compat: `::${dotted}`,
        nat64: `64:ff9b::${dotted}`,
        sixToFour: `${formatIPv6((0x2002n << 112n) | (value << 80n))}/48`,
    };
};

const ipv4Class = (firstOctet) => {
    if (firstOctet < 128) return 'A';
    if (firstOctet < 192) return 'B';
    if (firstOctet < 224) return 'C';
    if (firstOctet < 240) return 'D';
    return 'E';
};

export const analyzeIPv4 = (value) => {
    const octets = toOctets(value);
    if (!octets) return null;
    return {
        family: 4,
        canonical: formatIPv4(value),
        octets,
        class: ipv4Class(octets[0]),
        ...classify(4, value),
        integer: value.toString(),
        hex: `0x${hex(value, 8)}`,
        octal: `0${value.toString(8)}`,
        binary: octets.map((o) => o.toString(2).padStart(8, '0')).join('.'),
        ptr: ptrName({ family: 4, value }),
        obfuscated: obfuscatedForms(value),
        embedded: ipv4ToEmbeddedForms(value),
    };
};

/* ------------------------------------------------------------------ */
/* IPv6 derivations                                                    */
/* ------------------------------------------------------------------ */

const EMBEDDED_LOW32 = new Set(['ipv4-mapped', 'ipv4-compatible', 'nat64-wkp', 'nat64-local']);

// The IPv4 an address embeds, by transition mechanism (Teredo's client is
// XOR-obscured — see decodeTeredo).
export const extractEmbeddedIPv4 = (value) => {
    if (typeof value !== 'bigint' || value < 0n || value > MAX_V6) return null;
    const block = lookupBlocks(6, value)[0];
    if (!block) return null;
    if (EMBEDDED_LOW32.has(block.id)) return formatIPv4(value & 0xffffffffn);
    if (block.id === '6to4') return formatIPv4((value >> 80n) & 0xffffffffn);
    return null;
};

// RFC 4380 layout: prefix(32) server(32) flags(16) ~port(16) ~client(32).
export const decodeTeredo = (value) => {
    if (typeof value !== 'bigint' || !prefixContains(0x2001n << 112n, 32, 6, value)) return null;
    const flags = Number((value >> 48n) & 0xffffn);
    return {
        server: formatIPv4((value >> 64n) & 0xffffffffn),
        client: formatIPv4((value & 0xffffffffn) ^ 0xffffffffn),
        port: Number((value >> 32n) & 0xffffn) ^ 0xffff,
        cone: (flags & 0x8000) !== 0,
    };
};

export const solicitedNode = (value) => {
    if (typeof value !== 'bigint' || value < 0n || value > MAX_V6) return null;
    return formatIPv6((0xff02n << 112n) | (0x1ffn << 24n) | (value & 0xffffffn));
};

const iidBytes = (iid) => Array.from({ length: 8 }, (_, i) => Number((iid >> BigInt((7 - i) * 8)) & 0xffn));

// Modified EUI-64 → MAC: `ff:fe` marks the expansion, U/L bit was flipped.
export const iidToMac = (iid) => {
    if (typeof iid !== 'bigint' || iid < 0n || iid > (1n << 64n) - 1n) return null;
    const b = iidBytes(iid);
    if (b[3] !== 0xff || b[4] !== 0xfe) return null;
    return {
        mac: [b[0] ^ 0x02, b[1], b[2], b[5], b[6], b[7]].map(byteHex).join(':'),
        universal: (b[0] & 0x02) !== 0,
    };
};

const IID_SCOPES = new Set(['global', 'private', 'link-local', 'documentation']);

export const analyzeIPv6 = (value, { embeddedV4 = false } = {}) => {
    const hextets = toHextets(value);
    if (!hextets) return null;
    const classification = classify(6, value);
    const blockId = classification.block?.id ?? RESERVED_IETF_V6.id;

    let multicast = null;
    if (classification.scope === 'multicast') {
        const flags = (hextets[0] >> 4) & 0xf;
        const scopeId = hextets[0] & 0xf;
        multicast = {
            flags: { T: (flags & 1) !== 0, P: (flags & 2) !== 0, R: (flags & 4) !== 0 },
            scope: { id: scopeId, name: IPV6_MULTICAST_SCOPES[scopeId] ?? 'unassigned' },
            solicitedNodeSuffix: blockId === 'solicited-node'
                ? iidBytes(value & 0xffffffn).slice(5).map(byteHex).join(':')
                : null,
        };
    }

    let ula = null;
    if (blockId === 'ula') {
        const globalId = hex((value >> 80n) & 0xffffffffffn, 10);
        ula = {
            locallyAssigned: ((value >> 120n) & 1n) === 1n,
            globalId: `${globalId.slice(0, 2)}:${globalId.slice(2, 6)}:${globalId.slice(6)}`,
            subnetId: hex((value >> 64n) & 0xffffn, 4),
        };
    }

    let iid = null;
    if (IID_SCOPES.has(classification.scope) && blockId !== 'teredo') {
        const iidValue = value & ((1n << 64n) - 1n);
        const eui = iidToMac(iidValue);
        iid = {
            hex: hex(iidValue, 16).match(/.{4}/g).join(':'),
            isEui64: eui !== null,
            mac: eui?.mac ?? null,
            universal: eui?.universal ?? null,
            isSubnetRouterAnycast: iidValue === 0n,
            solicitedNode: solicitedNode(value),
        };
    }

    return {
        family: 6,
        compressed: formatIPv6(value),
        expanded: formatIPv6(value, { expanded: true }),
        hextets,
        ...classification,
        integer: value.toString(),
        hex: `0x${hex(value, 32)}`,
        ptr: ptrName({ family: 6, value }),
        embeddedV4: extractEmbeddedIPv4(value),
        embeddedV4Notation: embeddedV4,
        teredo: blockId === 'teredo' ? decodeTeredo(value) : null,
        multicast,
        ula,
        iid,
    };
};

/* ------------------------------------------------------------------ */
/* Prefix / range / list derivations                                   */
/* ------------------------------------------------------------------ */

const splitPresetsFor = (prefix, family) => {
    const bits = family === 4 ? 32 : 128;
    const presets = [];
    if (family === 4) {
        for (let p = prefix + 1; p <= Math.min(prefix + 8, bits); p += 1) presets.push(p);
    } else {
        // Nibble boundaries keep ip6.arpa delegation clean, so offer those.
        for (let p = prefix + 1; p <= Math.min(prefix + 16, bits); p += 1) {
            if (p % 4 === 0) presets.push(p);
        }
    }
    return presets;
};

export const analyzeCidr = (cidrStr) => {
    const info = cidrInfo(cidrStr);
    if (!info) return null;
    const { family, prefix } = info;
    const ip = (value) => formatIp({ family, value });
    return {
        family,
        prefix,
        cidr: info.cidr,
        address: ip(info.address),
        network: ip(info.network),
        broadcast: info.broadcast === null ? null : ip(info.broadcast),
        first: ip(info.first),
        last: ip(info.last),
        lastAddress: ip(info.lastAddress),
        mask: ip(info.mask),
        maskHex: `0x${hex(info.mask, family === 4 ? 8 : 32)}`,
        wildcard: ip(info.wildcard),
        count: formatCount(info.count),
        usable: formatCount(info.usable),
        aligned: info.aligned,
        ptrZone: ptrZone({ family, prefix, network: info.network }),
        ...classify(family, info.network),
        splitPresets: splitPresetsFor(prefix, family),
        slash64s: family === 6 && prefix <= 64 ? formatCount(1n << BigInt(64 - prefix)) : null,
    };
};

export const analyzeRange = (startStr, endStr) => {
    const range = rangeToCidrs(startStr, endStr);
    if (!range) return null;
    const start = parseIp(startStr);
    const end = parseIp(endStr);
    return {
        family: range.family,
        start: formatIp(start),
        end: formatIp(end),
        count: formatCount(end.value - start.value + 1n),
        cidrs: range.cidrs,
        aggregated: range.cidrs.length === 1 ? range.cidrs[0] : null,
    };
};

const familySummary = (tokens, aggregated, family) => {
    const input = [];
    for (const token of tokens) {
        const cidr = parseCidr(token);
        if (cidr) {
            if (cidr.family === family) input.push(formatCidr(cidr));
            continue;
        }
        const ip = parseIp(token);
        if (ip && ip.family === family) input.push(`${formatIp(ip)}/${family === 4 ? 32 : 128}`);
    }
    const total = aggregated.reduce((sum, cidr) => sum + cidrInfo(cidr).count, 0n);
    return { input, aggregated, count: formatCount(total) };
};

export const analyzeList = (tokens) => {
    if (!Array.isArray(tokens)) return null;
    const { v4, v6, invalid } = aggregateCidrs(tokens);
    return {
        v4: familySummary(tokens, v4, 4),
        v6: familySummary(tokens, v6, 6),
        invalid,
    };
};

export const analyzeInteger = (value, family) => {
    if (typeof value !== 'bigint' || value < 0n) return null;
    if (family === 4 ? value > MAX_V4 : value > MAX_V6) return null;
    const bits = family === 4 ? 32 : 128;
    return {
        family,
        asIPv4: family === 4 ? formatIPv4(value) : null,
        asIPv6: formatIPv6(value),
        decimal: value.toString(),
        hex: `0x${hex(value, bits / 4)}`,
        binary: value.toString(2).padStart(bits, '0').match(/.{8}/g).join(' '),
        bits: value === 0n ? 0 : value.toString(2).length,
    };
};

/* ------------------------------------------------------------------ */
/* Input classifier                                                    */
/* ------------------------------------------------------------------ */

const invalid = (raw, input, reason) => ({ kind: 'invalid', raw, input, reason });

// inet_aton: 1–4 dot-separated parts, each decimal / leading-0 octal / 0x
// hex; the last part absorbs the remaining octets.
const INET_ATON_PART = /^(0x[0-9a-f]+|0[0-7]*|[1-9]\d*)$/i;

const parseInetAton = (input) => {
    const parts = input.split('.');
    if (parts.length < 2 || parts.length > 4 || !parts.every((p) => INET_ATON_PART.test(p))) return null;
    const notations = new Set();
    const numbers = parts.map((p) => {
        if (/^0x/i.test(p)) { notations.add('hex'); return BigInt(p); }
        if (p.length > 1 && p.startsWith('0')) { notations.add('octal'); return BigInt(parseInt(p, 8)); }
        return BigInt(p);
    });
    const last = numbers.pop();
    if (numbers.some((n) => n > 255n)) return null;
    const lastBits = BigInt(8 * (5 - parts.length));
    if (last >= 1n << lastBits) return null;
    let value = last;
    numbers.forEach((n, i) => { value |= n << BigInt(8 * (3 - i)); });
    let notation = 'shorthand';
    if (notations.size === 2) notation = 'mixed';
    else if (notations.size === 1) notation = [...notations][0];
    return { value, notation };
};

const normalize = (raw) => {
    let input = typeof raw === 'string' ? raw.trim() : '';
    if (/^\[.*\]$/.test(input)) input = input.slice(1, -1).trim();
    let zone = null;
    if (input.includes(':') && input.includes('%') && !/\s/.test(input)) {
        const at = input.indexOf('%');
        zone = input.slice(at + 1);
        input = input.slice(0, at);
    }
    return { input: input.replace(/\s+/g, ' '), zone };
};

const rangeOf = (input) => {
    const m = /^(\S+) ?- ?(\S+)$/.exec(input);
    if (!m) return null;
    const start = parseIp(m[1]);
    if (!start) return null;
    let end = parseIp(m[2]);
    if (!end && start.family === 4 && /^\d{1,3}$/.test(m[2]) && Number(m[2]) <= 255) {
        end = { family: 4, value: (start.value & ~0xffn & MAX_V4) | BigInt(m[2]) };
    }
    if (!end || end.family !== start.family) return { error: true };
    const reversed = start.value > end.value;
    return reversed ? { start: end, end: start, reversed } : { start, end, reversed };
};

export const classifyInput = (raw) => {
    let { input } = normalize(raw);
    const { zone } = normalize(raw);
    const base = { raw, input, zone };
    if (input === '') return invalid(raw, input, 'empty');

    const range = rangeOf(input);
    if (range) {
        if (range.error) return invalid(raw, input, 'range');
        return { ...base, kind: 'range', family: range.start.family, start: range.start, end: range.end, reversed: range.reversed };
    }

    const tokens = input.split(/[\s,;]+/).filter(Boolean);
    if (tokens.length >= 2) {
        const bad = tokens.filter((t) => !parseCidr(t) && !parseIp(t));
        if (bad.length === tokens.length) return invalid(raw, input, 'list-no-valid');
        return { ...base, kind: 'cidr-list', tokens, invalid: bad };
    }
    // A lone token with a trailing separator (`1.2.3.4,`) is still one item.
    input = tokens[0] ?? input;
    base.input = input;

    if (input.includes('/')) {
        const cidr = parseCidr(input);
        if (cidr) return { ...base, kind: cidr.family === 4 ? 'ipv4-cidr' : 'ipv6-cidr', cidr };
        const left = input.slice(0, input.indexOf('/'));
        return invalid(raw, input, parseIp(left) ? 'cidr-prefix' : 'cidr-address');
    }

    if (input.includes(':')) {
        const v6 = parseIPv6(input);
        if (!v6) return invalid(raw, input, 'ipv6-syntax');
        return { ...base, kind: 'ipv6', value: v6.value, embeddedV4: v6.embeddedV4 };
    }

    const v4 = parseIPv4(input);
    if (v4) return { ...base, kind: 'ipv4', value: v4.value, notation: 'dotted', obfuscated: false };

    if (/^0x[0-9a-f]+$/i.test(input)) {
        const digits = input.length - 2;
        if (digits > 32) return invalid(raw, input, 'hex-too-large');
        return { ...base, kind: 'hex', family: digits <= 8 ? 4 : 6, value: BigInt(input), prefixed: true };
    }

    // A leading zero reads as octal, as inet_aton would.
    if (/^0[0-7]+$/.test(input)) {
        const value = BigInt(parseInt(input, 8));
        if (value > MAX_V4) return invalid(raw, input, 'integer-too-large');
        return { ...base, kind: 'ipv4', value, notation: 'octal', obfuscated: true };
    }

    if (/^\d+$/.test(input)) {
        if (/^0\d/.test(input)) return invalid(raw, input, 'bad-octal');
        const value = BigInt(input);
        if (value > MAX_V6) return invalid(raw, input, 'integer-too-large');
        return { ...base, kind: 'integer', family: value <= MAX_V4 ? 4 : 6, value };
    }

    if (/^[0-9a-f]{32}$/i.test(input)) {
        return { ...base, kind: 'hex', family: 6, value: BigInt(`0x${input}`), prefixed: false };
    }

    const loose = parseInetAton(input);
    if (loose) return { ...base, kind: 'ipv4', value: loose.value, notation: loose.notation, obfuscated: true };

    return invalid(raw, input, 'unrecognized');
};

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

const hostAnalysis = (family, value, { embeddedV4 = false, prefix = null } = {}) => {
    const address = family === 4 ? analyzeIPv4(value) : analyzeIPv6(value, { embeddedV4 });
    const defaultPrefix = family === 4 ? 32 : 64;
    return {
        address,
        cidr: analyzeCidr(`${formatIp({ family, value })}/${prefix ?? defaultPrefix}`),
    };
};

export const calculate = (raw) => {
    const c = classifyInput(raw);
    switch (c.kind) {
        case 'ipv4':
            return { ...c, analysis: hostAnalysis(4, c.value) };
        case 'ipv6':
            return { ...c, analysis: hostAnalysis(6, c.value, { embeddedV4: c.embeddedV4 }) };
        case 'ipv4-cidr':
        case 'ipv6-cidr':
            return { ...c, analysis: hostAnalysis(c.cidr.family, c.cidr.address, { prefix: c.cidr.prefix }) };
        case 'integer':
        case 'hex':
            return { ...c, analysis: { ...hostAnalysis(c.family, c.value), number: analyzeInteger(c.value, c.family) } };
        case 'range':
            return { ...c, analysis: analyzeRange(formatIp(c.start), formatIp(c.end)) };
        case 'cidr-list':
            return { ...c, analysis: analyzeList(c.tokens) };
        default:
            return c;
    }
};
