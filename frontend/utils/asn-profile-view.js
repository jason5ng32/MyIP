// Pure shaping for the ASN Profile page (advanced-tools/AsnProfile.vue) over
// the one `/api/asn-profile` response (sections + `status`, see
// common/asn-profile.js): which sections render, hero identity, key facts,
// registration rows, customer cone, RPKI summary, prefix rows, country
// shares, neighbour groups, the reputation meters / verdict and the
// PeeringDB hero line, facts and IX / facility lists.
//
// Relative imports keep this file importable from the Node test runner.
import { parseCidr } from './ip-math.js';
import { prefixSize, announcedIpv4, ipv4SharePercent } from './asn-profile.js';

/* ------------------------------------------------------------------ */
/* Small parsers                                                       */
/* ------------------------------------------------------------------ */

// Server-formatted integer ('2,346' / '2.346' / 2346) → number; null when
// missing or digit-free. Radar counts are integers, so separators just drop.
export const parseCount = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const digits = value.replace(/\D/g, '');
    return digits ? Number(digits) : null;
};

// First argument that looks like an ISO alpha-2 code, upper-cased; else null.
export const pickCountryCode = (...codes) => {
    const hit = codes.find((code) => typeof code === 'string' && /^[A-Za-z]{2}$/.test(code));
    return hit ? hit.toUpperCase() : null;
};

