// Single source of truth for the shareable diagnostic report: schema version,
// per-section field whitelists, the validator the backend runs on untrusted
// POST bodies, and the data-level IP masking applied at export time. Shared by
// both halves — the frontend builds payloads from the same specs the backend
// validates against — so a drifting field fails loudly in tests, not in prod.
// The whitelist doubles as the anti-abuse layer: a report holds no free-form
// text, every field is typed/capped, unknown keys are rejected outright.

import { isValidIP, isIPv6, isValidDomain } from './valid-ip.js';

export const REPORT_VERSION = 1;

// TTL choices offered at creation time (days) — shared by the share dialog
// and the backend. The first entry (1 day) is the default AND the value the
// backend forces when a client sends anything outside this list.
export const REPORT_TTL_DAYS = [1, 3, 7];

// Serialized size ceiling enforced by the backend before storing. A real
// full run (16 MTR probes with all hop stats + a busy enhanced-DNS capture)
// lands under ~100KB compact JSON; 256KB is ~3× that worst case while still
// bounding what one KV key can cost. KV's own value limit (25MB) is far away.
export const REPORT_MAX_BYTES = 256 * 1024;

// Connectivity status codes — single source shared by the recording component
// (ConnectivityTest.vue), the builder whitelist (utils/report-builders.js)
// and the schema enum below, so a rename can't drift them apart.
export const CONNECTIVITY_STATUS = {
    OK: 'ok',
    UNREACHABLE: 'unreachable',
    TIMEOUT: 'timeout',
};

// ---------------------------------------------------------------------------
// IP masking (data-level, applied at export time — distinct from the CSS-only
// use-info-mask blur). Masked forms are valid schema values so a masked
// report passes the same validator as an unmasked one.
// ---------------------------------------------------------------------------

const MASKED_V4_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}x$/;
const MASKED_V6_PATTERN = /^(?:[0-9a-f]{1,4}:){4}x$/i;

// A value produced by maskIpTail: v4 with the last octet as 'x', or v6 with
// the interface half replaced by 'x'.
export const isMaskedIP = (value) =>
    typeof value === 'string' && (MASKED_V4_PATTERN.test(value) || MASKED_V6_PATTERN.test(value));

// Expand a valid IPv6 string to its 8 groups (handles '::' compression).
const expandIPv6Groups = (ip) => {
    const [head, tail = ''] = ip.split('::');
    const headGroups = head === '' ? [] : head.split(':');
    if (!ip.includes('::')) return headGroups;
    const tailGroups = tail === '' ? [] : tail.split(':');
    const missing = 8 - headGroups.length - tailGroups.length;
    return [...headGroups, ...Array(missing).fill('0'), ...tailGroups];
};

// Mask the host tail of a valid IP: v4 drops the last octet ('1.2.3.x'),
// v6 drops the last 64 bits, keeping the routing prefix ('2001:db8:0:1:x').
// Non-IP input (already-masked values, error placeholders) passes through
// unchanged so callers can apply it blindly.
export const maskIpTail = (ip) => {
    if (!isValidIP(ip)) return ip;
    if (!isIPv6(ip)) {
        const octets = ip.split('.');
        octets[3] = 'x';
        return octets.join('.');
    }
    const groups = expandIPv6Groups(ip).slice(0, 4)
        .map((group) => group.replace(/^0+(?=.)/, '') || '0');
    return `${groups.join(':')}:x`;
};

// ---------------------------------------------------------------------------
// Field spec DSL — tiny declarative layer the validator and the masking
// walker both traverse. `kind` drives the check; `optional` allows the key
// to be absent; `nullable` additionally allows an explicit null.
// ---------------------------------------------------------------------------

const str = (max) => ({ kind: 'string', max });
const num = (min, max) => ({ kind: 'number', min, max });
const int = (min, max) => ({ kind: 'int', min, max });
const bool = () => ({ kind: 'bool' });
const oneOf = (...values) => ({ kind: 'enum', values });
const isoDate = () => ({ kind: 'isoDate' });
const countryCode = () => ({ kind: 'countryCode' });
const timeZone = () => ({ kind: 'timeZone' });
const ipValue = () => ({ kind: 'ip' });
const ipOrDomain = () => ({ kind: 'ipOrDomain' });
const arr = (max, items) => ({ kind: 'array', max, items });
const obj = (fields) => ({ kind: 'object', fields });
const opt = (spec) => ({ ...spec, optional: true });
const nullable = (spec) => ({ ...spec, nullable: true });

