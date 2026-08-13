// Builders that turn the domain events emitted by test components into
// report-schema sections (see common/report-schema.js). Components emit raw
// snapshots of their own state — including wait/error placeholder strings —
// and every normalization rule here is shape-based (is it a valid IP? was a
// geo lookup recorded?), never a comparison against localized text. Each
// builder returns a schema-shaped section object, or null when the payload
// holds nothing worth reporting.

import { isValidIP } from './valid-ip.js';
import { CONNECTIVITY_STATUS } from './report-schema.js';

// --- small shared normalizers ----------------------------------------------

const clip = (value, max) =>
    typeof value === 'string' ? value.slice(0, max) : undefined;

const finiteNum = (value, min, max) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
        ? value : undefined;

const clampInt = (value, min, max) => {
    if (!Number.isInteger(value)) return undefined;
    return Math.min(Math.max(value, min), max);
};

const countryCode = (value) =>
    typeof value === 'string' && /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : '';

const ipOrUndefined = (value) => (isValidIP(value) ? value : undefined);

// Drop undefined values so optional schema keys are absent, not null.
const compact = (obj) => {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
};

// --- per-section builders ---------------------------------------------------

// ipinfo:finished — { cards: [{ source, ip, country_code, region, city,
// timezone, asn, isp, proxyCode?, ipTypeCode?, isNativeIP?, qualityScore?,
// proxyProtocol?, proxyProvider? }] }. Cards whose ip never resolved (placeholder text in the
// slot) are dropped. The optional enrichments only exist on the IPCheck.ing
// source and stay absent when gated ('sign_in_required' / 'quota_exceeded'
// upstream values never turn into codes — see transform-ip-data.js). 'unknown' codes
// are noise in a report ("Unknown type" says nothing) — dropped like absent.
const PROXY_CODES = new Set(['yes', 'maybe', 'no']);
const IP_TYPE_CODES = new Set(['business', 'residential', 'wireless', 'hosting']);
const buildIpinfo = (payload) => {
    const cards = (payload?.cards ?? [])
        .filter((card) => isValidIP(card?.ip))
        .slice(0, 8)
        .map((card) => compact({
            source: clip(card.source, 64) ?? '',
            ip: card.ip,
            countryCode: countryCode(card.country_code),
            region: clip(card.region, 64),
            city: clip(card.city, 64),
            // Absent rather than empty when the source gave no usable
            // coordinates — the schema has no '' spelling for a zone.
            timezone: card.timezone ? clip(card.timezone, 64) : undefined,
            asn: clip(card.asn, 16),
            isp: clip(card.isp, 128),
            isProxy: PROXY_CODES.has(card.proxyCode) ? card.proxyCode : undefined,
            ipType: IP_TYPE_CODES.has(card.ipTypeCode) ? card.ipTypeCode : undefined,
            nativeIP: typeof card.isNativeIP === 'boolean' ? card.isNativeIP : undefined,
            qualityScore: finiteNum(Number(card.qualityScore), 0, 100),
            proxyProtocol: card.proxyProtocol && card.proxyProtocol !== 'unknown'
                ? clip(card.proxyProtocol, 32) : undefined,
            proxyProvider: card.proxyProvider && card.proxyProvider !== 'unknown'
                ? clip(card.proxyProvider, 64) : undefined,
        }));
    return cards.length ? { cards } : null;
};

// connectivity:finished — { targets: [{ id, name, custom, statusCode, time, mintime }] }
// statusCode is the locale-free enum the component records next to its
// localized status label; targets still waiting carry none and are dropped.
const CONNECTIVITY_STATUSES = new Set(Object.values(CONNECTIVITY_STATUS));
const buildConnectivity = (payload) => {
    const targets = (payload?.targets ?? [])
        .filter((target) => CONNECTIVITY_STATUSES.has(target?.statusCode))
        // 72 = 7 built-ins + the 60-target custom/import cap, with headroom —
        // reports carry every tested target rather than a confusing subset.
        .slice(0, 72)
        .map((target) => compact({
            id: clip(target.id, 48) ?? '',
            name: clip(target.name, 64) ?? '',
            status: target.statusCode,
            timeMs: clampInt(target.time, 0, 600000),
            minTimeMs: clampInt(target.mintime, 0, 600000),
            custom: target.custom === true ? true : undefined,
        }));
    return targets.length ? { targets } : null;
};

// webrtc:finished — { servers: [{ id, url, ip, natTypeCode, country_code, org }] }
// org is only trusted when a geo lookup landed (country_code recorded with it).
const NAT_TYPES = new Set(['host', 'srflx', 'prflx', 'relay', 'unknown', 'unavailable', 'error']);
const buildWebrtc = (payload) => {
    const servers = (payload?.servers ?? [])
        .filter((server) => NAT_TYPES.has(server?.natTypeCode))
        .slice(0, 8)
        .map((server) => {
            const cc = countryCode(server.country_code);
            return compact({
                id: clip(server.id, 32) ?? '',
                url: clip(server.url, 128) ?? '',
                ip: ipOrUndefined(server.ip),
                natType: server.natTypeCode,
                countryCode: cc,
                org: cc ? clip(server.org, 128) : undefined,
            });
        });
    return servers.length ? { servers } : null;
};

