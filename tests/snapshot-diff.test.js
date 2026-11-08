// Tests for frontend/utils/features/snapshot-diff.js — keyed alignment
// (cards by source, targets / servers / providers by id), one-sided items
// kept apart from changes, semantic vs drift rows, the speed tier as a noise
// gate, one-sided sections as "not run", and rows that carry no verdict.
// keyedItems hands renderers the same keys.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    diffSnapshots, fieldKind, speedTier, SPEED_TIER_THRESHOLDS_MBPS, keyedItems,
} from '../frontend/utils/features/snapshot-diff.js';
import { createSnapshot } from '../frontend/utils/features/snapshots.js';
import { REPORT_VERSION, validateReport } from '../common/report-schema.js';

const T0 = '2026-11-08T10:00:00.000Z';

const card = (source, ip, fields = {}) => ({
    source, ip, countryCode: 'SG', region: 'Central', city: 'Singapore', asn: 'AS4773', isp: 'Singtel', ...fields,
});
const target = (id, status = 'ok', fields = {}) => ({ id, name: id, status, ...(status === 'ok' ? { timeMs: 40 } : {}), ...fields });
const server = (id, ip, fields = {}) => ({ id, url: `stun:${id}.example.com:3478`, ip, natType: 'srflx', countryCode: 'SG', org: 'Singtel', ...fields });
const provider = (id, ip, fields = {}) => ({ id, name: id, ip, countryCode: 'SG', org: 'Singtel', ...fields });

const sectionsOf = ({ cards, targets, servers, providers, speed } = {}) => {
    const sections = {};
    if (cards) sections.ipinfo = { testedAt: T0, cards };
    if (targets) sections.connectivity = { testedAt: T0, targets };
    if (servers) sections.webrtc = { testedAt: T0, servers };
    if (providers) sections.dnsleak = { testedAt: T0, providers };
    if (speed) sections.speedtest = { testedAt: T0, ...speed };
    return sections;
};

// A schema-checked snapshot fixture.
const snap = (parts) => {
    const sections = sectionsOf(parts);
    const { errors } = validateReport({ v: REPORT_VERSION, generatedAt: T0, origin: 'test', locale: 'en', sections });
    assert.deepEqual(errors, [], 'fixture must be a legal report');
    return { ...createSnapshot({ id: 'x', now: T0 }), sections };
};

const BASE = {
    cards: [card('ipcheck', '8.8.8.8', { anonymity: 'none', ipType: 'residential', nativeIP: true }), card('ipsb', '2001:4860::1')],
    targets: [target('google'), target('github'), target('youtube')],
    servers: [server('google', '8.8.8.8'), server('cloudflare', '8.8.8.8')],
    providers: [provider('p1', '9.9.9.9'), provider('p2', '9.9.9.10')],
    speed: { downloadMbps: 120, uploadMbps: 30, latencyMs: 12, jitterMs: 2, qualities: { streaming: 'great' } },
};

describe('snapshot diff — alignment', () => {
    it('identical snapshots: every section both, no changes', () => {
        const result = diffSnapshots(snap(BASE), snap(BASE));
        for (const section of Object.values(result.sections)) {
            assert.equal(section.status, 'both');
            assert.equal(section.rows.some((row) => row.changed), false);
            assert.equal(section.listChanged, false);
        }
        assert.deepEqual(Object.keys(result), ['sections']);
    });

    it('aligns IP cards by source, not position', () => {
        const right = snap({ ...BASE, cards: [...BASE.cards].reverse() });
        const result = diffSnapshots(snap(BASE), right);
        assert.equal(result.sections.ipinfo.rows.some((row) => row.changed), false);
    });

    it('aligns connectivity targets, STUN servers and DNS providers by id', () => {
        const right = snap({
            ...BASE,
            targets: [...BASE.targets].reverse(),
            servers: [...BASE.servers].reverse(),
            providers: [...BASE.providers].reverse(),
        });
        const result = diffSnapshots(snap(BASE), right);
        for (const id of ['connectivity', 'webrtc', 'dnsleak']) {
            assert.equal(result.sections[id].rows.some((row) => row.changed), false, id);
        }
    });

    it('one-sided items are listed apart, never as changes', () => {
        const right = snap({
            ...BASE,
            cards: [BASE.cards[0], card('maxmind', '8.8.8.8')],
            servers: [BASE.servers[0]],
            providers: [...BASE.providers, provider('p3', '9.9.9.11', { countryCode: 'US' })],
        });
        const { sections } = diffSnapshots(snap(BASE), right);
        assert.deepEqual(sections.ipinfo.onlyLeft, ['ipsb']);
        assert.deepEqual(sections.ipinfo.onlyRight, ['maxmind']);
        assert.equal(sections.ipinfo.rows.some((row) => row.key !== 'ipcheck'), false);
        assert.deepEqual(sections.webrtc.onlyLeft, ['cloudflare']);
        assert.deepEqual(sections.dnsleak.onlyRight, ['p3']);
        // A one-sided provider in another country is not a resolver change.
        assert.equal(sections.dnsleak.rows.some((row) => row.changed), false);
    });

    it('a repeated key keeps both items', () => {
        const left = snap({ ...BASE, providers: [provider('p1', '9.9.9.9'), provider('p1', '9.9.9.10')] });
        const right = snap({ ...BASE, providers: [provider('p1', '9.9.9.9'), provider('p1', '1.1.1.1')] });
        const { sections } = diffSnapshots(left, right);
        const changed = sections.dnsleak.rows.filter((row) => row.changed);
        assert.deepEqual(changed.map((row) => [row.key, row.field, row.from, row.to]), [['p1#2', 'ip', '9.9.9.10', '1.1.1.1']]);
    });
});