// Shared sub-shapes.
const pingStats = obj({
    min: opt(num(0, 600000)),
    max: opt(num(0, 600000)),
    avg: opt(num(0, 600000)),
    loss: opt(num(0, 100)),
    total: opt(int(0, 1000)),
    rcv: opt(int(0, 1000)),
    drop: opt(int(0, 1000)),
});

// One MTR hop as produced by parseMtrOutput. Numeric columns vary with the
// mtr build Globalping runs, so all stats are optional; unknown columns are
// dropped by the parser, never stored.
const mtrHop = obj({
    n: int(1, 64),
    asn: opt(nullable(int(0, 4294967295))),
    host: opt(str(128)),
    ip: opt(ipValue()),
    lossPct: opt(num(0, 100)),
    drop: opt(int(0, 10000)),
    rcv: opt(int(0, 10000)),
    sntCount: opt(int(0, 10000)),
    lastMs: opt(num(0, 600000)),
    avgMs: opt(num(0, 600000)),
    bestMs: opt(num(0, 600000)),
    worstMs: opt(num(0, 600000)),
    stdevMs: opt(num(0, 600000)),
    javgMs: opt(num(0, 600000)),
});

// ---------------------------------------------------------------------------
// Section specs — the whitelist. Every section carries its own testedAt.
// Only "my network" diagnostics belong here; input-lookup tools (whois,
// mac checker, …) are excluded by design.
// ---------------------------------------------------------------------------

const SECTION_SPECS = {
    ipinfo: obj({
        testedAt: isoDate(),
        cards: arr(8, obj({
            source: str(64),
            ip: opt(ipValue()),
            countryCode: opt(countryCode()),
            region: opt(str(64)),
            city: opt(str(64)),
            timezone: opt(timeZone()),
            asn: opt(str(16)),
            isp: opt(str(128)),
            // IPCheck.ing-source enrichments — absent on other sources, when
            // the upstream sign-in-gates them, or when the value is 'unknown'
            // (an unknown verdict carries no diagnostic signal).
            isProxy: opt(oneOf('yes', 'maybe', 'no')),
            ipType: opt(oneOf('business', 'residential', 'wireless', 'hosting')),
            nativeIP: opt(bool()),
            qualityScore: opt(num(0, 100)),
            proxyProtocol: opt(str(32)),
            proxyProvider: opt(str(64)),
        })),
    }),
    connectivity: obj({
        testedAt: isoDate(),
        // 72 = 7 built-in targets + the 60-target custom/import cap, plus
        // headroom; matches the builder's slice in utils/report-builders.js.
        targets: arr(72, obj({
            id: str(48),
            name: str(64),
            status: oneOf(...Object.values(CONNECTIVITY_STATUS)),
            timeMs: opt(int(0, 600000)),
            minTimeMs: opt(int(0, 600000)),
            custom: opt(bool()),
        })),
    }),
    webrtc: obj({
        testedAt: isoDate(),
        servers: arr(8, obj({
            id: str(32),
            url: str(128),
            ip: opt(ipValue()),
            natType: oneOf('host', 'srflx', 'prflx', 'relay', 'unknown', 'unavailable', 'error'),
            countryCode: opt(countryCode()),
            org: opt(str(128)),
        })),
    }),
    dnsleak: obj({
        testedAt: isoDate(),
        providers: arr(8, obj({
            id: str(32),
            name: str(64),
            ip: opt(ipValue()),
            countryCode: opt(countryCode()),
            org: opt(str(128)),
        })),
    }),
    speedtest: obj({
        testedAt: isoDate(),
        downloadMbps: opt(nullable(num(0, 1000000))),
        uploadMbps: opt(nullable(num(0, 1000000))),
        latencyMs: opt(nullable(num(0, 600000))),
        jitterMs: opt(nullable(num(0, 600000))),
        loadedLatencyDownMs: opt(nullable(num(0, 600000))),
        loadedLatencyUpMs: opt(nullable(num(0, 600000))),
        scores: opt(obj({
            streaming: opt(int(0, 10000)),
            gaming: opt(int(0, 10000)),
            rtc: opt(int(0, 10000)),
        })),
        qualities: opt(obj({
            streaming: opt(oneOf('bad', 'poor', 'average', 'good', 'great')),
            gaming: opt(oneOf('bad', 'poor', 'average', 'good', 'great')),
            rtc: opt(oneOf('bad', 'poor', 'average', 'good', 'great')),
        })),
        connection: opt(obj({
            ip: opt(ipValue()),
            colo: opt(str(8)),
            coloCountryCode: opt(countryCode()),
            coloCity: opt(str(64)),
        })),
    }),
    pingtest: obj({
        testedAt: isoDate(),
        target: ipOrDomain(),
        probes: arr(32, obj({
            countryCode: opt(countryCode()),
            stats: pingStats,
        })),
    }),
    mtrtest: obj({
        testedAt: isoDate(),
        target: ipOrDomain(),
        probes: arr(32, obj({
            countryCode: opt(countryCode()),
            city: opt(str(64)),
            network: opt(str(128)),
            asn: opt(int(0, 4294967295)),
            hops: arr(64, mtrHop),
        })),
    }),
    ruletest: obj({
        testedAt: isoDate(),
        uniqueIPCount: int(0, 16),
        workers: arr(16, obj({
            id: int(1, 16),
            ip: opt(ipValue()),
            countryCode: opt(countryCode()),
            org: opt(str(128)),
        })),
    }),
    browserinfo: obj({
        testedAt: isoDate(),
        browser: opt(obj({ name: opt(str(64)), version: opt(str(32)) })),
        os: opt(obj({ name: opt(str(64)), version: opt(str(32)) })),
        engine: opt(obj({ name: opt(str(64)), version: opt(str(32)) })),
        timezone: opt(str(64)),
        languages: opt(arr(16, str(16))),
        display: opt(obj({
            width: opt(int(0, 100000)),
            height: opt(int(0, 100000)),
            pixelRatio: opt(num(0, 100)),
        })),
        connection: opt(nullable(obj({
            effectiveType: opt(str(16)),
            downlink: opt(num(0, 100000)),
            rtt: opt(int(0, 600000)),
        }))),
    }),
    invisibility: obj({
        testedAt: isoDate(),
        ip: opt(ipValue()),
        scores: obj({
            proxy: num(0, 100),
            vpn: num(0, 100),
        }),
        flags: arr(20, obj({
            key: str(32),
            flagged: bool(),
        })),
    }),
    enhanceddnsleak: obj({
        testedAt: isoDate(),
        rawCount: int(0, 100000),
        resolverCount: int(0, 10000),
        dnssec: oneOf('ok', 'partial', 'none'),
        queries: arr(128, obj({
            ip: opt(ipValue()),
            countryCode: opt(countryCode()),
            asn: opt(str(16)),
            org: opt(str(128)),
            transport: opt(str(16)),
            ecs: opt(str(64)),
            do: opt(bool()),
            cd: opt(bool()),
        })),
    }),
};