// dnsleak:finished — { providers: [{ id, name, ip, country_code, org }] }
const buildDnsleak = (payload) => {
    const providers = (payload?.providers ?? [])
        .filter((provider) => isValidIP(provider?.ip))
        .slice(0, 8)
        .map((provider) => {
            const cc = countryCode(provider.country_code);
            return compact({
                id: clip(provider.id, 32) ?? '',
                name: clip(provider.name, 64) ?? '',
                ip: provider.ip,
                countryCode: cc,
                org: cc ? clip(provider.org, 128) : undefined,
            });
        });
    return providers.length ? { providers } : null;
};

// speedtest:finished — thickened payload; numeric fields may be '-' until
// measured, which finiteNum turns into an absent key.
const QUALITIES = new Set(['bad', 'poor', 'average', 'good', 'great']);
const quality = (value) => (QUALITIES.has(value) ? value : undefined);
const buildSpeedtest = (payload) => {
    if (!payload) return null;
    const section = compact({
        downloadMbps: finiteNum(payload.downloadSpeed, 0, 1000000),
        uploadMbps: finiteNum(payload.uploadSpeed, 0, 1000000),
        latencyMs: finiteNum(payload.latency, 0, 600000),
        jitterMs: finiteNum(payload.jitter, 0, 600000),
        loadedLatencyDownMs: finiteNum(payload.downLoadedLatency, 0, 600000),
        loadedLatencyUpMs: finiteNum(payload.upLoadedLatency, 0, 600000),
    });
    if (Object.keys(section).length === 0) return null;

    const scores = compact({
        streaming: clampInt(payload.scores?.streaming, 0, 10000),
        gaming: clampInt(payload.scores?.gaming, 0, 10000),
        rtc: clampInt(payload.scores?.rtc, 0, 10000),
    });
    if (Object.keys(scores).length) section.scores = scores;

    const qualities = compact({
        streaming: quality(payload.qualities?.streaming),
        gaming: quality(payload.qualities?.gaming),
        rtc: quality(payload.qualities?.rtc),
    });
    if (Object.keys(qualities).length) section.qualities = qualities;

    const connection = compact({
        ip: ipOrUndefined(payload.connection?.ip),
        colo: clip(payload.connection?.colo, 8),
        coloCountryCode: countryCode(payload.connection?.coloCountryCode),
        coloCity: clip(payload.connection?.coloCity, 64),
    });
    if (Object.keys(connection).length) section.connection = connection;

    return section;
};

// pingtest:finished — { target, probes: [{ country, stats }] }. Globalping
// stats can carry extra keys (mdev, …) — only the whitelisted ones survive.
const buildPingtest = (payload) => {
    const target = clip(payload?.target, 253);
    const probes = (payload?.probes ?? [])
        .slice(0, 32)
        .map((probe) => ({
            countryCode: countryCode(probe?.country),
            stats: compact({
                min: finiteNum(probe?.stats?.min, 0, 600000),
                max: finiteNum(probe?.stats?.max, 0, 600000),
                avg: finiteNum(probe?.stats?.avg, 0, 600000),
                loss: finiteNum(probe?.stats?.loss, 0, 100),
                total: clampInt(probe?.stats?.total, 0, 1000),
                rcv: clampInt(probe?.stats?.rcv, 0, 1000),
                drop: clampInt(probe?.stats?.drop, 0, 1000),
            }),
        }));
    return target && probes.length ? { target, probes } : null;
};

// mtrtest:finished — { target, probes: [{ country, city, network, asn, hops }] }
// hops come pre-structured from parseMtrOutput and already fit the schema.
const buildMtrtest = (payload) => {
    const target = clip(payload?.target, 253);
    const probes = (payload?.probes ?? [])
        .slice(0, 32)
        .map((probe) => compact({
            countryCode: countryCode(probe?.country),
            city: clip(probe?.city, 64),
            network: clip(probe?.network, 128),
            asn: clampInt(probe?.asn, 0, 4294967295),
            hops: (probe?.hops ?? []).slice(0, 64).map((hop) => compact({
                ...hop,
                host: clip(hop.host, 128),
                ip: ipOrUndefined(hop.ip),
            })),
        }))
        .filter((probe) => probe.hops.length);
    return target && probes.length ? { target, probes } : null;
};