describe('snapshot diff — rows', () => {
    it('classifies semantic, drift and info fields', () => {
        for (const field of ['ip', 'countryCode', 'region', 'city', 'asn', 'isp', 'anonymity', 'ipType',
            'nativeIP', 'natType', 'org', 'status', 'tier', 'qualities.gaming']) {
            assert.equal(fieldKind(field), 'semantic', field);
        }
        for (const field of ['timeMs', 'minTimeMs', 'latencyMs', 'jitterMs', 'downloadMbps', 'uploadMbps',
            'loadedLatencyDownMs', 'loadedLatencyUpMs', 'scores.rtc']) {
            assert.equal(fieldKind(field), 'drift', field);
        }
        assert.equal(fieldKind('name'), 'info');
        assert.equal(fieldKind('url'), 'info');
    });

    it('highlights a semantic change, reports drift unhighlighted', () => {
        const right = snap({
            ...BASE,
            cards: [card('ipcheck', '8.8.8.8', { anonymity: 'none', ipType: 'residential', nativeIP: true, city: 'Jurong' }), BASE.cards[1]],
            targets: [target('google', 'ok', { timeMs: 90 }), BASE.targets[1], BASE.targets[2]],
            speed: { ...BASE.speed, downloadMbps: 150, latencyMs: 30 },
        });
        const { sections } = diffSnapshots(snap(BASE), right);
        const city = sections.ipinfo.rows.find((row) => row.field === 'city' && row.key === 'ipcheck');
        assert.deepEqual(city, { key: 'ipcheck', field: 'city', from: 'Singapore', to: 'Jurong', kind: 'semantic', changed: true, highlight: true });
        const time = sections.connectivity.rows.find((row) => row.key === 'google' && row.field === 'timeMs');
        assert.equal(time.changed, true);
        assert.equal(time.kind, 'drift');
        assert.equal(time.highlight, false);
        const download = sections.speedtest.rows.find((row) => row.field === 'downloadMbps');
        assert.equal(download.kind, 'drift');
        assert.equal(download.highlight, false);
        const tier = sections.speedtest.rows.find((row) => row.field === 'tier');
        assert.equal(tier.changed, false, '120 and 150 share a tier');
    });

    it('a field present on one side only is a changed row', () => {
        const right = snap({ ...BASE, cards: [card('ipcheck', '8.8.8.8', { anonymity: 'vpn', ipType: 'hosting' }), BASE.cards[1]] });
        const rows = diffSnapshots(snap(BASE), right).sections.ipinfo.rows;
        const native = rows.find((row) => row.field === 'nativeIP');
        assert.equal(native.from, true);
        assert.equal(native.to, undefined);
        assert.equal(native.highlight, true);
    });
});

describe('snapshot diff — speed tier', () => {
    it('buckets download speed by the documented thresholds', () => {
        assert.deepEqual([...SPEED_TIER_THRESHOLDS_MBPS], [10, 50, 200]);
        assert.equal(speedTier(0), 0);
        assert.equal(speedTier(9.99), 0);
        assert.equal(speedTier(10), 1);
        assert.equal(speedTier(49), 1);
        assert.equal(speedTier(50), 2);
        assert.equal(speedTier(199), 2);
        assert.equal(speedTier(200), 3);
        assert.equal(speedTier(null), null);
        assert.equal(speedTier(undefined), null);
    });

    it('a tier crossing highlights the tier row, carrying the measured values', () => {
        const slow = snap({ ...BASE, speed: { downloadMbps: 8 } });
        const rows = diffSnapshots(snap(BASE), slow).sections.speedtest.rows;
        assert.deepEqual(rows.find((row) => row.field === 'tier'),
            { key: null, field: 'tier', from: 2, to: 0, kind: 'semantic', changed: true, highlight: true });
        const download = rows.find((row) => row.field === 'downloadMbps');
        assert.deepEqual([download.from, download.to, download.highlight], [120, 8, false]);
    });

    it('no tier row change within a tier, or without a download figure on both sides', () => {
        const near = snap({ ...BASE, speed: { ...BASE.speed, downloadMbps: 190 } });
        assert.equal(diffSnapshots(snap(BASE), near).sections.speedtest.rows.find((row) => row.field === 'tier').changed, false);
        const noDown = snap({ ...BASE, speed: { latencyMs: 10 } });
        const tier = diffSnapshots(snap(BASE), noDown).sections.speedtest.rows.find((row) => row.field === 'tier');
        assert.deepEqual([tier.from, tier.to], [2, undefined]);
    });
});

