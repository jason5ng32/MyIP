// Exercises the shared report schema module: the whitelist validator the
// backend runs on untrusted POST bodies, and the data-level IP tail-masking
// used by the share dialog. Also asserts the frontend bridge re-export stays
// in sync with common/ (same pattern as valid-ip.test.js).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    REPORT_VERSION,
    REPORT_TTL_DAYS,
    REPORT_SECTION_IDS,
    validateReport,
    maskIpTail,
    maskReportIps,
    isMaskedIP,
} from '../common/report-schema.js';
import { validateReport as validateViaBridge } from '../frontend/utils/report-schema.js';
import { parseMtrOutput } from '../frontend/utils/mtr-parse.js';

// A representative valid report touching every section — the fixture the
// rejection cases below mutate.
const makeValidReport = () => ({
    v: REPORT_VERSION,
    generatedAt: '2026-07-14T08:00:00.000Z',
    origin: 'ipcheck.ing',
    locale: 'zh',
    sections: {
        ipinfo: {
            testedAt: '2026-07-14T08:00:00.000Z',
            cards: [
                { source: 'IPCheck.ing IPv4', ip: '1.2.3.4', countryCode: 'US', region: 'California', city: 'Mountain View', timezone: 'America/Los_Angeles', asn: 'AS15169', isp: 'Google LLC', isProxy: 'no', ipType: 'residential', nativeIP: true, qualityScore: 85, proxyProtocol: 'SOCKS5', proxyProvider: 'ACME' },
                { source: 'Cloudflare IPv6', ip: '2001:db8::1', countryCode: '', city: '' },
            ],
        },
        connectivity: {
            testedAt: '2026-07-14T08:00:00.000Z',
            targets: [
                { id: 'google', name: 'Google', status: 'ok', timeMs: 123, minTimeMs: 98 },
                { id: 'custom-1', name: 'My server', status: 'timeout', custom: true },
            ],
        },
        webrtc: {
            testedAt: '2026-07-14T08:00:00.000Z',
            servers: [
                { id: 'google', url: 'stun:stun.l.google.com:19302', ip: '1.2.3.4', natType: 'srflx', countryCode: 'US', org: 'Google' },
                { id: 'twilio', url: 'stun:global.stun.twilio.com', natType: 'error' },
            ],
        },
        dnsleak: {
            testedAt: '2026-07-14T08:00:00.000Z',
            providers: [{ id: 'surfshark', name: 'Surfshark', ip: '8.8.4.4', countryCode: 'US', org: 'Google' }],
        },
        speedtest: {
            testedAt: '2026-07-14T08:00:00.000Z',
            downloadMbps: 500.2,
            uploadMbps: 42.1,
            latencyMs: 12,
            jitterMs: null,
            scores: { streaming: 90, gaming: 70, rtc: 80 },
            qualities: { streaming: 'great', gaming: 'good', rtc: 'good' },
            connection: { ip: '104.16.0.1', colo: 'HKG', coloCountryCode: 'HK', coloCity: 'Hong Kong' },
        },
        pingtest: {
            testedAt: '2026-07-14T08:00:00.000Z',
            target: '1.2.3.4',
            probes: [{ countryCode: 'US', stats: { min: 1.2, avg: 2.3, max: 4.5, loss: 0, total: 3, rcv: 3, drop: 0 } }],
        },
        mtrtest: {
            testedAt: '2026-07-14T08:00:00.000Z',
            target: 'example.com',
            probes: [{
                countryCode: 'DE',
                city: 'Falkenstein',
                network: 'Hetzner Online',
                asn: 24940,
                hops: [
                    { n: 1, asn: null, host: '_gateway', ip: '172.17.0.1', lossPct: 0, drop: 0, rcv: 1, avgMs: 0.1 },
                    { n: 2, asn: 24940, host: 'core1.example.net', lossPct: 0, avgMs: 1.5 },
                ],
            }],
        },
        ruletest: {
            testedAt: '2026-07-14T08:00:00.000Z',
            uniqueIPCount: 2,
            workers: [{ id: 1, ip: '1.2.3.4', countryCode: 'US', org: 'Cloudflare' }],
        },
        browserinfo: {
            testedAt: '2026-07-14T08:00:00.000Z',
            browser: { name: 'Chrome', version: '138' },
            os: { name: 'macOS', version: '15.5' },
            engine: { name: 'Blink', version: '138' },
            timezone: 'Asia/Hong_Kong',
            languages: ['zh-CN', 'en'],
            display: { width: 1512, height: 982, pixelRatio: 2 },
            connection: null,
        },
        invisibility: {
            testedAt: '2026-07-14T08:00:00.000Z',
            ip: '1.2.3.4',
            scores: { proxy: 12, vpn: 88 },
            flags: [{ key: 'timezone', flagged: true }, { key: 'webrtc', flagged: false }],
        },
        enhanceddnsleak: {
            testedAt: '2026-07-14T08:00:00.000Z',
            rawCount: 12,
            resolverCount: 3,
            dnssec: 'partial',
            queries: [{ ip: '8.8.8.8', countryCode: 'US', asn: 'AS15169', org: 'Google', transport: 'udp', ecs: '1.2.3.0/24', do: true, cd: false }],
        },
        persona: {
            testedAt: '2026-07-14T08:00:00.000Z',
            country: 'JP',
            grade: 'C',
            score: 72,
            counts: {
                total: 18, scored: 12, match: 9, mismatch: 2,
                unnatural: 0, leak: 1, unknown: 3, notApplicable: 3,
            },
            results: [
                { id: 'ip-country', axis: 'match', verdict: 'match' },
                { id: 'gps-location', axis: 'leak', verdict: 'leak' },
                { id: 'accept-language-header', axis: 'coherence', verdict: 'not-applicable' },
            ],
        },
    },
});

