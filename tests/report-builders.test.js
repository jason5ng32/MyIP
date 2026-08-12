// Exercises the report builders (frontend/utils/report-builders.js): every
// builder's output — wrapped in a report envelope — must pass the shared
// schema validator, and the shape-based cleaning rules (invalid IPs dropped,
// geo-less org distrusted, stat whitelists) must hold.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REPORT_EVENT_BUILDERS } from '../frontend/utils/report-builders.js';
import { validateReport, REPORT_VERSION } from '../common/report-schema.js';

const wrap = (sectionId, section) => ({
    v: REPORT_VERSION,
    generatedAt: '2026-07-14T08:00:00.000Z',
    origin: 'ipcheck.ing',
    locale: 'zh',
    sections: { [sectionId]: { testedAt: '2026-07-14T08:00:00.000Z', ...section } },
});

// Realistic payloads mirroring what each component actually emits — including
// localized placeholder strings in ip slots, which the builders must drop.
const PAYLOADS = {
    'ipinfo:finished': {
        cards: [
            { source: 'IPCheck.ing IPv4', ip: '1.2.3.4', country_code: 'us', region: 'CA', city: 'SF', asn: 'AS15169', isp: 'Google LLC' },
            { source: 'IPCheck.ing IPv6', ip: 'IPv6 检测失败' },
            { source: 'Cloudflare IPv6', ip: '2001:db8::1', country_code: '' },
        ],
    },
    'connectivity:finished': {
        targets: [
            { id: 'google', name: 'Google', custom: false, statusCode: 'ok', time: 123, mintime: 98 },
            { id: 'wechat', name: 'WeChat', custom: false, statusCode: 'unreachable', time: 0, mintime: 0 },
            { id: 'custom-1', name: 'My server', custom: true, statusCode: undefined, time: 0, mintime: 0 },
        ],
    },
    'webrtc:finished': {
        servers: [
            { id: 'google', url: 'stun.l.google.com:19302', ip: '1.2.3.4', natTypeCode: 'srflx', country_code: 'US', org: 'Google' },
            { id: 'twilio', url: 'global.stun.twilio.com', ip: 'STUN 请求失败', natTypeCode: 'error', country_code: '', org: 'STUN 请求失败' },
            { id: 'cloudflare', url: 'stun.cloudflare.com', ip: '等待检测', natTypeCode: undefined, country_code: '', org: '等待检测' },
        ],
    },
    'dnsleak:finished': {
        providers: [
            { id: 'surfshark', name: 'Surfshark', ip: '8.8.4.4', country_code: 'US', org: 'Google' },
            { id: 'ipleak', name: 'IPLeak', ip: '检测失败', country_code: '', org: '检测失败' },
        ],
    },
    'speedtest:finished': {
        downloadSpeed: 500.2, uploadSpeed: 42.1, latency: 12, jitter: '-',
        downLoadedLatency: 45, upLoadedLatency: '-',
        scores: { streaming: 90, gaming: 70, rtc: 80 },
        qualities: { streaming: 'great', gaming: 'good', rtc: 'good' },
        connection: { ip: '104.16.0.1', colo: 'HKG', loc: 'HK', country: 'Hong Kong', coloCountry: 'Hong Kong', coloCountryCode: 'HK', coloCity: 'Hong Kong' },
    },
    'pingtest:finished': {
        target: '1.2.3.4',
        probes: [
            { country: 'US', stats: { min: 1.2, max: 4.5, avg: 2.3, total: 8, loss: 0, rcv: 8, drop: 0, mdev: 0.4 } },
        ],
    },
    'mtrtest:finished': {
        target: '8.8.8.8',
        probes: [
            {
                country: 'DE', city: 'Falkenstein', network: 'Hetzner Online', asn: 24940,
                hops: [
                    { n: 1, asn: null, host: '_gateway', ip: '172.17.0.1', lossPct: 0, drop: 0, rcv: 3, avgMs: 0.3 },
                    { n: 2, lossPct: 100 },
                ],
            },
            { country: 'US', city: 'Ashburn', network: 'AWS', asn: 14618, hops: [] },
        ],
    },
    'ruletest:finished': {
        uniqueIPCount: 3, // counts error labels too — builder recomputes
        workers: [
            { id: 1, ip: '1.2.3.4', country_code: 'US', org: 'Cloudflare' },
            { id: 2, ip: '1.2.3.4', country_code: 'US', org: 'Cloudflare' },
            { id: 3, ip: '检测失败', country_code: '', org: '检测失败' },
        ],
    },
    'browserinfo:finished': {
        userAgent: {
            ua: 'Mozilla/5.0 …',
            browser: { name: 'Chrome', version: '138.0.0.0', major: '138' },
            engine: { name: 'Blink', version: '138.0.0.0' },
            os: { name: 'macOS', version: '15.5' },
            device: { vendor: 'Apple', model: 'Macintosh' },
            cpu: { architecture: 'arm64' },
        },
        otherInfos: {
            cookieEnabled: true, cpucores: 10,
            languages: ['zh-CN', 'en'],
            timezone: 'Asia/Hong_Kong',
            display: { width: 1512, height: 982, colorDepth: 30, pixelRatio: 2 },
            connection: { effectiveType: '4g', downlink: 10, rtt: 50, saveData: false },
            touchPoints: 0, doNotTrack: null, pdfViewer: true,
        },
    },
    'invisibility:result': {
        proxyScore: 12, vpnScore: 88, ip: '1.2.3.4',
        flags: [{ key: 'timezone', flagged: true }, { key: 'blocklist.vpn', flagged: false }],
    },
    'enhanceddnsleak:finished': {
        rawCount: 12, resolverCount: 3,
        queries: [
            {
                ip: '8.8.8.8', queryType: 'A', transport: 'udp', ecs: '1.2.3.0/24', do: true, cd: false,
                ipInfo: { country_code: 'US', country_name: 'United States', region: 'CA', city: 'MV', asn: 15169, org: 'Google' },
                ecsInfo: { country_code: 'HK' },
            },
            {
                ip: '9.9.9.9', queryType: 'A', transport: 'tcp', ecs: '', do: false, cd: false,
                ipInfo: { country_code: 'N/A', asn: null, org: 'Quad9' },
            },
        ],
    },
};

