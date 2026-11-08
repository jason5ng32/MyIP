// Tests for frontend/utils/features/snapshot-trigger.js — the smart auto
// mode's rule: the first snapshot, a speed test, a homepage section the
// previous snapshot lacks (never one this load lacks), IP card / STUN / DNS
// provider changes aligned by id (DNS egress IPs ignored), WebRTC going
// dark or coming back, connectivity target sets, statuses and the median
// log-ratio latency shift; one-sided or unusable items,
// one-sided or empty fields, one STUN server failing and small drift never
// fire.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    snapshotTrigger, shouldRecordSnapshot, latencyShifted,
    CONNECTIVITY_LATENCY_RATIO, CONNECTIVITY_LATENCY_DELTA_MS,
} from '../frontend/utils/features/snapshot-trigger.js';
import { SCENARIO_FRICTION_IDS } from '../frontend/utils/codes/ip.js';
import { REPORT_EVENT_BUILDERS } from '../frontend/utils/report/report-builders.js';
import { REPORT_VERSION, validateReport } from '../common/report-schema.js';

const T0 = '2026-11-08T10:00:00.000Z';

const card = (id, ip, fields = {}) => ({
    id, source: `${id} provider`, ip, countryCode: 'SG', region: 'Central', city: 'Singapore', asn: 'AS4773', isp: 'Singtel', ...fields,
});
const target = (id, status = 'ok', fields = {}) => ({ id, name: id, status, ...(status === 'ok' ? { timeMs: 40, minTimeMs: 30 } : {}), ...fields });
const server = (id, ip, fields = {}) => ({ id, url: `stun:${id}.example.com:3478`, ...(ip ? { ip } : {}), natType: 'srflx', countryCode: 'SG', org: 'Singtel', ...fields });
const provider = (id, ip, fields = {}) => ({ id, name: id, ip, countryCode: 'SG', org: 'Singtel', ...fields });

// Schema-checked sections.
const sections = ({ cards, targets, servers, providers, speed } = {}) => {
    const out = {};
    if (cards) out.ipinfo = { testedAt: T0, cards };
    if (targets) out.connectivity = { testedAt: T0, targets };
    if (servers) out.webrtc = { testedAt: T0, servers };
    if (providers) out.dnsleak = { testedAt: T0, providers };
    if (speed) out.speedtest = { testedAt: T0, ...speed };
    const { errors } = validateReport({ v: REPORT_VERSION, generatedAt: T0, origin: 'test', locale: 'en', sections: out }, { local: true });
    assert.deepEqual(errors, [], 'fixture must be a legal report');
    return out;
};

const BASE = {
    cards: [card('ipcheck', '8.8.8.8', { anonymity: 'none', ipType: 'residential', nativeIP: true, qualityScore: 90 }),
        card('ipsb', '2001:4860::1')],
    targets: [target('google'), target('github'), target('youtube'), target('blocked', 'timeout')],
    servers: [server('google', '8.8.8.8'), server('cloudflare', '8.8.8.8')],
    providers: [provider('p1', '9.9.9.9'), provider('p2', '9.9.9.10')],
};

const with_ = (parts) => sections({ ...BASE, ...parts });
const fire = (current, previous = sections(BASE)) => snapshotTrigger(previous, current);

describe('snapshot trigger — always', () => {
    it('records the first snapshot', () => {
        assert.equal(snapshotTrigger(null, sections(BASE)), 'first');
        assert.equal(shouldRecordSnapshot(null, sections(BASE)), true);
    });

    it('records a load that ran a speed test, whatever else', () => {
        assert.equal(fire(with_({ speed: { downloadMbps: 100, uploadMbps: 20 } })), 'speedtest');
    });

    it('records nothing for an identical load', () => {
        assert.equal(fire(sections(BASE)), null);
        assert.equal(shouldRecordSnapshot(sections(BASE), sections(BASE)), false);
    });
});