describe('validateReport', () => {
    it('accepts a full valid report (and the bridge re-export agrees)', () => {
        const report = makeValidReport();
        assert.deepEqual(validateReport(report), { ok: true, errors: [] });
        assert.deepEqual(validateViaBridge(report), { ok: true, errors: [] });
    });

    it('accepts a minimal single-section report', () => {
        const report = makeValidReport();
        report.sections = { speedtest: report.sections.speedtest };
        assert.equal(validateReport(report).ok, true);
    });

    it('accepts tail-masked IPs as values', () => {
        const report = makeValidReport();
        report.sections.ipinfo.cards[0].ip = '1.2.3.x';
        report.sections.ipinfo.cards[1].ip = '2001:db8:0:0:x';
        report.sections.pingtest.target = '1.2.3.x';
        assert.equal(validateReport(report).ok, true);
    });

    it('rejects non-object inputs', () => {
        for (const bad of [null, undefined, [], 'x', 42]) {
            assert.equal(validateReport(bad).ok, false);
        }
    });

    it('rejects a wrong schema version', () => {
        const report = makeValidReport();
        report.v = REPORT_VERSION + 1;
        const result = validateReport(report);
        assert.equal(result.ok, false);
        assert.match(result.errors[0], /report\.v/);
    });

    it('rejects unknown envelope keys, unknown sections and unknown fields', () => {
        const withEnvelopeKey = { ...makeValidReport(), smuggled: 'data' };
        assert.match(validateReport(withEnvelopeKey).errors[0], /smuggled: unknown key/);

        const withSection = makeValidReport();
        withSection.sections.pastebin = { testedAt: '2026-07-14T08:00:00.000Z' };
        assert.match(validateReport(withSection).errors[0], /pastebin: unknown section/);

        const withField = makeValidReport();
        withField.sections.speedtest.freeText = 'x'.repeat(10000);
        assert.match(validateReport(withField).errors[0], /freeText: unknown key/);
    });

    it('rejects missing required keys', () => {
        const report = makeValidReport();
        delete report.sections.ruletest.uniqueIPCount;
        const result = validateReport(report);
        assert.equal(result.ok, false);
        assert.match(result.errors[0], /uniqueIPCount: missing required key/);
    });

    it('rejects an empty sections object', () => {
        const report = makeValidReport();
        report.sections = {};
        assert.match(validateReport(report).errors[0], /at least one section/);
    });

    it('rejects bad enums, out-of-range numbers and non-integer ints', () => {
        const badEnum = makeValidReport();
        badEnum.sections.connectivity.targets[0].status = 'flaky';
        assert.equal(validateReport(badEnum).ok, false);

        const badProxyEnum = makeValidReport();
        badProxyEnum.sections.ipinfo.cards[0].isProxy = 'sign_in_required';
        assert.equal(validateReport(badProxyEnum).ok, false);

        const badRange = makeValidReport();
        badRange.sections.invisibility.scores.proxy = 101;
        assert.equal(validateReport(badRange).ok, false);

        const badInt = makeValidReport();
        badInt.sections.ruletest.uniqueIPCount = 2.5;
        assert.equal(validateReport(badInt).ok, false);

        const badNaN = makeValidReport();
        badNaN.sections.speedtest.downloadMbps = NaN;
        assert.equal(validateReport(badNaN).ok, false);
    });

    it('rejects over-long strings and over-long arrays', () => {
        const longString = makeValidReport();
        longString.sections.ipinfo.cards[0].isp = 'x'.repeat(129);
        assert.equal(validateReport(longString).ok, false);

        const longArray = makeValidReport();
        longArray.sections.dnsleak.providers = Array.from({ length: 9 }, (_, i) => ({
            id: `p${i}`, name: 'P', ip: '1.1.1.1',
        }));
        assert.equal(validateReport(longArray).ok, false);
    });

    it('rejects invalid IPs, invalid country codes and invalid dates', () => {
        const badIp = makeValidReport();
        badIp.sections.webrtc.servers[0].ip = 'not-an-ip';
        assert.equal(validateReport(badIp).ok, false);

        const badCc = makeValidReport();
        badCc.sections.dnsleak.providers[0].countryCode = 'USA';
        assert.equal(validateReport(badCc).ok, false);

        const badDate = makeValidReport();
        badDate.generatedAt = 'yesterday-ish';
        assert.equal(validateReport(badDate).ok, false);
    });

    it('accepts IANA zone names and rejects anything else in timezone', () => {
        for (const zone of ['UTC', 'Asia/Singapore', 'America/Argentina/Buenos_Aires', 'Etc/GMT+8']) {
            const ok = makeValidReport();
            ok.sections.ipinfo.cards[0].timezone = zone;
            assert.equal(validateReport(ok).ok, true, `${zone} should validate`);
        }

        // '' has no meaning here — the builder omits the field instead.
        for (const bad of ['', '+08:00', 'Asia/Singapore; DROP', 'Asia//Singapore', '/Singapore', 'x'.repeat(65)]) {
            const report = makeValidReport();
            report.sections.ipinfo.cards[0].timezone = bad;
            assert.equal(validateReport(report).ok, false, `${bad} should be rejected`);
        }
    });

    it('rejects unexpected nulls but allows speced nullables', () => {
        const badNull = makeValidReport();
        badNull.sections.ipinfo.cards[0].ip = null;
        assert.equal(validateReport(badNull).ok, false);

        const okNull = makeValidReport();
        okNull.sections.speedtest.downloadMbps = null;
        okNull.sections.browserinfo.connection = null;
        assert.equal(validateReport(okNull).ok, true);
    });

    it('caps the error list on garbage payloads', () => {
        const report = makeValidReport();
        report.sections.connectivity.targets = Array.from({ length: 24 }, (_, i) => ({
            id: `t${i}`, name: 'T', status: 'broken-enum',
        }));
        const result = validateReport(report);
        assert.equal(result.ok, false);
        assert.ok(result.errors.length <= 20);
    });
});