// Section ids in homepage order — the report page renders in this order.
export const REPORT_SECTION_IDS = Object.keys(SECTION_SPECS);

// The envelope around sections.
const ENVELOPE_SPEC = obj({
    v: int(REPORT_VERSION, REPORT_VERSION),
    generatedAt: isoDate(),
    origin: str(64),
    locale: str(8),
    sections: { kind: 'sections' },
});

// ---------------------------------------------------------------------------
// Validator — walks the specs above over an untrusted value. Never throws;
// returns { ok, errors } with errors capped so a garbage payload can't
// produce an unbounded 400 body.
// ---------------------------------------------------------------------------

const MAX_ERRORS = 20;

const isPlainObject = (value) =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const checkLeaf = (value, spec) => {
    switch (spec.kind) {
        case 'string':
            return typeof value === 'string' && value.length <= spec.max
                ? null : `expected string (max ${spec.max})`;
        case 'number':
            return typeof value === 'number' && Number.isFinite(value)
                && value >= spec.min && value <= spec.max
                ? null : `expected number in [${spec.min}, ${spec.max}]`;
        case 'int':
            return Number.isInteger(value) && value >= spec.min && value <= spec.max
                ? null : `expected integer in [${spec.min}, ${spec.max}]`;
        case 'bool':
            return typeof value === 'boolean' ? null : 'expected boolean';
        case 'enum':
            return spec.values.includes(value)
                ? null : `expected one of ${spec.values.join('|')}`;
        case 'isoDate':
            return typeof value === 'string' && value.length <= 32
                && !Number.isNaN(Date.parse(value))
                ? null : 'expected ISO date string';
        case 'countryCode':
            // '' is a legal "unknown" — several sources can't always geolocate.
            return typeof value === 'string' && (value === '' || /^[a-z]{2}$/i.test(value))
                ? null : 'expected 2-letter country code or empty string';
        case 'timeZone':
            // IANA zone names: 'UTC', 'Asia/Singapore', 'America/Argentina/Buenos_Aires'.
            // Unlike countryCode, '' is not legal here — the builder omits the
            // field rather than reporting a zone it couldn't derive.
            return typeof value === 'string' && value.length <= 64
                && /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(value)
                ? null : 'expected IANA time zone name';
        case 'ip':
            return typeof value === 'string' && (isValidIP(value) || isMaskedIP(value))
                ? null : 'expected IP address (full or tail-masked)';
        case 'ipOrDomain':
            return typeof value === 'string' && value.length <= 253
                && (isValidIP(value) || isMaskedIP(value) || isValidDomain(value))
                ? null : 'expected IP address or domain name';
        default:
            return `unknown spec kind ${spec.kind}`;
    }
};