describe('snapshot trigger — ipinfo', () => {
    const changed = (fields) => with_({ cards: [{ ...BASE.cards[0], ...fields }, BASE.cards[1]] });

    it('fires on any compared card field', () => {
        const full = with_({ cards: [{
            ...BASE.cards[0], timezone: 'Asia/Singapore', abuseLevel: 'low', anonymityProtocol: 'OpenVPN', anonymityProvider: 'Other',
        }, BASE.cards[1]] });
        const cases = {
            ip: '1.1.1.1', countryCode: 'US', region: 'West', city: 'Jurong', timezone: 'Asia/Tokyo', asn: 'AS13335',
            isp: 'Cloudflare', anonymity: 'vpn', ipType: 'hosting', nativeIP: false, qualityScore: 40,
            abuseLevel: 'high', anonymityProtocol: 'WireGuard', anonymityProvider: 'ACME',
        };
        for (const [field, value] of Object.entries(cases)) {
            const after = with_({ cards: [{ ...full.ipinfo.cards[0], [field]: value }, BASE.cards[1]] });
            assert.equal(snapshotTrigger(full, after), 'ipinfo', field);
        }
    });

    it('ignores a field on one side only (advanced fields absent on cooldown / fallback)', () => {
        const ADVANCED = ['anonymity', 'ipType', 'nativeIP', 'qualityScore'];
        const bare = { ...BASE.cards[0] };
        for (const field of ADVANCED) delete bare[field];
        assert.equal(fire(with_({ cards: [bare, BASE.cards[1]] })), null, 'absent now');
        assert.equal(snapshotTrigger(with_({ cards: [bare, BASE.cards[1]] }), sections(BASE)), null, 'absent before');
        const scenarios = with_({ cards: [{ ...BASE.cards[0], scenarios: { [SCENARIO_FRICTION_IDS[0]]: 'high' } }, BASE.cards[1]] });
        assert.equal(fire(scenarios), null, 'scenarios absent before');
        assert.equal(snapshotTrigger(scenarios, sections(BASE)), null, 'scenarios absent now');
        assert.equal(fire(with_({ providers: [{ ...BASE.providers[0], org: undefined }, BASE.providers[1]] })), null, 'dnsleak');
    });

    it('a changed city from a fallback provider still fires', () => {
        const bare = { ...BASE.cards[0], source: 'Fallback', city: 'Jurong' };
        for (const field of ['anonymity', 'ipType', 'nativeIP', 'qualityScore']) delete bare[field];
        assert.equal(fire(with_({ cards: [bare, BASE.cards[1]] })), 'ipinfo');
    });

    it('fires on each scenario friction level', () => {
        const low = Object.fromEntries(SCENARIO_FRICTION_IDS.map((id) => [id, 'low']));
        const before = with_({ cards: [{ ...BASE.cards[0], scenarios: low }, BASE.cards[1]] });
        for (const id of SCENARIO_FRICTION_IDS) {
            const after = with_({ cards: [{ ...BASE.cards[0], scenarios: { ...low, [id]: 'high' } }, BASE.cards[1]] });
            assert.equal(snapshotTrigger(before, after), 'ipinfo', id);
        }
    });

    it('aligns cards by id, not position or answering provider', () => {
        assert.equal(fire(with_({ cards: [...BASE.cards].reverse() })), null);
        assert.equal(fire(with_({ cards: [{ ...BASE.cards[0], source: 'Fallback' }, BASE.cards[1]] })), null);
    });

    it('ignores a card on one side only (a failed card is dropped by the builder)', () => {
        assert.equal(fire(with_({ cards: [BASE.cards[0]] })), null);
        assert.equal(fire(with_({ cards: [...BASE.cards, card('maxmind', '1.1.1.1', { countryCode: 'US' })] })), null);
    });

    it("takes an empty string as absent: a builder's missing country / region / city", () => {
        const { build } = REPORT_EVENT_BUILDERS['ipinfo:finished'];
        const built = (geo) => ({ testedAt: T0, ...build({ cards: [{ id: 'ipcheck', source: 'IPCheck.ing', ip: '8.8.8.8', asn: 'AS15169', isp: 'Google', ...geo }] }) });
        const full = { ipinfo: built({ country_code: 'SG', region: 'Central', city: 'Singapore' }) };
        const empty = { ipinfo: built({ country_code: '', region: '', city: '' }) };
        assert.deepEqual([empty.ipinfo.cards[0].countryCode, empty.ipinfo.cards[0].region, empty.ipinfo.cards[0].city], ['', '', '']);
        assert.equal(snapshotTrigger(full, empty), null, 'emptied');
        assert.equal(snapshotTrigger(empty, full), null, 'filled');
        const moved = { ipinfo: built({ country_code: 'US', region: 'West', city: 'Jurong' }) };
        assert.equal(snapshotTrigger(full, moved), 'ipinfo', 'a real change still fires');
    });

    it('keeps 0 and false as values', () => {
        assert.equal(fire(with_({ cards: [{ ...BASE.cards[0], nativeIP: false }, BASE.cards[1]] })), 'ipinfo', 'nativeIP true → false');
        const zero = with_({ cards: [{ ...BASE.cards[0], qualityScore: 0 }, BASE.cards[1]] });
        const fifty = with_({ cards: [{ ...BASE.cards[0], qualityScore: 50 }, BASE.cards[1]] });
        assert.equal(snapshotTrigger(zero, fifty), 'ipinfo', 'qualityScore 0 → 50');
        assert.equal(snapshotTrigger(fifty, zero), 'ipinfo', 'qualityScore 50 → 0');
    });

    it('takes a quality score that reads the same as unchanged', () => {
        const before = with_({ cards: [{ ...BASE.cards[0], qualityScore: 87.51 }, BASE.cards[1]] });
        const after = with_({ cards: [{ ...BASE.cards[0], qualityScore: 87.54 }, BASE.cards[1]] });
        assert.equal(snapshotTrigger(before, after), null);
    });
});