// RDAP timestamp → its 'YYYY-MM-DD' calendar day as the registry wrote it
// (no zone shift); null when it doesn't start with one.
export const rdapDay = (value) => {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(typeof value === 'string' ? value : '');
    return match ? match[1] : null;
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/* ------------------------------------------------------------------ */
/* Response                                                            */
/* ------------------------------------------------------------------ */

// Cache-buster: bump on response-shape changes (sent as `v=`).
export const ASN_PROFILE_VERSION = 6;

// Client budget for the one request: above the backend's largest
// per-section deadline (DEADLINES in common/asn-profile.js).
export const ASN_PROFILE_TIMEOUT_MS = 20000;

export const asnProfileUrl = (asn) => `/api/asn-profile?asn=${asn}&v=${ASN_PROFILE_VERSION}`;

// Section data when its status is 'ok', else null.
export const sectionData = (profile, section) => (profile?.status?.[section] === 'ok' ? profile[section] ?? null : null);

// No section has anything: an unknown / unannounced AS.
export const isProfileEmpty = (profile) => !Object.values(profile?.status || {}).includes('ok');

// Source names of the sections that failed, de-duplicated, for the one
// "partially loaded" note.
const SECTION_SOURCE = {
    radar: 'Cloudflare Radar',
    prefixes: 'Cloudflare Radar',
    connectivity: 'CAIDA AS Relationships',
    whois: 'RIR RDAP',
    rank: 'CAIDA AS Rank',
    reputation: 'IPCheck.ing',
    peeringdb: 'PeeringDB',
};

export const failedSources = (profile) => [...new Set(Object.entries(profile?.status || {})
    .filter(([, status]) => status === 'error')
    .map(([section]) => SECTION_SOURCE[section])
    .filter(Boolean))];

// Any edge at all — an AS unknown to CAIDA still comes back as a lone
// origin node; a Tier 1 origin has peering edges into the clique.
export const hasTopology = (graph) => Array.isArray(graph?.edges) && graph.edges.length > 0;

export const isTier1Origin = (graph) => Array.isArray(graph?.nodes)
    && graph.nodes.some((node) => node.asn === graph.origin && node.type === 'origin-tier1');

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

// Name / org / country with one precedence for all three — Radar (the
// source ASN Info shows), then RDAP, then ASRank — so the hero never
// contradicts the IP card's ASN Info.
export const heroIdentity = ({ radar, whois, rank } = {}) => {
    const name = radar?.asnName || whois?.name || rank?.asnName || null;
    let org = radar?.asnOrgName || whois?.registrant || rank?.orgName || null;
    if (org && name && org === name) org = null;
    const country = pickCountryCode(radar?.asnCountryCode, whois?.country, rank?.country);
    return { name, org, country };
};

// Registration rows in display order, empties dropped. Dates go through
// `formatDay` ('YYYY-MM-DD' → display string).
export const registrationFields = (whois, formatDay = (day) => day) => {
    if (!isObject(whois)) return [];
    const registered = rdapDay(whois.registered);
    const lastChanged = rdapDay(whois.lastChanged);
    const status = Array.isArray(whois.status) ? whois.status.filter(Boolean).join(', ') : '';
    return [
        { key: 'registry', value: whois.rir },
        { key: 'status', value: status },
        { key: 'registered', value: registered && formatDay(registered) },
        { key: 'lastChanged', value: lastChanged && formatDay(lastChanged) },
        { key: 'abuse', value: whois.abuse, mono: true, wide: true },
    ].filter((field) => field.value);
};

/* ------------------------------------------------------------------ */
/* Key facts + customer cone                                           */
/* ------------------------------------------------------------------ */

// Prefix rows per family.
export const familyCounts = (rows) => ({
    v4: rows.filter((row) => row.family === 4).length,
    v6: rows.filter((row) => row.family === 6).length,
});

const positive = (value) => Number.isFinite(value) && value > 0;

// Hero key facts as raw numbers (the page formats them); a fact whose
// source has nothing is left out. Prefix counts and announced IPv4 both
// come from the prefix list — the same rows the table, its header and the
// RPKI summary use — never from Radar's routing stats.
export const keyFacts = ({ radar, rank, rows } = {}) => {
    const facts = [];
    if (positive(rank?.rank)) facts.push({ key: 'rank', value: rank.rank });

    const v4Addresses = rows?.length ? announcedIpv4(rows.filter((r) => r.family === 4).map((r) => r.prefix)) : 0;
    if (v4Addresses > 0) facts.push({ key: 'announcedIpv4', value: v4Addresses, share: ipv4SharePercent(v4Addresses) });

    if (rows?.length) facts.push({ key: 'prefixes', ...familyCounts(rows) });

    const users = parseCount(radar?.estimatedUsers);
    if (positive(users)) facts.push({ key: 'users', value: users });
    return facts;
};

// ASRank customer-cone size in ASes; null when absent. Cone prefixes and
// addresses are deliberately not shown: they describe the whole cone, not
// this AS's own announcements, and read as contradictions next to them.
export const coneAsns = (rank) => (positive(rank?.cone?.asns) ? rank.cone.asns : null);

/* ------------------------------------------------------------------ */
/* Prefixes + RPKI                                                     */
/* ------------------------------------------------------------------ */

export const RPKI_STATES = ['valid', 'invalid', 'unknown'];

// Radar's verdict string in any casing → one of RPKI_STATES.
export const normalizeRpki = (value) => {
    const state = String(value ?? '').trim().toLowerCase();
    return RPKI_STATES.includes(state) ? state : 'unknown';
};

// Table rows: valid CIDRs only, IPv4 before IPv6, then by address and
// prefix length. `count` is v4 addresses or v6 /48s (null past /48).
export const shapePrefixRows = (prefixes) => {
    if (!Array.isArray(prefixes)) return [];
    return prefixes.flatMap((item) => {
        const prefix = typeof item?.prefix === 'string' ? item.prefix.trim() : '';
        const cidr = parseCidr(prefix);
        if (!cidr) return [];
        return [{
            prefix,
            family: cidr.family,
            length: cidr.prefix,
            network: cidr.network,
            count: prefixSize(prefix).count,
            rpki: normalizeRpki(item.rpki),
            peers: Number(item.peers) || 0,
        }];
    }).sort((a, b) => a.family - b.family
        || (a.network < b.network ? -1 : a.network > b.network ? 1 : 0)
        || a.length - b.length);
};

// family: 'all' | 'v4' | 'v6'.
export const filterPrefixRows = (rows, family) => {
    if (family === 'v4') return rows.filter((row) => row.family === 4);
    if (family === 'v6') return rows.filter((row) => row.family === 6);
    return rows;
};

// Route-origin validation counts and shares over the prefix rows (so the
// bar always matches the table). null when there is nothing to count.
export const rpkiSummary = (rows = []) => {
    const counts = { valid: 0, invalid: 0, unknown: 0 };
    rows.forEach((row) => { counts[row.rpki] += 1; });
    const total = counts.valid + counts.invalid + counts.unknown;
    if (!total) return null;
    const pct = Object.fromEntries(RPKI_STATES.map((state) => [state, (counts[state] / total) * 100]));
    // Floored, so a single invalid route never reads as "100% valid".
    const validPct = counts.valid === total ? 100 : Math.floor(pct.valid * 10) / 10;
    return { counts, pct, total, validPct };
};

// Plain-text export, one prefix per line.
export const prefixListText = (rows) => rows.map((row) => row.prefix).join('\n');

/* ------------------------------------------------------------------ */
/* Countries                                                           */
/* ------------------------------------------------------------------ */

const validCountries = (countries) => (Array.isArray(countries) ? countries : [])
    .filter((row) => pickCountryCode(row?.country) && Number(row.share) > 0)
    .map((row) => ({ cc: row.country.toUpperCase(), share: Number(row.share) }));

// Top-N list rows: percentage (one decimal) and a bar width relative to
// the largest country, floored at 2% so a sliver stays visible.
export const countryShareRows = (countries, limit = 10) => {
    const rows = validCountries(countries).sort((a, b) => b.share - a.share).slice(0, limit);
    const max = rows[0]?.share || 1;
    return rows.map(({ cc, share }) => ({
        cc,
        pct: Math.round(share * 1000) / 10,
        bar: Math.max((share / max) * 100, 2),
    }));
};

/* ------------------------------------------------------------------ */
/* Neighbours                                                          */
/* ------------------------------------------------------------------ */

const NEIGHBOUR_KINDS = ['providers', 'peers', 'customers'];

// One group per relationship kind: full count, the first `preview` names
// (ASN when as2org has none) and how many more there are.
export const neighbourGroups = (neighbours, preview = 8) => NEIGHBOUR_KINDS.map((kind) => {
    const list = Array.isArray(neighbours?.[kind]) ? neighbours[kind] : [];
    const count = Number.isFinite(neighbours?.counts?.[kind]) ? neighbours.counts[kind] : list.length;
    const names = list.slice(0, preview).map((item) => ({
        asn: item.asn,
        label: item.name || `AS${item.asn}`,
    }));
    return { kind, count, names, more: Math.max(0, count - names.length) };
});

/* ------------------------------------------------------------------ */
/* Reputation                                                          */
/* ------------------------------------------------------------------ */

// Log axis over the AS/baseline ratio: 0 → 0%, 1× → ~15%, 100× → 100%.
const RATIO_MAX = 100;
export const ratioPosition = (ratio) => {
    const r = Number(ratio);
    if (!Number.isFinite(r) || r <= 0) return 0;
    return Math.min(100, (Math.log10(1 + r) / Math.log10(1 + RATIO_MAX)) * 100);
};

export const BASELINE_POSITION = ratioPosition(1);

// The two lists the scoring compares with a baseline (abuse, VPN), as the
// multiple of it: a log-bar position (floored at 1% so it never vanishes)
// and a tone by which side of the baseline it sits. A list without a ratio
// is left out.
export const reputationMeters = (rep) => ['abuse', 'vpn'].flatMap((key) => {
    const ratio = rep?.ratio?.[key];
    if (!Number.isFinite(ratio)) return [];
    return [{
        key,
        ratio,
        pos: Math.max(ratioPosition(ratio), 1),
        tone: ratio > 1 ? 'ok-slow' : 'ok-fast',
    }];
});

// Public proxies: just how many listed addresses were found, when any were.
export const proxyListedCount = (rep) => {
    const count = Number(rep?.proxy);
    return Number.isFinite(count) && count > 0 ? count : null;
};

// Verdict from the scoring level; colour only, no thresholds here.
export const VERDICT_TONE = { none: 'ok-fast', low: 'ok-fast', medium: 'ok-slow', high: 'fail' };

export const verdictLevel = (rep) => (rep?.found === true && rep.level in VERDICT_TONE ? rep.level : null);

/* ------------------------------------------------------------------ */
/* PeeringDB                                                           */
/* ------------------------------------------------------------------ */

// PeeringDB's fixed vocabularies → locale key slugs under
// asnprofile.peering.*; a value outside them is shown as PeeringDB wrote it.
export const PEERING_ENUMS = {
    types: {
        'Cable/DSL/ISP': 'isp', NSP: 'nsp', Content: 'content', Enterprise: 'enterprise',
        'Educational/Research': 'education', 'Non-Profit': 'nonProfit', Government: 'government',
        'Route Server': 'routeServer', 'Route Collector': 'routeCollector', 'Network Services': 'networkServices',
    },
    scopes: {
        Regional: 'regional', 'North America': 'northAmerica', 'Asia Pacific': 'asiaPacific', Europe: 'europe',
        'South America': 'southAmerica', Africa: 'africa', Australia: 'australia', 'Middle East': 'middleEast',
        Global: 'global',
    },
    ratios: {
        Balanced: 'balanced', 'Mostly Inbound': 'mostlyInbound', 'Heavy Inbound': 'heavyInbound',
        'Mostly Outbound': 'mostlyOutbound', 'Heavy Outbound': 'heavyOutbound',
    },
    policies: { Open: 'open', Selective: 'selective', Restrictive: 'restrictive', No: 'no' },
};

// Locale key for a vocabulary value, or null when it isn't one.
export const peeringEnumKey = (group, value) => {
    const slug = PEERING_ENUMS[group]?.[value];
    return slug ? `asnprofile.peering.${group}.${slug}` : null;
};

// An http(s) URL without userinfo as { href, label: host without "www." };
// null otherwise.
export const websiteLink = (value) => {
    if (typeof value !== 'string') return null;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (url.username || url.password) return null;
        return { href: url.href, label: url.hostname.replace(/^www\./i, '') };
    } catch {
        return null;
    }
};

