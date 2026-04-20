// RDAP fallback for domain WHOIS. whoiser covers legacy gTLDs well
// through port 43, but newer ones (.ing / .app / .dev / …) expose RDAP
// only and return no WHOIS at all — this module fills that gap.
//
// Public API:
//   rdapDomain(name)  →  { [host]: { __raw, ...rdapJson } }
//     Same outer shape as whoiser.domain() so the handler can splice
//     the result in without any frontend change.
//
// Bootstrap (IANA's TLD → RDAP endpoint map) is cached in-memory for
// 24h. Upstream calls go through `fetchUpstream` so they inherit the
// project's timeout convention.

import { fetchUpstream } from './fetch-with-timeout.js';

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000;
let bootstrapCache = null; // { data, expiresAt }

async function loadBootstrap() {
    if (bootstrapCache && bootstrapCache.expiresAt > Date.now()) {
        return bootstrapCache.data;
    }
    const res = await fetchUpstream(BOOTSTRAP_URL);
    if (!res.ok) throw new Error(`RDAP bootstrap failed: ${res.status}`);
    const data = await res.json();
    bootstrapCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return data;
}

function findEndpoint(services, tld) {
    const needle = tld.toLowerCase();
    for (const [tlds, urls] of services) {
        if (tlds.some(t => t.toLowerCase() === needle)) return urls[0];
    }
    return null;
}

const trimSlash = (u) => u.replace(/\/$/, '');

export async function rdapDomain(domain, { timeoutMs = 5000 } = {}) {
    const bootstrap = await loadBootstrap();
    const tld = domain.split('.').pop();
    const base = findEndpoint(bootstrap.services, tld);
    if (!base) throw new Error(`No RDAP endpoint for .${tld}`);

    const host = new URL(base).hostname;
    const url  = `${trimSlash(base)}/domain/${encodeURIComponent(domain)}`;
    const res  = await fetchUpstream(url, { timeoutMs });
    if (res.status === 404) throw new Error(`Domain not found: ${domain}`);
    if (!res.ok) throw new Error(`RDAP query failed: ${res.status}`);
    const data = await res.json();

    return { [host]: { ...data, __raw: formatDomain(data) } };
}

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

    const order = ['registrar', 'registrant', 'administrative', 'technical', 'abuse', 'reseller'];
    const byRole = new Map();
    for (const e of data.entities || []) {
        for (const role of (e.roles?.length ? e.roles : ['unknown'])) {
            if (!byRole.has(role)) byRole.set(role, []);
            byRole.get(role).push(e);
        }
    }
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