describe('constants', () => {
    it('exposes ttl choices and section ids', () => {
        assert.deepEqual(REPORT_TTL_DAYS, [1, 3, 7]);
        assert.ok(REPORT_SECTION_IDS.includes('ipinfo'));
        assert.ok(REPORT_SECTION_IDS.includes('enhanceddnsleak'));
        assert.equal(REPORT_SECTION_IDS.length, 12);
    });
});

describe('maskIpTail', () => {
    it('masks the last IPv4 octet', () => {
        assert.equal(maskIpTail('1.2.3.4'), '1.2.3.x');
        assert.equal(maskIpTail('255.255.255.255'), '255.255.255.x');
    });

    it('masks the IPv6 interface half, keeping the routing prefix', () => {
        assert.equal(maskIpTail('2001:db8:0:1:aaaa:bbbb:cccc:dddd'), '2001:db8:0:1:x');
        assert.equal(maskIpTail('2001:db8::1'), '2001:db8:0:0:x');
        assert.equal(maskIpTail('::1'), '0:0:0:0:x');
        assert.equal(maskIpTail('2001:0db8:0000:0001::'), '2001:db8:0:1:x');
    });

    it('passes non-IP values through unchanged', () => {
        for (const value of ['', 'example.com', '1.2.3.x', 'IPv4 detection failed', null]) {
            assert.equal(maskIpTail(value), value);
        }
    });

    it('produces values isMaskedIP accepts and the validator allows', () => {
        assert.equal(isMaskedIP(maskIpTail('9.9.9.9')), true);
        assert.equal(isMaskedIP(maskIpTail('2001:db8::1')), true);
        assert.equal(isMaskedIP('9.9.9.9'), false);
        assert.equal(isMaskedIP('999.9.9.x'), false);
    });
});

