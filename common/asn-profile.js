// Composition behind /api/asn-profile: every data source of the ASN Profile
// page fetched in parallel, each under its own deadline, answered as one
// object. A source that fails or runs out of time is just absent (null) with
// its status set; the response is still whole. Pure apart from the injected
// loaders, so tests need no network.
//
// Response shape (one key per section, plus `status`):
//   { asn, status: { radar, prefixes, connectivity, whois, rank, reputation, peeringdb },
//     radar, prefixes, connectivity, whois, rank, reputation, peeringdb }
// status values: 'ok' (data present) · 'empty' (source answered, nothing
// for this AS) · 'error' (failed / timed out) · 'disabled' (not configured
// on this deployment). Section data is non-null only for 'ok'.

import logger from './logger.js';

export const SECTIONS = ['radar', 'prefixes', 'connectivity', 'whois', 'rank', 'reputation', 'peeringdb'];

// Upstream timeouts api/asn-profile.js hands to the sources that take one.
export const SOURCE_TIMEOUTS = { autnum: 5000, rank: 4000, reputation: 4000 };

const UPSTREAM_DEFAULT_MS = 8000; // fetchUpstream's default

// Worst-case time (ms) each source's own upstream timeouts allow, so a
// source that degrades internally still answers before its deadline:
//   radar        7 parallel Radar calls at the fetchUpstream default
//   prefixes     one Radar pfx2as call + local MaxMind
//   whois        IANA bootstrap (default, cached 24 h), then RDAP autnum
//   connectivity local CAIDA + RIPEstat name fallback (3 s, in parallel)
//   rank / reputation  ASRank GraphQL / private API
//   peeringdb    local index, no I/O
export const INNER_TIMEOUTS = {
    radar: UPSTREAM_DEFAULT_MS,
    prefixes: UPSTREAM_DEFAULT_MS,
    whois: UPSTREAM_DEFAULT_MS + SOURCE_TIMEOUTS.autnum,
    connectivity: 3000,
    rank: SOURCE_TIMEOUTS.rank,
    reputation: SOURCE_TIMEOUTS.reputation,
    peeringdb: 0,
};

// Per-section budget (ms): each sits above its source's worst case
// (INNER_TIMEOUTS), so the whole answer is bounded by the largest.
export const DEADLINES = {
    radar: 10000,
    prefixes: 10000,
    connectivity: 5000,
    whois: 14000,
    rank: 5000,
    reputation: 5000,
    peeringdb: 1000,
};

// Reject with a code 'deadline' error when `promise` outlives `ms`. The
// underlying work keeps running; its late result is ignored.
export const withDeadline = (promise, ms) => {
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(Object.assign(new Error(`deadline of ${ms} ms exceeded`), { code: 'deadline' }));
        }, ms);
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
};

const result = (status, data = null) => ({ status, data: status === 'ok' ? data : null });

// A field worth showing in the Radar ASN summary: any name, or a figure that
// isn't zero ('0', '0.00%', 0 — what Radar's routing stats give an AS it
// doesn't know).
export const hasMeaningfulField = (body) => Object.values(body || {}).some((value) => {
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value !== 'string' || !value.trim()) return false;
    const digits = value.replace(/[^\d.]/g, '');
    return !digits || parseFloat(digits) !== 0;
});

// -- per-section classification of a source's answer ------------------------

export const classifyRadar = (body) => result(hasMeaningfulField(body) ? 'ok' : 'empty', body);

export const classifyPrefixes = (body) => {
    if (!Array.isArray(body?.prefixes)) throw new Error('malformed bgp-prefixes payload');
    return result(body.prefixes.length ? 'ok' : 'empty', body);
};

export const classifyConnectivity = (body) => {
    const counts = body?.neighbours?.counts || {};
    const neighbours = (counts.providers || 0) + (counts.peers || 0) + (counts.customers || 0);
    const edges = Array.isArray(body?.edges) ? body.edges.length : 0;
    return result(edges || neighbours ? 'ok' : 'empty', body);
};

export const classifyRank = (record) => result(record?.rank != null ? 'ok' : 'empty', record);

// `answer` is requestAsnReputation's: null = not configured.
export const classifyReputation = (answer) => {
    if (!answer) return result('disabled');
    if (answer.status !== 200) throw new Error(`reputation upstream responded ${answer.status}`);
    return result(answer.data?.found === true ? 'ok' : 'empty', answer.data);
};

// `loaded` false = no PeeringDB index on this deployment; `record` is
// lookupPeeringdb's (null when the AS has none).
export const classifyPeeringdb = (loaded, record) => {
    if (!loaded) return result('disabled');
    return result(record ? 'ok' : 'empty', record);
};

// -- loaders ------------------------------------------------------------------

// Section loaders over the real data functions (injected — see
// api/asn-profile.js). Each resolves { status, data } or throws.
//   deps: { hasRadarKey(), fetchRadarAsn(asn), fetchRadarPrefixes(asn),
//           getConnectivity(asn), rdapAutnum(asn), isAutnumMissing(err),
//           queryAsRank(asn), requestReputation(asn),
//           isPeeringdbLoaded(), lookupPeeringdb(asn) }
export const buildSectionLoaders = (deps) => ({
    radar: async (asn) => (deps.hasRadarKey() ? classifyRadar(await deps.fetchRadarAsn(asn)) : result('disabled')),
    prefixes: async (asn) => (deps.hasRadarKey() ? classifyPrefixes(await deps.fetchRadarPrefixes(asn)) : result('disabled')),
    connectivity: async (asn) => classifyConnectivity(await deps.getConnectivity(asn)),
    whois: async (asn) => {
        try {
            return result('ok', await deps.rdapAutnum(asn));
        } catch (error) {
            if (deps.isAutnumMissing(error)) return result('empty');
            throw error;
        }
    },
    rank: async (asn) => classifyRank(await deps.queryAsRank(asn)),
    reputation: async (asn) => classifyReputation(await deps.requestReputation(asn)),
    peeringdb: async (asn) => classifyPeeringdb(deps.isPeeringdbLoaded(), deps.lookupPeeringdb(asn)),
});

// Run every loader under its deadline and assemble the response body.
export const composeAsnProfile = async (asn, loaders, { deadlines = DEADLINES } = {}) => {
    const settled = await Promise.allSettled(
        SECTIONS.map((section) => withDeadline(Promise.resolve().then(() => loaders[section](asn)), deadlines[section])),
    );
    const body = { asn, status: {} };
    settled.forEach((outcome, i) => {
        const section = SECTIONS[i];
        if (outcome.status === 'fulfilled') {
            body.status[section] = outcome.value.status;
            body[section] = outcome.value.data;
        } else {
            logger.warn({ err: outcome.reason, asn, section }, 'asn-profile: section failed');
            body.status[section] = 'error';
            body[section] = null;
        }
    });
    return body;
};

// Every configured source failed — the only case answered as an error.
export const allSourcesFailed = (body) => {
    const live = Object.values(body?.status || {}).filter((status) => status !== 'disabled');
    return live.length > 0 && live.every((status) => status === 'error');
};

// Edge-cache veto: only a complete answer (no section in error) is cached,
// so a degraded response is never pinned.
export const isCompleteProfile = (body) => Boolean(body?.status)
    && !Object.values(body.status).includes('error');