describe('snapshot trigger — webrtc', () => {
    it('fires on a changed ip or NAT type', () => {
        assert.equal(fire(with_({ servers: [server('google', '1.1.1.1'), BASE.servers[1]] })), 'webrtc');
        assert.equal(fire(with_({ servers: [server('google', '8.8.8.8', { natType: 'relay' }), BASE.servers[1]] })), 'webrtc');
    });

    // Every server failed: what a blocked WebRTC test builds to.
    const dark = (natType) => BASE.servers.map((item) => server(item.id, null, { natType, countryCode: '' }));

    it('a blocked test still builds a section, with no server IP', () => {
        const { build } = REPORT_EVENT_BUILDERS['webrtc:finished'];
        for (const natTypeCode of ['unavailable', 'error']) {
            const section = build({ servers: BASE.servers.map(({ id, url }) => ({ id, url, ip: 'WebRTC unavailable', natTypeCode, country_code: '', org: 'WebRTC unavailable' })) });
            assert.equal(section.servers.length, 2, natTypeCode);
            assert.ok(section.servers.every((item) => item.ip === undefined && item.natType === natTypeCode), natTypeCode);
            assert.equal(fire(with_({ servers: section.servers })), 'webrtc.reachability', natTypeCode);
        }
    });

    it('fires when every server loses its IP, or one comes back', () => {
        for (const natType of ['unavailable', 'error']) {
            assert.equal(fire(with_({ servers: dark(natType) })), 'webrtc.reachability', `some → none (${natType})`);
            assert.equal(snapshotTrigger(with_({ servers: dark(natType) }), sections(BASE)), 'webrtc.reachability', `none → some (${natType})`);
        }
        const one = with_({ servers: [server('google', null, { natType: 'error', countryCode: '' }), BASE.servers[1]] });
        assert.equal(snapshotTrigger(with_({ servers: dark('error') }), one), 'webrtc.reachability', 'none → one');
    });

    it('does not fire while the reachability stays the same', () => {
        assert.equal(snapshotTrigger(with_({ servers: dark('error') }), with_({ servers: dark('unavailable') })), null, 'dark both times');
        const one = with_({ servers: [server('google', null, { natType: 'error', countryCode: '' }), BASE.servers[1]] });
        assert.equal(fire(one), null, 'one server flaked');
        assert.equal(snapshotTrigger(one, sections(BASE)), null, 'it came back');
    });

    it('ignores other fields, one-sided servers and servers without an IP', () => {
        assert.equal(fire(with_({ servers: [server('google', '8.8.8.8', { org: 'Other', countryCode: 'US' }), BASE.servers[1]] })), null);
        assert.equal(fire(with_({ servers: [BASE.servers[0]] })), null);
        assert.equal(fire(with_({ servers: [server('google', null, { natType: 'error', countryCode: '' }), BASE.servers[1]] })), null);
    });
});