describe('parseMtrOutput → schema integration', () => {
    it('parsed hops pass the mtrtest whitelist as-is', () => {
        const rawOutput = `Host                       Loss% Drop Rcv  Avg StDev Javg
 1. AS??? _gateway (172.17.0.1)  0.0%  0  3  0.3  0.0  0.3
 2. AS15169 dns.google (8.8.8.8)  0.0%  0  3  5.6  0.2  5.8`;
        const report = makeValidReport();
        report.sections.mtrtest.probes[0].hops = parseMtrOutput(rawOutput);
        assert.deepEqual(validateReport(report), { ok: true, errors: [] });
    });
});

describe('maskReportIps', () => {
    it('masks every IP field across sections without mutating the input', () => {
        const report = makeValidReport();
        const masked = maskReportIps(report);

        assert.equal(masked.sections.ipinfo.cards[0].ip, '1.2.3.x');
        assert.equal(masked.sections.ipinfo.cards[1].ip, '2001:db8:0:0:x');
        assert.equal(masked.sections.webrtc.servers[0].ip, '1.2.3.x');
        assert.equal(masked.sections.dnsleak.providers[0].ip, '8.8.4.x');
        assert.equal(masked.sections.speedtest.connection.ip, '104.16.0.x');
        assert.equal(masked.sections.pingtest.target, '1.2.3.x');
        assert.equal(masked.sections.mtrtest.probes[0].hops[0].ip, '172.17.0.x');
        assert.equal(masked.sections.invisibility.ip, '1.2.3.x');
        assert.equal(masked.sections.enhanceddnsleak.queries[0].ip, '8.8.8.x');
        // Domains in ip-or-domain fields stay readable.
        assert.equal(masked.sections.mtrtest.target, 'example.com');
        // Non-IP fields untouched.
        assert.equal(masked.sections.ipinfo.cards[0].isp, 'Google LLC');

        // The source report keeps full data (collector must stay unmasked).
        assert.equal(report.sections.ipinfo.cards[0].ip, '1.2.3.4');

        // A masked report is still schema-valid.
        assert.equal(validateReport(masked).ok, true);
    });
});
