// Validate if IP address is valid
function isValidIP(ip) {
    if (typeof ip !== 'string') {
        return false;
    }

    // IPv4
    const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (ipv4Pattern.test(ip)) {
        return true;
    }

    const doubleColonParts = ip.split('::');
    if (doubleColonParts.length > 2) {
        return false;
    }
    
    // IPv6
    const hasCompressedGroup = doubleColonParts.length === 2;
    const groups = doubleColonParts.flatMap(part => part === '' ? [] : part.split(':'));

    if (groups.some(group => !/^[0-9a-fA-F]{1,4}$/.test(group))) {
        return false;
    }

    return hasCompressedGroup ? groups.length < 8 : groups.length === 8;
};

// Distinguish IPv6 from IPv4 for an already-validated IP string (the ':'
// separator only exists in v6). This is the codebase-wide idiom formalized —
// it does NOT validate; run isValidIP first for untrusted input.
function isIPv6(ip) {
    return typeof ip === 'string' && ip.includes(':');
}

// Validate if a string is a syntactically plausible domain name.
// Matches the hostname pattern used by DnsResolver / Whois / CensorshipCheck:
// lowercase-only labels of [a-z0-9-], at least one dot, and a TLD of 2+
// letters. This is intentionally a surface-level check — it accepts
// "foo.example" and doesn't know about public suffixes — because every
// caller also routes through `new URL()` parsing before landing here.
function isValidDomain(domain) {
    if (typeof domain !== 'string') return false;
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(domain);
}

// IPv4 blocks outside publicly routable space: the RFC 1918 private ranges
// plus loopback, link-local, CGNAT, documentation, benchmarking, multicast
// and the reserved tail.
const RESERVED_V4 = [
    ['0.0.0.0', 8],        // "this network"
    ['10.0.0.0', 8],       // RFC 1918
    ['100.64.0.0', 10],    // CGNAT, RFC 6598
    ['127.0.0.0', 8],      // loopback
    ['169.254.0.0', 16],   // link-local
    ['172.16.0.0', 12],    // RFC 1918
    ['192.0.0.0', 24],     // IETF protocol assignments
    ['192.0.2.0', 24],     // TEST-NET-1
    ['192.88.99.0', 24],  // 6to4 relay anycast, RFC 3068
    ['192.168.0.0', 16],   // RFC 1918
    ['198.18.0.0', 15],    // benchmarking, RFC 2544
    ['198.51.100.0', 24],  // TEST-NET-2
    ['203.0.113.0', 24],   // TEST-NET-3
    ['224.0.0.0', 4],      // multicast
    ['240.0.0.0', 4],      // reserved + limited broadcast
];

// Multiplication rather than `<<` — a 32-bit shift on 240.0.0.0 would go
// negative in JS bitwise math.
const ipv4ToInt = (ip) => ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);

const isReservedV4 = (ip) => {
    const addr = ipv4ToInt(ip);
    return RESERVED_V4.some(([network, bits]) => {
        const base = ipv4ToInt(network);
        return addr >= base && addr < base + 2 ** (32 - bits);
    });
};

// The leading hextets of an IPv6 address, as numbers. Only the first two are
// meaningful here, and `::` compression always elides a run that starts right
// after the left-hand groups — so any index past them reads as 0, which is
// what the elided groups hold.
const leadingHextets = (ip) => {
    const left = ip.split('::')[0];
    const groups = left === '' ? [] : left.split(':');
    return [0, 1].map((i) => (groups[i] === undefined ? 0 : parseInt(groups[i], 16)));
};

// IANA hands out global unicast IPv6 only from 2000::/3, so the whole
// question reduces to "outside that range, or inside one of its carve-outs".
// Enumerating reserved prefixes instead would leave holes — everything from
// 4000:: to fbff:: is unassigned, and new blocks keep landing inside 2000::/3
// (3fff::/20 became documentation space in 2024).
const isReservedV6 = (ip) => {
    const [h0, h1] = leadingHextets(ip);
    if (h0 < 0x2000 || h0 > 0x3fff) return true;

    if (h0 === 0x2001 && h1 === 0x0000) return true;                    // Teredo, RFC 4380
    if (h0 === 0x2001 && h1 >= 0x0020 && h1 <= 0x002f) return true;     // ORCHIDv2, RFC 7343
    if (h0 === 0x2001 && h1 === 0x0db8) return true;                    // documentation, RFC 3849
    if (h0 === 0x2002) return true;                                     // 6to4, RFC 3056
    if (h0 === 0x3fff && h1 <= 0x0fff) return true;                     // documentation, RFC 9637
    return false;
};

// Whether an IP is one this project can actually look up: a well-formed
// address that lives in publicly routable space. Every IP form in the app
// feeds an external service — a registry, a geolocation source, a probe
// fleet — so the question worth asking is "can anyone out there answer
// about this address", and reserved space answers no whatever the service.
// Validation is folded in: a string that isn't an IP isn't a usable one.
const isUsablePublicIP = (ip) => {
    if (!isValidIP(ip)) return false;
    return !(isIPv6(ip) ? isReservedV6(ip) : isReservedV4(ip));
};

export { isValidIP, isIPv6, isValidDomain, isUsablePublicIP };