describe('snapshot trigger — dnsleak', () => {
    it('fires on a changed org or country', () => {
        assert.equal(fire(with_({ providers: [provider('p1', '9.9.9.9', { org: 'Quad9' }), BASE.providers[1]] })), 'dnsleak');
        assert.equal(fire(with_({ providers: [provider('p1', '9.9.9.9', { countryCode: 'US' }), BASE.providers[1]] })), 'dnsleak');
    });

    it('ignores a rotated resolver IP and one-sided providers', () => {
        assert.equal(fire(with_({ providers: [provider('p1', '9.9.9.99'), provider('p2', '9.9.9.100')] })), null);
        assert.equal(fire(with_({ providers: [BASE.providers[0], provider('p3', '1.1.1.1', { countryCode: 'US' })] })), null);
    });
});

describe('snapshot trigger — connectivity', () => {
    // Every ok target at these [minTimeMs] values, the timeout one as is.
    const latencies = (...values) => with_({
        targets: [...BASE.targets.slice(0, 3).map((item, i) => ({ ...item, timeMs: values[i] + 10, minTimeMs: values[i] })), BASE.targets[3]],
    });

    it('fires when the target set differs', () => {
        assert.equal(fire(with_({ targets: BASE.targets.slice(0, 3) })), 'connectivity.targets');
        assert.equal(fire(with_({ targets: [...BASE.targets, target('custom1', 'ok', { custom: true })] })), 'connectivity.targets');
        assert.equal(fire(with_({ targets: [target('a'), target('b'), target('c'), target('d')] })), 'connectivity.targets');
    });

    it('fires when a shared target changes status', () => {
        assert.equal(fire(with_({ targets: [target('google', 'unreachable'), ...BASE.targets.slice(1)] })), 'connectivity.status');
        assert.equal(fire(with_({ targets: [...BASE.targets.slice(0, 3), target('blocked')] })), 'connectivity.status');
    });

    it('ignores small latency drift', () => {
        assert.equal(fire(latencies(45, 20, 60)), null);
    });

    it('needs both a large ratio and a large absolute change', () => {
        const before = latencies(30, 30, 30);
        assert.equal(snapshotTrigger(before, latencies(90, 90, 90)), null, 'x3 but +60 ms');
        const slow = latencies(400, 400, 400);
        assert.equal(snapshotTrigger(slow, latencies(550, 550, 550)), null, '+150 ms but x1.4');
        assert.equal(snapshotTrigger(before, latencies(200, 220, 30)), 'connectivity.latency', 'medians x6.7, +170 ms');
        assert.equal(snapshotTrigger(slow, latencies(150, 150, 400)), 'connectivity.latency', 'faster: x0.375, -250 ms');
    });

    it('uses medians, so one outlier does not fire', () => {
        assert.equal(snapshotTrigger(latencies(30, 30, 30), latencies(30, 30, 3000)), null);
    });

    it('falls back to timeMs when either side lacks minTimeMs', () => {
        const before = with_({ targets: BASE.targets.slice(0, 3).map((item) => ({ ...item, timeMs: 40, minTimeMs: undefined })).concat(BASE.targets[3]) });
        // minTimeMs alone would fire (30 → 300); timeMs is flat.
        const after = with_({ targets: BASE.targets.slice(0, 3).map((item) => ({ ...item, timeMs: 40, minTimeMs: 300 })).concat(BASE.targets[3]) });
        assert.equal(snapshotTrigger(before, after), null);
        const slower = with_({ targets: BASE.targets.slice(0, 3).map((item) => ({ ...item, timeMs: 400 })).concat(BASE.targets[3]) });
        assert.equal(snapshotTrigger(before, slower), 'connectivity.latency');
    });

    it('skips targets without a positive old value; none eligible never fires', () => {
        const zero = with_({ targets: BASE.targets.slice(0, 3).map((item) => ({ ...item, timeMs: 0, minTimeMs: 0 })).concat(BASE.targets[3]) });
        assert.equal(snapshotTrigger(zero, latencies(900, 900, 900)), null);
        const failing = sections({ ...BASE, targets: [target('blocked', 'timeout')] });
        assert.equal(snapshotTrigger(failing, failing), null);
    });

    it('exports its thresholds', () => {
        assert.equal(CONNECTIVITY_LATENCY_RATIO, 2);
        assert.equal(CONNECTIVITY_LATENCY_DELTA_MS, 100);
        assert.equal(latencyShifted([]), false);
        assert.equal(latencyShifted([[50, 100], [50, 160]]), false, 'median delta 80');
        assert.equal(latencyShifted([[100, 200], [100, 200]]), true, 'x2 and +100 exactly');
        assert.equal(latencyShifted([[200, 100], [200, 100]]), true, 'x0.5 and -100 exactly');
    });

    it('takes the median of log ratios, so opposite moves cancel out', () => {
        assert.equal(latencyShifted([[100, 400], [400, 100]]), false, 'x4 and x0.25: median log ratio 0');
        assert.equal(latencyShifted([[100, 400], [100, 400]]), true);
        assert.equal(latencyShifted([[100, 250], [100, 150]]), false, 'geometric median x1.94');
    });

    it('gives the same verdict with old and new swapped', () => {
        const cases = [
            [[100, 400], [400, 100]], [[100, 250], [100, 150]], [[100, 300], [100, 300], [50, 60]],
            [[30, 30], [30, 30], [30, 3000]], [[50, 100], [50, 160]], [[100, 200], [100, 200]], [[400, 150], [400, 150], [400, 400]],
        ];
        for (const pairs of cases) {
            const swapped = pairs.map(([from, to]) => [to, from]);
            assert.equal(latencyShifted(swapped), latencyShifted(pairs), JSON.stringify(pairs));
        }
    });

    it('leaves out pairs with a zero on either side', () => {
        assert.equal(latencyShifted([[100, 0], [100, 0]]), false);
        assert.equal(latencyShifted([[0, 400], [0, 400]]), false);
        assert.equal(latencyShifted([[100, 0], [100, 300], [100, 300]]), true, 'the two positive pairs decide');
    });
});