describe('snapshot diff — sections', () => {
    it('webrtc: a common server\'s IP and NAT type changes are highlighted rows', () => {
        const right = snap({ ...BASE, servers: [server('google', '8.8.8.8'), server('cloudflare', '5.6.7.8', { natType: 'relay' })] });
        const { sections } = diffSnapshots(snap(BASE), right);
        const changed = sections.webrtc.rows.filter((row) => row.changed);
        assert.deepEqual(changed.map((row) => [row.key, row.field, row.from, row.to, row.highlight]), [
            ['cloudflare', 'ip', '8.8.8.8', '5.6.7.8', true],
            ['cloudflare', 'natType', 'srflx', 'relay', true],
        ]);
    });

    it('connectivity: a status change on a common target is a highlighted row', () => {
        const left = snap({ ...BASE, targets: [target('google'), target('github', 'timeout'), target('youtube')] });
        const right = snap({ ...BASE, targets: [target('google', 'unreachable'), target('github'), target('youtube')] });
        const { sections } = diffSnapshots(left, right);
        const status = sections.connectivity.rows.filter((row) => row.field === 'status' && row.changed);
        assert.deepEqual(status.map((row) => [row.key, row.highlight]), [['google', true], ['github', true]]);
    });

    it('connectivity: a different list is flagged; statuses compare only shared targets', () => {
        const left = snap({ ...BASE, targets: [target('google'), target('github'), target('old', 'ok')] });
        const right = snap({ ...BASE, targets: [target('google'), target('github'), target('new1', 'timeout'), target('new2', 'unreachable')] });
        const { sections } = diffSnapshots(left, right);
        assert.equal(sections.connectivity.listChanged, true);
        assert.deepEqual(sections.connectivity.onlyLeft, ['old']);
        assert.deepEqual(sections.connectivity.onlyRight, ['new1', 'new2']);
        assert.equal(sections.connectivity.rows.some((row) => row.changed), false);
    });

    it('a section on one side only is "not run", never a change', () => {
        const right = snap({ cards: BASE.cards, targets: BASE.targets });
        const { sections } = diffSnapshots(snap(BASE), right);
        for (const id of ['webrtc', 'dnsleak', 'speedtest']) {
            assert.equal(sections[id].status, 'leftOnly');
            assert.deepEqual(sections[id].rows, []);
        }
        const reverse = diffSnapshots(right, snap(BASE));
        assert.equal(reverse.sections.speedtest.status, 'rightOnly');
    });

    it('a section on neither side is "none"', () => {
        const only = snap({ cards: BASE.cards });
        assert.equal(diffSnapshots(only, only).sections.speedtest.status, 'none');
    });
});

describe('snapshot diff — no verdicts', () => {
    it('no row carries a tone', () => {
        const right = snap({
            cards: [card('ipcheck', '1.1.1.1', { countryCode: 'JP' })],
            targets: [target('google', 'timeout'), target('new')],
            servers: [server('google', '5.6.7.8', { natType: 'relay' })],
            providers: [provider('p1', '9.9.9.9', { countryCode: 'US' })],
            speed: { downloadMbps: 5 },
        });
        const rows = Object.values(diffSnapshots(snap(BASE), right).sections).flatMap((section) => section.rows);
        assert.ok(rows.filter((row) => row.changed).length >= 6);
        for (const row of rows) assert.equal('tone' in row, false, row.field);
    });
});

describe('snapshot diff — keyedItems', () => {
    it('keys items the way the diff does, repeats suffixed', () => {
        const section = { testedAt: T0, cards: [card('A', '1.1.1.1'), card('B', '2.2.2.2'), card('A', '3.3.3.3')] };
        const map = keyedItems('ipinfo', section);
        assert.deepEqual([...map.keys()], ['A', 'B', 'A#2']);
        assert.equal(map.get('A#2').ip, '3.3.3.3');
        assert.deepEqual([...keyedItems('connectivity', { targets: [target('g')] }).keys()], ['g']);
    });

    it('is empty for speedtest or a missing section', () => {
        assert.equal(keyedItems('speedtest', { downloadMbps: 10 }).size, 0);
        assert.equal(keyedItems('webrtc', undefined).size, 0);
    });
});