// ruletest:finished — { uniqueIPCount, workers: [{ id, ip, country_code, org }] }
// uniqueIPCount is recomputed from valid IPs only — the event's own count
// (kept for achievement rules) also counts error placeholders as "IPs".
const buildRuletest = (payload) => {
    const workers = (payload?.workers ?? [])
        .filter((worker) => isValidIP(worker?.ip))
        .slice(0, 16)
        .map((worker) => compact({
            id: clampInt(worker.id, 1, 16) ?? 1,
            ip: worker.ip,
            countryCode: countryCode(worker.country_code),
            org: clip(worker.org, 128),
        }));
    if (!workers.length) return null;
    return {
        uniqueIPCount: new Set(workers.map((worker) => worker.ip)).size,
        workers,
    };
};

// browserinfo:finished — { userAgent, otherInfos } (ua-parser result + the
// component's otherInfos block). Fingerprint data is deliberately never
// forwarded by the component.
const nameVersion = (part) => {
    const picked = compact({ name: clip(part?.name, 64), version: clip(part?.version, 32) });
    return Object.keys(picked).length ? picked : undefined;
};
const buildBrowserinfo = (payload) => {
    const ua = payload?.userAgent;
    const other = payload?.otherInfos;
    if (!ua && !other) return null;
    const connection = other?.connection
        ? compact({
            effectiveType: clip(other.connection.effectiveType, 16),
            downlink: finiteNum(other.connection.downlink, 0, 100000),
            rtt: clampInt(other.connection.rtt, 0, 600000),
        })
        : undefined;
    const section = compact({
        browser: nameVersion(ua?.browser),
        os: nameVersion(ua?.os),
        engine: nameVersion(ua?.engine),
        timezone: clip(other?.timezone, 64),
        languages: Array.isArray(other?.languages)
            ? other.languages.slice(0, 16).map((l) => clip(l, 16) ?? '')
            : undefined,
        display: other?.display
            ? compact({
                width: clampInt(other.display.width, 0, 100000),
                height: clampInt(other.display.height, 0, 100000),
                pixelRatio: finiteNum(other.display.pixelRatio, 0, 100),
            })
            : undefined,
        connection,
    });
    return Object.keys(section).length ? section : null;
};

// invisibility:result — { proxyScore, vpnScore, ip, flags: [{ key, flagged }] }
const buildInvisibility = (payload) => {
    const proxy = finiteNum(payload?.proxyScore, 0, 100);
    const vpn = finiteNum(payload?.vpnScore, 0, 100);
    if (proxy === undefined || vpn === undefined) return null;
    return compact({
        ip: ipOrUndefined(payload.ip),
        scores: { proxy, vpn },
        flags: (payload?.flags ?? []).slice(0, 20).map((flag) => ({
            key: clip(flag?.key, 32) ?? '',
            flagged: flag?.flagged === true,
        })),
    });
};

// enhanceddnsleak:finished — { rawCount, resolverCount, queries } with the
// upstream's raw query rows; the DNSSEC posture is derived here (worst-of,
// same rule as the component's dnssecSummary).
const buildEnhanceddnsleak = (payload) => {
    const rows = Array.isArray(payload?.queries) ? payload.queries : [];
    const queries = rows
        .filter((row) => isValidIP(row?.ip))
        .slice(0, 128)
        .map((row) => compact({
            ip: row.ip,
            countryCode: countryCode(row.ipInfo?.country_code),
            asn: row.ipInfo?.asn != null ? clip(String(row.ipInfo.asn), 16) : undefined,
            org: clip(row.ipInfo?.org, 128),
            transport: clip(row.transport, 16),
            ecs: clip(row.ecs, 64),
            do: row.do === true,
            cd: row.cd === true,
        }));
    if (!queries.length) return null;
    const dnssec = queries.some((q) => q.cd) || queries.some((q) => !q.do) ? 'partial' : 'ok';
    return {
        rawCount: clampInt(payload.rawCount, 0, 100000) ?? 0,
        resolverCount: clampInt(payload.resolverCount, 0, 10000) ?? 0,
        dnssec,
        queries,
    };
};

// --- event → builder registry (consumed by use-report-collector) ------------

export const REPORT_EVENT_BUILDERS = {
    'ipinfo:finished': { section: 'ipinfo', build: buildIpinfo },
    'connectivity:finished': { section: 'connectivity', build: buildConnectivity },
    'webrtc:finished': { section: 'webrtc', build: buildWebrtc },
    'dnsleak:finished': { section: 'dnsleak', build: buildDnsleak },
    'speedtest:finished': { section: 'speedtest', build: buildSpeedtest },
    'pingtest:finished': { section: 'pingtest', build: buildPingtest },
    'mtrtest:finished': { section: 'mtrtest', build: buildMtrtest },
    'ruletest:finished': { section: 'ruletest', build: buildRuletest },
    'browserinfo:finished': { section: 'browserinfo', build: buildBrowserinfo },
    'invisibility:result': { section: 'invisibility', build: buildInvisibility },
    'enhanceddnsleak:finished': { section: 'enhanceddnsleak', build: buildEnhanceddnsleak },
};
