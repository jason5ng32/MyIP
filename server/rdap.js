// RDAP lookups for the WHOIS tool.
//
//   - Domains: fallback. whoiser covers legacy gTLDs well through
//     port 43, but newer ones (.ing / .app / .dev / …) expose RDAP only
//     and return no WHOIS at all — rdapDomain() fills that gap.
//   - IPs: primary. RIR RDAP is plain HTTPS + JSON from the
//     authoritative registry, with none of port-43's referral quirks
//     (rwhois:// endpoints speak a protocol WHOIS clients can't follow).
//   - ASNs: only source. RIR autnum objects, same bootstrap mechanism.
//
// Public API:
//   rdapDomain(name)  →  { [host]: { __raw, ...rdapJson } }
//     Same outer shape as whoiser.domain() so the handler can splice
//     the result in without any frontend change.
//   rdapIp(ip)        →  { __raw, ...rdapJson }
//     Flat, like whoiser.ip() — the frontend only reads `__raw`.
//   rdapAutnum(asn)   →  { asn, handle, name, rir, …, __raw }
//     Flat like rdapIp, but parsed fields instead of the raw RDAP JSON.
//
// Bootstrap (IANA's TLD / address-space → RDAP endpoint maps) is cached
// in-memory for 24h per file. Upstream calls go through `fetchUpstream`
// so they inherit the project's timeout convention.

import { fetchUpstream } from '../common/fetch-with-timeout.js';
import { isIPv6 } from '../common/valid-ip.js';
import { ipToBigInt, parseCidr, prefixContains } from '../common/ip-math.js';
import logger from './logger.js';

const BOOTSTRAP_BASE = 'https://data.iana.org/rdap/';
const CACHE_TTL_MS   = 24 * 60 * 60 * 1000;
const bootstrapCache = new Map(); // file → { data, expiresAt }