describe('report builders produce schema-valid sections', () => {
    for (const [event, { section, build }] of Object.entries(REPORT_EVENT_BUILDERS)) {
        it(`${event} → sections.${section} passes validateReport`, () => {
            const built = build(PAYLOADS[event]);
            assert.notEqual(built, null, `builder for ${event} returned null on a realistic payload`);
            const result = validateReport(wrap(section, built));
            assert.deepEqual(result, { ok: true, errors: [] });
        });
    }

    it('every builder returns null on an empty payload', () => {
        for (const [event, { build }] of Object.entries(REPORT_EVENT_BUILDERS)) {
            assert.equal(build({}), null, `${event} should return null on {}`);
            assert.equal(build(undefined), null, `${event} should return null on undefined`);
        }
    });
});

describe('cleaning rules', () => {
    it('ipinfo drops cards whose ip slot holds a placeholder', () => {
        const { build } = REPORT_EVENT_BUILDERS['ipinfo:finished'];
        const section = build(PAYLOADS['ipinfo:finished']);
        assert.equal(section.cards.length, 2);
        assert.deepEqual(section.cards.map((c) => c.ip), ['1.2.3.4', '2001:db8::1']);
        assert.equal(section.cards[0].countryCode, 'US'); // normalized to upper
    });

    it('ipinfo carries the timezone through, absent when the source had no coordinates', () => {
        const { build } = REPORT_EVENT_BUILDERS['ipinfo:finished'];
        const section = build({
            cards: [
                { source: 'IP.sb', ip: '1.2.3.4', country_code: 'SG', timezone: 'Asia/Singapore' },
                // Anycast / unlocatable: the backend sends '' rather than guessing.
                { source: 'MaxMind', ip: '2001:db8::1', country_code: 'US', timezone: '' },
            ],
        });
        assert.equal(section.cards[0].timezone, 'Asia/Singapore');
        assert.ok(!('timezone' in section.cards[1]));
    });

    it('ipinfo keeps IPCheck.ing enrichments and drops gated/unknown values', () => {
        const { build } = REPORT_EVENT_BUILDERS['ipinfo:finished'];
        const section = build({
            cards: [{
                source: 'IPCheck.ing IPv4', ip: '1.2.3.4', country_code: 'US',
                proxyCode: 'no', ipTypeCode: 'residential', isNativeIP: true,
                qualityScore: '85', proxyProtocol: 'unknown', proxyProvider: '',
            }, {
                // Signed-out run: locale-free codes stay undefined and raw
                // 'sign_in_required' strings must never survive the builder.
                source: 'IPCheck.ing IPv6', ip: '2001:db8::1', country_code: 'US',
                proxyCode: undefined, ipTypeCode: undefined,
                isNativeIP: 'sign_in_required', qualityScore: 'sign_in_required',
            }, {
                // 'unknown' values carry no signal — dropped like absent.
                source: 'IPCheck.ing IPv6/4', ip: '9.9.9.9', country_code: 'US',
                proxyCode: 'unknown', ipTypeCode: 'unknown',
                proxyProvider: 'unknown', proxyProtocol: 'unknown',
            }],
        });
        const [enriched, gated, unknowns] = section.cards;
        assert.equal('isProxy' in unknowns, false);
        assert.equal('ipType' in unknowns, false);
        assert.equal('proxyProvider' in unknowns, false);
        assert.equal('proxyProtocol' in unknowns, false);
        assert.equal(enriched.isProxy, 'no');
        assert.equal(enriched.ipType, 'residential');
        assert.equal(enriched.nativeIP, true);
        assert.equal(enriched.qualityScore, 85);
        // 'unknown' protocol and empty provider stay out of the report.
        assert.equal('proxyProtocol' in enriched, false);
        assert.equal('proxyProvider' in enriched, false);
        for (const key of ['isProxy', 'ipType', 'nativeIP', 'qualityScore']) {
            assert.equal(key in gated, false, `${key} should be absent on the gated card`);
        }
    });

    it('connectivity keeps only settled targets and maps the enum', () => {
        const { build } = REPORT_EVENT_BUILDERS['connectivity:finished'];
        const section = build(PAYLOADS['connectivity:finished']);
        assert.equal(section.targets.length, 2);
        assert.equal(section.targets[0].status, 'ok');
        assert.equal(section.targets[1].status, 'unreachable');
        // custom:false is omitted, not serialized
        assert.equal('custom' in section.targets[0], false);
    });

    it('webrtc drops waiting servers, keeps errored ones without ip/org', () => {
        const { build } = REPORT_EVENT_BUILDERS['webrtc:finished'];
        const section = build(PAYLOADS['webrtc:finished']);
        assert.equal(section.servers.length, 2);
        const errored = section.servers[1];
        assert.equal(errored.natType, 'error');
        assert.equal('ip' in errored, false);   // placeholder text is not an IP
        assert.equal('org' in errored, false);  // no geo lookup → org distrusted
    });

    it('speedtest turns "-" placeholders into absent keys', () => {
        const { build } = REPORT_EVENT_BUILDERS['speedtest:finished'];
        const section = build(PAYLOADS['speedtest:finished']);
        assert.equal(section.jitterMs, undefined);
        assert.equal(section.loadedLatencyUpMs, undefined);
        assert.equal(section.downloadMbps, 500.2);
        assert.deepEqual(section.connection, { ip: '104.16.0.1', colo: 'HKG', coloCountryCode: 'HK', coloCity: 'Hong Kong' });
    });

    it('pingtest whitelists stats keys (mdev dropped)', () => {
        const { build } = REPORT_EVENT_BUILDERS['pingtest:finished'];
        const section = build(PAYLOADS['pingtest:finished']);
        assert.equal('mdev' in section.probes[0].stats, false);
        assert.equal(section.probes[0].stats.avg, 2.3);
    });

    it('mtrtest drops probes without hops', () => {
        const { build } = REPORT_EVENT_BUILDERS['mtrtest:finished'];
        const section = build(PAYLOADS['mtrtest:finished']);
        assert.equal(section.probes.length, 1);
        assert.equal(section.probes[0].asn, 24940);
    });

    it('ruletest recomputes uniqueIPCount from valid IPs only', () => {
        const { build } = REPORT_EVENT_BUILDERS['ruletest:finished'];
        const section = build(PAYLOADS['ruletest:finished']);
        assert.equal(section.workers.length, 2);
        assert.equal(section.uniqueIPCount, 1); // two workers, same egress IP
    });

    it('browserinfo picks name/version pairs and drops fingerprint-adjacent noise', () => {
        const { build } = REPORT_EVENT_BUILDERS['browserinfo:finished'];
        const section = build(PAYLOADS['browserinfo:finished']);
        assert.deepEqual(section.browser, { name: 'Chrome', version: '138.0.0.0' });
        assert.equal('device' in section, false);
        assert.deepEqual(section.connection, { effectiveType: '4g', downlink: 10, rtt: 50 });
    });

    it('enhanceddnsleak derives DNSSEC posture and normalizes geo', () => {
        const { build } = REPORT_EVENT_BUILDERS['enhanceddnsleak:finished'];
        const section = build(PAYLOADS['enhanceddnsleak:finished']);
        assert.equal(section.dnssec, 'partial'); // second row lacks DO
        assert.equal(section.queries[0].asn, '15169');
        assert.equal(section.queries[1].countryCode, ''); // 'N/A' → ''
        assert.equal('asn' in section.queries[1], false); // null asn → absent

        const allDo = build({
            rawCount: 1, resolverCount: 1,
            queries: [{ ip: '8.8.8.8', do: true, cd: false, ipInfo: {} }],
        });
        assert.equal(allDo.dnssec, 'ok');
    });

    it('invisibility requires both scores', () => {
        const { build } = REPORT_EVENT_BUILDERS['invisibility:result'];
        assert.equal(build({ proxyScore: 10 }), null);
        const section = build(PAYLOADS['invisibility:result']);
        assert.deepEqual(section.scores, { proxy: 12, vpn: 88 });
    });
});