describe('snapshot trigger — one-sided sections', () => {
    it('fires on a homepage section the previous snapshot lacks', () => {
        const previous = sections({ cards: BASE.cards });
        assert.equal(fire(sections({ cards: BASE.cards, servers: BASE.servers }), previous), 'section.added');
        assert.equal(fire(sections({ cards: BASE.cards, providers: BASE.providers }), previous), 'section.added');
        assert.equal(fire(sections({ cards: BASE.cards, targets: BASE.targets }), previous), 'section.added');
    });

    it('a WebRTC test run by hand fires against a snapshot without one (auto-run off)', () => {
        const { servers, ...rest } = BASE;
        assert.equal(fire(sections(BASE), sections(rest)), 'section.added');
    });

    it('a speed test keeps its own rule, newly present or not', () => {
        assert.equal(fire(with_({ speed: { downloadMbps: 100 } })), 'speedtest');
        assert.equal(fire(sections({ cards: BASE.cards, speed: { downloadMbps: 100 } }), sections({ cards: BASE.cards })), 'speedtest');
    });

    it('a section on both sides with equal content does not fire', () => {
        const only = sections({ cards: BASE.cards, servers: BASE.servers });
        assert.equal(fire(sections({ cards: BASE.cards, servers: BASE.servers }), only), null);
    });

    it('a section the previous snapshot holds and this load lacks does not fire', () => {
        assert.equal(fire(sections({ cards: BASE.cards })), null);
        assert.equal(fire(sections({ cards: BASE.cards, servers: [server('google', '1.1.1.1')] })), 'webrtc');
    });

    it('a section absent on both sides does not fire', () => {
        const { servers, providers, ...rest } = BASE;
        assert.equal(fire(sections(rest), sections(rest)), null);
    });

    it('a speed test only on the previous side does not fire', () => {
        const previous = with_({ speed: { downloadMbps: 100 } });
        assert.equal(snapshotTrigger(previous, sections(BASE)), null);
    });
});