const validateValue = (value, spec, path, errors) => {
    if (errors.length >= MAX_ERRORS) return;
    if (value === null) {
        if (!spec.nullable) errors.push(`${path}: unexpected null`);
        return;
    }
    if (spec.kind === 'array') {
        if (!Array.isArray(value)) { errors.push(`${path}: expected array`); return; }
        if (value.length > spec.max) { errors.push(`${path}: too many items (max ${spec.max})`); return; }
        value.forEach((item, i) => validateValue(item, spec.items, `${path}[${i}]`, errors));
        return;
    }
    if (spec.kind === 'object') {
        if (!isPlainObject(value)) { errors.push(`${path}: expected object`); return; }
        for (const key of Object.keys(value)) {
            if (!Object.prototype.hasOwnProperty.call(spec.fields, key)) {
                errors.push(`${path}.${key}: unknown key`);
                if (errors.length >= MAX_ERRORS) return;
            }
        }
        for (const [key, fieldSpec] of Object.entries(spec.fields)) {
            const present = Object.prototype.hasOwnProperty.call(value, key)
                && value[key] !== undefined;
            if (!present) {
                if (!fieldSpec.optional) errors.push(`${path}.${key}: missing required key`);
                continue;
            }
            validateValue(value[key], fieldSpec, `${path}.${key}`, errors);
            if (errors.length >= MAX_ERRORS) return;
        }
        return;
    }
    if (spec.kind === 'sections') {
        if (!isPlainObject(value)) { errors.push(`${path}: expected object`); return; }
        const keys = Object.keys(value);
        if (keys.length === 0) { errors.push(`${path}: at least one section required`); return; }
        for (const key of keys) {
            if (!Object.prototype.hasOwnProperty.call(SECTION_SPECS, key)) {
                errors.push(`${path}.${key}: unknown section`);
                if (errors.length >= MAX_ERRORS) return;
                continue;
            }
            validateValue(value[key], SECTION_SPECS[key], `${path}.${key}`, errors);
            if (errors.length >= MAX_ERRORS) return;
        }
        return;
    }
    const leafError = checkLeaf(value, spec);
    if (leafError) errors.push(`${path}: ${leafError}`);
};

// Validate a full report envelope. Returns { ok: boolean, errors: string[] }.
export const validateReport = (report) => {
    const errors = [];
    if (!isPlainObject(report)) {
        return { ok: false, errors: ['report: expected object'] };
    }
    validateValue(report, ENVELOPE_SPEC, 'report', errors);
    return { ok: errors.length === 0, errors };
};

// ---------------------------------------------------------------------------
// Spec-driven IP masking — walks the same specs and rewrites every 'ip'
// field (and 'ipOrDomain' fields that hold an IP) via maskIpTail. Returns a
// new object; the input is never mutated (the collector keeps full data).
// ---------------------------------------------------------------------------

const maskValue = (value, spec) => {
    if (value === null || value === undefined) return value;
    if (spec.kind === 'array') {
        return Array.isArray(value) ? value.map((item) => maskValue(item, spec.items)) : value;
    }
    if (spec.kind === 'object') {
        if (!isPlainObject(value)) return value;
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            out[key] = Object.prototype.hasOwnProperty.call(spec.fields, key)
                ? maskValue(item, spec.fields[key]) : item;
        }
        return out;
    }
    if (spec.kind === 'sections') {
        if (!isPlainObject(value)) return value;
        const out = {};
        for (const [key, section] of Object.entries(value)) {
            out[key] = Object.prototype.hasOwnProperty.call(SECTION_SPECS, key)
                ? maskValue(section, SECTION_SPECS[key]) : section;
        }
        return out;
    }
    if (spec.kind === 'ip' || spec.kind === 'ipOrDomain') {
        return maskIpTail(value);
    }
    return value;
};

// Apply tail-masking to every IP in a report envelope (the 'mask-tail'
// privacy option in the share dialog).
export const maskReportIps = (report) => {
    if (!isPlainObject(report)) return report;
    return { ...report, sections: maskValue(report.sections, { kind: 'sections' }) };
};
