// Pure layer of the Bulk IP Lookup input: picks every IPv4 / IPv6 out of
// arbitrary text (plain lists, Nginx / Apache / JSON / CSV logs) by scanning
// for runs of IP characters rather than splitting by format. Only public IPs
// are kept, in canonical form, with their occurrence counts.

import { isValidIP, isValidIPv4, isUsablePublicIP } from '../ip/valid-ip.js';
import { parseIPv6, formatIPv4, formatIPv6 } from '../ip/ip-math.js';

// A run of characters an IP (or ip:port) can be made of.
const RUN = /[0-9A-Fa-f:.]+/g;
const V4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
// An IPv4 closing a run, optionally with a port: `c:1.2.3.4:443`, `1.2.3.4:80`.
const V4_TAIL = /(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/;
// Defanged IOC notation: 1.2.3[.]4, 1(.)2(.)3(.)4, 2001[:]db8::1.
const DEFANGED = /\[\.\]|\(\.\)|\{\.\}/g;
const DEFANGED_COLON = /\[:\]/g;
const LETTER = /[A-Za-z]/;

const V4_MAPPED_PREFIX = 0xffffn;

// Canonical spelling of one IP token, or null: IPv4 as-is (leading zeros
// rejected — they read as octal elsewhere), IPv6 per RFC 5952, and an
// IPv4-mapped IPv6 (`::ffff:1.2.3.4`) as its IPv4.
export const canonicalIP = (token) => {
    if (typeof token !== 'string') return null;
    if (V4.test(token)) return isValidIPv4(token) ? token : null;
    if (!token.includes(':')) return null;
    const parsed = parseIPv6(token);
    if (!parsed) return null;
    const ip = (parsed.value >> 32n) === V4_MAPPED_PREFIX
        ? formatIPv4(parsed.value & 0xffffffffn)
        : formatIPv6(parsed.value);
    return isValidIP(ip) ? ip : null;
};

// Strip what punctuation glues to a token: a single leading `:` (`ip:1.2.3.4`;
// a leading `::` is IPv6), trailing dots (end of a sentence), one trailing `:`.
const trimToken = (run) => {
    let token = run;
    if (token.startsWith(':') && !token.startsWith('::')) token = token.slice(1);
    token = token.replace(/\.+$/, '');
    if (token.endsWith(':') && !token.endsWith('::')) token = token.slice(0, -1);
    return token;
};

// One run → { ip } | { cidr } | null, given the characters around it.
const readRun = (line, run, start) => {
    if (!run.includes('.') && !run.includes(':')) return null;
    // A run opening on `.` sits inside a dotted word or version string.
    if (run.startsWith('.')) return null;
    const before = start > 0 ? line[start - 1] : '';
    const after = line[start + run.length] ?? '';
    if (LETTER.test(after)) return null;

    let token = run;
    if (before === '/') return null; // Chrome/120.0.0.0, Safari/537.36
    if (LETTER.test(before) && !/^:(?!:)/.test(token)) {
        // `src:1.2.3.4` scans as `c:1.2.3.4` (c is hex): drop that hex tail of
        // the key. Anything else glued to a word — Version17.4.1.2 — is not an IP.
        const keyTail = /^[A-Fa-f]+:(?!:)/.exec(token);
        if (!keyTail) return null;
        token = token.slice(keyTail[0].length);
    }
    token = trimToken(token);

    const ip = canonicalIP(token) ?? canonicalIP(V4_TAIL.exec(token)?.[1]);
    if (!ip) return null;

    // `/n` within the family's prefix range is a CIDR; a larger number is a
    // port in `ip/port` notation (firewall logs).
    if (after === '/') {
        const prefix = /^\/(\d{1,3})(?!\d)/.exec(line.slice(start + run.length))?.[1];
        if (prefix !== undefined && Number(prefix) <= (ip.includes(':') ? 128 : 32)) {
            return { cidr: `${ip}/${Number(prefix)}` };
        }
    }
    return { ip };
};

// Extract IPs from `text`. `firstPerLine` keeps only each line's first public
// IP (CDN / proxy logs carrying the edge or XFF hops on the same line).
// → { entries: [{ ip, count }] in first-seen order,
//     summary: { found, unique, reserved, cidr } } — `found` counts
//     occurrences; `unique`, `reserved` and `cidr` count distinct values.
export const extractIPs = (text, { firstPerLine = false } = {}) => {
    const counts = new Map();
    const reserved = new Set();
    const cidrs = new Set();
    let found = 0;

    if (typeof text === 'string' && text) {
        const refanged = text.replace(DEFANGED, '.').replace(DEFANGED_COLON, ':');
        for (const line of refanged.split(/\r?\n/)) {
            for (const match of line.matchAll(RUN)) {
                const hit = readRun(line, match[0], match.index);
                if (!hit) continue;
                if (hit.cidr) {
                    cidrs.add(hit.cidr);
                    continue;
                }
                if (!isUsablePublicIP(hit.ip)) {
                    reserved.add(hit.ip);
                    continue;
                }
                counts.set(hit.ip, (counts.get(hit.ip) ?? 0) + 1);
                found += 1;
                if (firstPerLine) break;
            }
        }
    }

    return {
        entries: [...counts].map(([ip, count]) => ({ ip, count })),
        summary: { found, unique: counts.size, reserved: reserved.size, cidr: cidrs.size },
    };
};