// Hero additions: network types, website, scope — each only when present.
export const peeringHero = (pdb) => ({
    types: Array.isArray(pdb?.types) ? pdb.types.filter((type) => typeof type === 'string' && type) : [],
    website: websiteLink(pdb?.website),
    scope: typeof pdb?.scope === 'string' && pdb.scope ? pdb.scope : null,
});

// The card's fact rows in display order, empties dropped. `group` names
// the vocabulary a value is translated through.
export const peeringFacts = (pdb) => [
    { key: 'policy', value: pdb?.policy, group: 'policies' },
    { key: 'traffic', value: pdb?.traffic },
    { key: 'ratio', value: pdb?.ratio, group: 'ratios' },
    { key: 'irr', value: pdb?.irrAsSet, mono: true },
].filter((fact) => typeof fact.value === 'string' && fact.value);

// Port capacity in Mbps → '100M' / '10G' / '1.2T' (one decimal at most).
// `format` renders the number (the page passes a locale formatter).
export const formatPortSpeed = (mbps, format = (n) => String(n)) => {
    const value = Number(mbps);
    if (!Number.isFinite(value) || value <= 0) return '';
    const [amount, unit] = value >= 1e6 ? [value / 1e6, 'T'] : value >= 1000 ? [value / 1000, 'G'] : [value, 'M'];
    return `${format(Math.round(amount * 10) / 10)}${unit}`;
};

const placeRow = (item) => ({
    name: item.name,
    city: typeof item.city === 'string' ? item.city : '',
    cc: pickCountryCode(item.country),
});

// IX rows in the backend's order (capacity first); unnamed entries dropped.
export const exchangeRows = (pdb) => (Array.isArray(pdb?.ixs) ? pdb.ixs : [])
    .filter((item) => typeof item?.name === 'string' && item.name)
    .map((item) => ({ ...placeRow(item), speed: Number(item.speed) || 0, rsPeer: item.rsPeer === true }));

export const facilityRows = (pdb) => (Array.isArray(pdb?.facilities) ? pdb.facilities : [])
    .filter((item) => typeof item?.name === 'string' && item.name)
    .map(placeRow);

// The Peering & facilities card needs at least one list entry; facts alone
// don't carry it.
export const hasPeeringCard = (pdb) => exchangeRows(pdb).length > 0 || facilityRows(pdb).length > 0;

// First `first` rows unless expanded.
export const visibleRows = (rows, expanded, first = 10) => (expanded ? rows : rows.slice(0, first));