const loadBootstrap = async (file) => {
    const cached = bootstrapCache.get(file);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    const res = await fetchUpstream(BOOTSTRAP_BASE + file);
    if (!res.ok) {
        logger.error({ file, status: res.status }, 'RDAP bootstrap failed');
        throw new Error(`RDAP bootstrap failed: ${res.status}`);
    }
    const data = await res.json();
    bootstrapCache.set(file, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
};

function findEndpoint(services, tld) {
    const needle = tld.toLowerCase();
    for (const [tlds, urls] of services) {
        if (tlds.some(t => t.toLowerCase() === needle)) return urls[0];
    }
    return null;
}

const trimSlash = (u) => u.replace(/\/$/, '');

export async function rdapDomain(domain, { timeoutMs = 5000 } = {}) {
    const bootstrap = await loadBootstrap('dns.json');
    const tld = domain.split('.').pop();
    const base = findEndpoint(bootstrap.services, tld);
    if (!base) {
        throw new Error(`No RDAP endpoint for .${tld}`);
    }

    const host = new URL(base).hostname;
    const url  = `${trimSlash(base)}/domain/${encodeURIComponent(domain)}`;
    const res  = await fetchUpstream(url, { timeoutMs });
    if (res.status === 404) {
        throw new Error(`Domain not found: ${domain}`);
    }
    if (!res.ok) {
        logger.error({ domain, status: res.status }, 'RDAP query failed');
        throw new Error(`RDAP query failed: ${res.status}`);
    }
    const data = await res.json();

    return { [host]: { ...data, __raw: formatDomain(data) } };
}

// -- IP lookup -------------------------------------------------------------

// Longest-prefix match of `ip` against an IANA ipv4/ipv6 bootstrap
// `services` array (entries: [[cidr, …], [url, …]]). Exported for tests.
export const findIpEndpoint = (services, ip) => {
    const v6 = isIPv6(ip);
    const ipBig = ipToBigInt(ip);
    if (ipBig === null) return null;

    let best = null;
    let bestLen = -1;
    for (const [cidrs, urls] of services) {
        for (const cidr of cidrs) {
            const block = parseCidr(cidr);
            if (!block || (block.family === 6) !== v6) continue;
            if (block.prefix <= bestLen
                || !prefixContains(block.network, block.prefix, block.family, ipBig)) continue;
            bestLen = block.prefix;
            best = urls.find((u) => u.startsWith('https://')) || urls[0];
        }
    }
    return best;
};

export const rdapIp = async (ip, { timeoutMs = 5000 } = {}) => {
    const bootstrap = await loadBootstrap(isIPv6(ip) ? 'ipv6.json' : 'ipv4.json');
    const base = findIpEndpoint(bootstrap.services, ip);
    if (!base) {
        throw new Error(`No RDAP endpoint for ${ip}`);
    }

    // Literal IP, not encodeURIComponent: colons are legal in a URL path,
    // the guard layer already ensures a well-formed IP, and some RIR
    // delegates (e.g. IDNIC behind APNIC's redirect) reject %3A with a 400.
    const url = `${trimSlash(base)}/ip/${ip}`;
    const res = await fetchUpstream(url, { timeoutMs });
    if (res.status === 404) {
        throw new Error(`IP not found: ${ip}`);
    }
    if (!res.ok) {
        logger.error({ ip, status: res.status }, 'RDAP IP query failed');
        throw new Error(`RDAP IP query failed: ${res.status}`);
    }
    const data = await res.json();

    return { ...data, __raw: formatIpNetwork(data) };
};

// -- Autnum lookup ---------------------------------------------------------

// Match an ASN against IANA asn.json bootstrap services (entries:
// [[range, …], [url, …]], ranges "N" or "N-M"). Exported for tests.
export const findAutnumEndpoint = (services, asn) => {
    for (const [ranges, urls] of services) {
        for (const range of ranges) {
            const [lo, hi] = range.split('-').map(Number);
            if (asn >= lo && asn <= (hi ?? lo)) {
                return urls.find((u) => u.startsWith('https://')) || urls[0];
            }
        }
    }
    return null;
};

// RDAP service host → registry display name. Unlisted hosts (an NIR, a
// moved endpoint) fall back to the hostname itself.
const RIR_BY_HOST = {
    'rdap.arin.net': 'ARIN',
    'rdap.db.ripe.net': 'RIPE NCC',
    'rdap.apnic.net': 'APNIC',
    'rdap.lacnic.net': 'LACNIC',
    'rdap.afrinic.net': 'AFRINIC',
};

// Depth-first walk over an entity tree (RDAP nests contacts inside their
// parent entity), returning the first entity carrying `role`.
const findEntityByRole = (entities, role) => {
    for (const e of entities || []) {
        if (e.roles?.includes(role)) return e;
        const nested = findEntityByRole(e.entities, role);
        if (nested) return nested;
    }
    return null;
};

const vcardOrgName = (v) => (Array.isArray(v.org?.[0]) ? v.org[0].join(' ') : v.org?.[0]);

// RDAP autnum document → the parsed fields plus the WHOIS-like `__raw`
// block. `host` is the RDAP service that answered. Exported for tests.
export const parseAutnum = (data, asn, host) => {
    const events = {};
    for (const e of data.events || []) events[e.eventAction] = e.eventDate;
    const registrant = findEntityByRole(data.entities, 'registrant');
    const registrantCard = registrant ? extractVcard(registrant) : {};
    const abuseCard = extractVcard(findEntityByRole(data.entities, 'abuse'));
    return {
        asn,
        handle: data.handle || null,
        name: data.name || null,
        rir: RIR_BY_HOST[host] || host || null,
        status: data.status || [],
        registered: events.registration || null,
        lastChanged: events['last changed'] || null,
        registrant: registrantCard.fn?.[0] || vcardOrgName(registrantCard) || null,
        country: data.country || null,
        abuse: abuseCard.email?.[0] || null,
        __raw: formatAutnum(data),
    };
};

// True for rdapAutnum's "no record" failures (unregistered ASN, no RDAP
// service for its range) as opposed to an upstream fault.
export const isAutnumMissing = (error) => /^(ASN not found|No RDAP endpoint for )/.test(error?.message || '');

export const rdapAutnum = async (asn, { timeoutMs = 5000 } = {}) => {
    const n = Number(String(asn).replace(/^AS/i, ''));
    const bootstrap = await loadBootstrap('asn.json');
    const base = findAutnumEndpoint(bootstrap.services, n);
    if (!base) {
        throw new Error(`No RDAP endpoint for AS${n}`);
    }

    const url = `${trimSlash(base)}/autnum/${n}`;
    const res = await fetchUpstream(url, { timeoutMs });
    if (res.status === 404) {
        throw new Error(`ASN not found: AS${n}`);
    }
    if (!res.ok) {
        logger.error({ asn: n, status: res.status }, 'RDAP autnum query failed');
        throw new Error(`RDAP autnum query failed: ${res.status}`);
    }
    return parseAutnum(await res.json(), n, new URL(base).hostname);
};

// -- Format RDAP JSON into a WHOIS-like text block ------------------------

function extractVcard(entity) {
    const props = entity?.vcardArray?.[1] || [];
    const out = {};
    for (const [name, , , value] of props) {
        if (name === 'version') continue;
        if (!out[name]) out[name] = [];
        out[name].push(value);
    }
    return out;
}

function formatEntity(entity, indent) {
    const lines = [];
    const pad = ' '.repeat(indent);
    if (entity.handle) lines.push(`${pad}Handle: ${entity.handle}`);
    const v = extractVcard(entity);
    if (v.fn)    lines.push(`${pad}Name: ${v.fn[0]}`);
    if (v.org)   lines.push(`${pad}Org: ${Array.isArray(v.org[0]) ? v.org[0].join(' ') : v.org[0]}`);
    if (v.email) lines.push(`${pad}Email: ${v.email.join(', ')}`);
    if (v.tel)   lines.push(`${pad}Phone: ${v.tel.join(', ')}`);
    if (v.adr) {
        const addr = v.adr[0];
        if (Array.isArray(addr)) {
            const s = addr.filter(Boolean).join(', ');
            if (s) lines.push(`${pad}Address: ${s}`);
        }
    }
    return lines;
}

// Group entities by role and render one section per entity, `order`
// first, leftover roles after. RDAP nests contacts inside their parent
// entity (e.g. abuse/tech inside an ARIN org) — the walk flattens those
// so nested contacts still surface.
const formatEntitySections = (entities, order) => {
    const byRole = new Map();
    const collect = (list) => {
        for (const e of list || []) {
            for (const role of (e.roles?.length ? e.roles : ['unknown'])) {
                if (!byRole.has(role)) byRole.set(role, []);
                byRole.get(role).push(e);
            }
            collect(e.entities);
        }
    };
    collect(entities);

    const lines = [];
    const seen = new Set();
    for (const role of order) {
        for (const e of byRole.get(role) || []) {
            seen.add(e);
            lines.push('');
            lines.push(`${role[0].toUpperCase()}${role.slice(1)}:`);
            lines.push(...formatEntity(e, 2));
        }
    }
    for (const [role, es] of byRole) {
        if (order.includes(role)) continue;
        for (const e of es) {
            if (seen.has(e)) continue;
            lines.push('');
            lines.push(`${role}:`);
            lines.push(...formatEntity(e, 2));
        }
    }
    return lines;
};

// WHOIS-like text block for an RDAP IP-network object, field names
// mirroring what RIR port-43 output calls them. Exported for tests.
export const formatIpNetwork = (data) => {
    const lines = [];
    lines.push(`NetRange: ${data.startAddress || 'N/A'} - ${data.endAddress || 'N/A'}`);

    const cidrs = (data.cidr0_cidrs || [])
        .map((c) => `${c.v4prefix || c.v6prefix}/${c.length}`)
        .filter((c) => !c.startsWith('undefined'));
    if (cidrs.length) lines.push(`CIDR: ${cidrs.join(', ')}`);

    if (data.name)         lines.push(`NetName: ${data.name}`);
    if (data.handle)       lines.push(`Handle: ${data.handle}`);
    if (data.parentHandle) lines.push(`Parent: ${data.parentHandle}`);
    if (data.type)         lines.push(`NetType: ${data.type}`);
    if (data.country)      lines.push(`Country: ${data.country}`);

    const ev = {};
    for (const e of data.events || []) ev[e.eventAction] = e.eventDate;
    if (ev.registration)    lines.push(`Created: ${ev.registration}`);
    if (ev['last changed']) lines.push(`Updated: ${ev['last changed']}`);

    if (data.status?.length) {
        lines.push('Status:');
        for (const s of data.status) lines.push(`  ${s}`);
    }

    lines.push(...formatEntitySections(
        data.entities,
        ['registrant', 'administrative', 'technical', 'abuse', 'noc', 'routing'],
    ));

    for (const remark of data.remarks || []) {
        lines.push('');
        lines.push(`${remark.title || 'Remarks'}:`);
        for (const d of remark.description || []) lines.push(`  ${d}`);
    }

    return lines.join('\n');
};

// WHOIS-like text block for an RDAP autnum object, field names mirroring
// RIR port-43 aut-num output. Exported for tests.
export const formatAutnum = (data) => {
    const lines = [];
    const start = data.startAutnum;
    const end = data.endAutnum;
    if (start != null) {
        lines.push(`ASNumber: ${end != null && end !== start ? `${start} - ${end}` : start}`);
    }
    if (data.name)   lines.push(`ASName: ${data.name}`);
    if (data.handle) lines.push(`ASHandle: ${data.handle}`);
    if (data.type)   lines.push(`Type: ${data.type}`);
    if (data.country) lines.push(`Country: ${data.country}`);

    const ev = {};
    for (const e of data.events || []) ev[e.eventAction] = e.eventDate;
    if (ev.registration)    lines.push(`Created: ${ev.registration}`);
    if (ev['last changed']) lines.push(`Updated: ${ev['last changed']}`);

    if (data.status?.length) {
        lines.push('Status:');
        for (const s of data.status) lines.push(`  ${s}`);
    }

    lines.push(...formatEntitySections(
        data.entities,
        ['registrant', 'administrative', 'technical', 'abuse', 'noc', 'routing'],
    ));

    for (const remark of data.remarks || []) {
        lines.push('');
        lines.push(`${remark.title || 'Remarks'}:`);
        for (const d of remark.description || []) lines.push(`  ${d}`);
    }

    return lines.join('\n');
};

function formatDomain(data) {
    const lines = [];
    lines.push(`Domain Name: ${data.ldhName || 'N/A'}`);
    if (data.unicodeName && data.unicodeName !== data.ldhName) {
        lines.push(`Unicode Name: ${data.unicodeName}`);
    }
    if (data.handle) lines.push(`Registry Domain ID: ${data.handle}`);

    const ev = {};
    for (const e of data.events || []) ev[e.eventAction] = e.eventDate;
    if (ev.registration)                    lines.push(`Created: ${ev.registration}`);
    if (ev['last changed'])                 lines.push(`Updated: ${ev['last changed']}`);
    if (ev.expiration)                      lines.push(`Expires: ${ev.expiration}`);
    if (ev['last update of RDAP database']) lines.push(`RDAP Last Refresh: ${ev['last update of RDAP database']}`);

    if (data.status?.length) {
        lines.push('Status:');
        for (const s of data.status) lines.push(`  ${s}`);
    }

    lines.push(...formatEntitySections(
        data.entities,
        ['registrar', 'registrant', 'administrative', 'technical', 'abuse', 'reseller'],
    ));

    if (data.nameservers?.length) {
        lines.push('');
        lines.push('Name Servers:');
        for (const ns of data.nameservers) lines.push(`  ${ns.ldhName || 'N/A'}`);
    }
    if (data.secureDNS) {
        lines.push('');
        lines.push(`DNSSEC: ${data.secureDNS.delegationSigned ? 'signed' : 'unsigned'}`);
    }
    return lines.join('\n');
}
