// Tests for frontend/utils/features/snapshot-diff-format.js — the Snapshots
// diff view's hunks (collapse rule, drift on / off, one-side items as plain
// context, IP cards by id, the single speedtest hunk with its dotted
// fields, numbers compared as displayed), split rows, block counts /
// notices, and value formatting with units.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    buildHunks, hunkCounts, blockNotice, splitRows, sectionFieldOrder, readField,
    formatFieldValue, fieldFlag, fieldLabelKey, EMPTY_VALUE, inlineDiffSegments,
} from '../frontend/utils/features/snapshot-diff-format.js';
import { diffSnapshots } from '../frontend/utils/features/snapshot-diff.js';

const T0 = '2026-11-08T10:00:00.000Z';
const snap = (sections) => ({ id: 'x', sections });
// An IP card keyed by its fixed `id`; `source` (the hunk header) defaults to it.
const card = (id, ip, fields = {}) => ({ id, source: id, ip, countryCode: 'SG', isp: 'Singtel', asn: 'AS4773', ...fields });
const hunksOf = (id, compared, viewed, opts) =>
    buildHunks(id, diffSnapshots(compared, viewed).sections[id], viewed.sections[id], compared.sections[id], opts);
const marks = (hunk) => hunk.lines.map((line) => `${line.mark}${line.field}`);

describe('snapshot diff format — hunks', () => {
    const compared = snap({
        ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1'), card('B', '5.5.5.5'), card('Gone', '3.3.3.3')] },
        connectivity: { testedAt: T0, targets: [{ id: 'g', name: 'Google', status: 'ok', timeMs: 40 }] },
    });
    const viewed = snap({
        ipinfo: { testedAt: T0, cards: [card('A', '2.2.2.2'), card('B', '5.5.5.5'), card('New', '4.4.4.4')] },
        connectivity: { testedAt: T0, targets: [{ id: 'g', name: 'Google', status: 'ok', timeMs: 90 }] },
    });

    it('opens changed hunks and closes unchanged ones', () => {
        const hunks = hunksOf('ipinfo', compared, viewed);
        const [a, b] = hunks;
        assert.equal(a.status, 'both');
        assert.equal(a.open, true);
        assert.equal(a.changedCount, 1);
        assert.deepEqual(marks(a), ['-ip', '+ip', ' countryCode', ' asn', ' isp']);
        assert.deepEqual(a.lines.slice(0, 2).map((l) => [l.value, l.otherValue]), [['1.1.1.1', '2.2.2.2'], ['2.2.2.2', '1.1.1.1']]);
        assert.equal(b.open, false);
        assert.equal(b.changedCount, 0);
    });

    it('keeps one-side items as closed plain hunks, viewed order then compared', () => {
        const hunks = hunksOf('ipinfo', compared, viewed);
        assert.deepEqual(hunks.map((h) => [h.name, h.status, h.open]), [
            ['A', 'both', true], ['B', 'both', false], ['New', 'onlyViewed', false], ['Gone', 'onlyCompared', false],
        ]);
        for (const hunk of hunks.slice(2)) {
            assert.ok(hunk.lines.every((line) => line.mark === ' '), 'no marks on a one-side item');
            assert.equal(hunk.changedCount, 0);
        }
        assert.equal(hunks[3].lines.find((l) => l.field === 'ip').value, '3.3.3.3');
        assert.deepEqual(hunkCounts(hunks), { changed: 1, onlyViewed: 1, onlyCompared: 1 });
    });

    it('keeps one hunk for a card a fallback provider answered, named as viewed', () => {
        const fallback = snap({ ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1', { source: 'Fallback' })] } });
        const hunks = hunksOf('ipinfo', snap({ ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1')] } }), fallback);
        assert.deepEqual(hunks.map((h) => [h.name, h.status, h.changedCount]), [['Fallback', 'both', 0]]);
    });

    it('folds drift into one ± line unless shown', () => {
        const [off] = hunksOf('connectivity', compared, viewed);
        assert.deepEqual(marks(off), [' status', '±timeMs']);
        assert.equal(off.lines[1].value, 90);
        assert.equal(off.lines[1].otherValue, 40);
        assert.equal(off.changedCount, 0);
        assert.equal(off.open, false, 'drift alone keeps the hunk closed');
        assert.equal(off.name, 'Google', 'the name is the header, not a line');

        const [on] = hunksOf('connectivity', compared, viewed, { showDrift: true });
        assert.deepEqual(marks(on), [' status', '-timeMs', '+timeMs']);
        assert.equal(on.open, true);
    });

    it('gives a changed name field its own lines', () => {
        const a = snap({ dnsleak: { testedAt: T0, providers: [{ id: 'p', name: 'Old', ip: '9.9.9.9' }] } });
        const b = snap({ dnsleak: { testedAt: T0, providers: [{ id: 'p', name: 'New', ip: '9.9.9.9' }] } });
        assert.deepEqual(marks(hunksOf('dnsleak', a, b)[0]), ['-name', '+name', ' ip']);
    });

    it('renders plain context when nothing is compared', () => {
        const hunks = buildHunks('ipinfo', null, viewed.sections.ipinfo, undefined);
        assert.equal(hunks.length, 3);
        assert.ok(hunks.every((h) => h.status === 'single' && h.open && h.changedCount === 0));
        assert.ok(hunks.every((h) => h.lines.every((l) => l.mark === ' ' && l.otherValue === undefined)));
        assert.deepEqual(buildHunks('ipinfo', null, undefined, undefined), []);
    });

    it('renders the viewed side plain when the compared one did not run', () => {
        const diff = diffSnapshots(snap({}), viewed).sections.ipinfo;
        const hunks = buildHunks('ipinfo', diff, viewed.sections.ipinfo, undefined);
        assert.ok(hunks.every((h) => h.status === 'single'));
        assert.equal(blockNotice(viewed.sections.ipinfo, undefined, true), 'notRunThere');
        assert.equal(blockNotice(viewed.sections.ipinfo, undefined, false), null);
        assert.equal(blockNotice(undefined, compared.sections.ipinfo, true), 'notRunHere');
        assert.equal(blockNotice(viewed.sections.ipinfo, compared.sections.ipinfo, true), null);
        assert.deepEqual(buildHunks('ipinfo', diffSnapshots(viewed, snap({})).sections.ipinfo, undefined, viewed.sections.ipinfo), []);
    });
});

describe('snapshot diff format — speedtest', () => {
    const speed = (fields) => snap({ speedtest: { testedAt: T0, ...fields } });

    it('is one hunk with dotted fields and no tier line', () => {
        const a = speed({ downloadMbps: 80, latencyMs: 12, qualities: { gaming: 'good' }, connection: { ip: '1.1.1.1', colo: 'SIN' } });
        const b = speed({ downloadMbps: 90, latencyMs: 12, qualities: { gaming: 'average' }, connection: { ip: '1.1.1.1', colo: 'SIN' } });
        const hunks = hunksOf('speedtest', a, b);
        assert.equal(hunks.length, 1);
        assert.equal(hunks[0].name, 'Cloudflare SIN');
        assert.deepEqual(marks(hunks[0]), [
            '±downloadMbps', ' latencyMs', '-qualities.gaming', '+qualities.gaming', ' connection.ip', ' connection.colo',
        ]);
        assert.ok(!sectionFieldOrder('speedtest').includes('tier'));
        assert.equal(readField({ connection: { ip: 'x' } }, 'connection.ip'), 'x');
        assert.equal(readField({ downloadMbps: null }, 'downloadMbps'), undefined);
    });

    it('takes numbers that display the same as unchanged, drift shown or not', () => {
        const a = speed({ downloadMbps: 95.03, uploadMbps: 20.01, latencyMs: 12.04 });
        const b = speed({ downloadMbps: 95.04, uploadMbps: 20.04, latencyMs: 12.01 });
        for (const showDrift of [false, true]) {
            const [hunk] = hunksOf('speedtest', a, b, { showDrift });
            assert.deepEqual(marks(hunk), [' downloadMbps', ' uploadMbps', ' latencyMs'], `showDrift ${showDrift}`);
            assert.equal(hunk.changedCount, 0);
        }
        const score = (qualityScore) => snap({ ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1', { qualityScore })] } });
        const [same] = hunksOf('ipinfo', score(87.51), score(87.54), { showDrift: true });
        assert.ok(same.lines.some((line) => line.field === 'qualityScore' && line.mark === ' '));
    });

    it('marks numbers that display differently', () => {
        const a = speed({ downloadMbps: 95.04 });
        const b = speed({ downloadMbps: 95.06 });
        assert.deepEqual(marks(hunksOf('speedtest', a, b)[0]), ['±downloadMbps']);
        assert.deepEqual(marks(hunksOf('speedtest', a, b, { showDrift: true })[0]), ['-downloadMbps', '+downloadMbps']);
    });

    it('gates the tier on the shown download: 9.97 and 10.02 both read 10', () => {
        const hunk = hunksOf('speedtest', speed({ downloadMbps: 9.97 }), speed({ downloadMbps: 10.02 }))[0];
        assert.deepEqual(marks(hunk), [' downloadMbps']);
    });

    it('marks the download when it crosses a speed tier, drift off', () => {
        const hunk = hunksOf('speedtest', speed({ downloadMbps: 5, uploadMbps: 2 }), speed({ downloadMbps: 300, uploadMbps: 3 }))[0];
        assert.deepEqual(marks(hunk), ['-downloadMbps', '+downloadMbps', '±uploadMbps']);
        assert.equal(hunk.open, true);
    });
});

describe('snapshot diff format — split rows', () => {
    it('aligns −/+ per field, context on both sides', () => {
        const compared = snap({ connectivity: { testedAt: T0, targets: [{ id: 'g', name: 'G', status: 'ok', timeMs: 40 }] } });
        const viewed = snap({ connectivity: { testedAt: T0, targets: [{ id: 'g', name: 'G', status: 'timeout', timeMs: 90 }] } });
        const rows = splitRows(hunksOf('connectivity', compared, viewed)[0]);
        assert.deepEqual(rows.map((r) => [r.field, r.left?.mark, r.left?.value, r.right?.mark, r.right?.value]), [
            ['status', '-', 'ok', '+', 'timeout'],
            ['timeMs', '±', 40, '±', 90],
        ]);
    });

    it('puts a one-side item on its own side', () => {
        const hunk = { status: 'onlyCompared', lines: [{ field: 'ip', mark: ' ', value: '1.1.1.1' }] };
        assert.deepEqual(splitRows(hunk), [{ field: 'ip', left: hunk.lines[0], right: null }]);
        const viewedOnly = { ...hunk, status: 'onlyViewed' };
        assert.deepEqual(splitRows(viewedOnly), [{ field: 'ip', left: null, right: hunk.lines[0] }]);
    });
});

describe('snapshot diff format — values', () => {
    const t = (key) => `t:${key}`;
    const opts = { t, countryName: (code) => `country:${code}`, locale: 'en' };

    it('adds units and localizes numbers', () => {
        assert.equal(formatFieldValue('timeMs', 1234.56, opts), '1,234.6 ms');
        assert.equal(formatFieldValue('downloadMbps', 95.04, opts), '95 Mb/s');
        assert.equal(formatFieldValue('qualityScore', 80, opts), '80/100');
        assert.equal(formatFieldValue('scores.gaming', 512, opts), '512');
    });

    it('labels enums, booleans and countries', () => {
        assert.equal(formatFieldValue('countryCode', 'SG', opts), 'country:SG');
        assert.equal(formatFieldValue('connection.coloCountryCode', 'NL', opts), 'country:NL');
        assert.equal(formatFieldValue('nativeIP', false, opts), 't:snapshots.No');
        assert.equal(formatFieldValue('custom', true, opts), 't:snapshots.Yes');
        assert.equal(formatFieldValue('anonymity', 'vpn', opts), 't:ipInfos.anonymity.vpn');
        assert.equal(formatFieldValue('ipType', 'hosting', opts), 't:ipInfos.advancedData.type.Hosting');
        assert.equal(formatFieldValue('status', 'timeout', opts), 't:connectivity.StatusTimeout');
        assert.equal(formatFieldValue('natType', 'srflx', opts), 't:webrtc.NATType.srflx');
        assert.equal(formatFieldValue('qualities.rtc', 'good', opts), 't:speedtest.quality.good');
        assert.equal(formatFieldValue('isp', 'Singtel', opts), 'Singtel');
    });

    it('dashes a missing value and flags country fields only', () => {
        for (const value of [undefined, null, '']) assert.equal(formatFieldValue('ip', value, opts), EMPTY_VALUE);
        assert.equal(fieldFlag('countryCode', 'SG'), 'sg');
        assert.equal(fieldFlag('isp', 'SG'), '');
        assert.equal(fieldFlag('countryCode', undefined), '');
        assert.equal(fieldLabelKey('connection.ip'), 'snapshots.fields.connection.ip');
    });

    it('labels abuse and scenario friction with the IP card\'s own wording', () => {
        assert.equal(fieldLabelKey('abuseLevel'), 'ipInfos.abuseLevel.label');
        assert.equal(fieldLabelKey('scenarios.signup'), 'ipInfos.scenarioFriction.scenarios.signup');
        assert.equal(fieldLabelKey('scenarios.crossBorderSocial'), 'ipInfos.scenarioFriction.scenarios.localSocial');
        assert.equal(formatFieldValue('abuseLevel', 'medium', opts), 't:ipInfos.abuseLevel.medium');
        assert.equal(formatFieldValue('scenarios.payments', 'medium', opts), 't:ipInfos.scenarioFriction.verdict.default.medium');
        assert.equal(formatFieldValue('scenarios.availability', 'high', opts), 't:ipInfos.scenarioFriction.verdict.availability.high');
    });

    it('lists the scenario lines last, in display order, after abuse level', () => {
        const order = sectionFieldOrder('ipinfo');
        assert.equal(order[order.indexOf('qualityScore') + 1], 'abuseLevel');
        assert.deepEqual(order.slice(-10), ['signup', 'payments', 'finance', 'streaming', 'availability',
            'browsing', 'posting', 'crossBorderSocial', 'automation', 'email'].map((id) => `scenarios.${id}`));
        const viewed = snap({ ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1', { scenarios: { email: 'high', signup: 'low' } })] } });
        const compared = snap({ ipinfo: { testedAt: T0, cards: [card('A', '1.1.1.1', { scenarios: { email: 'medium', signup: 'low' } })] } });
        const [hunk] = hunksOf('ipinfo', compared, viewed);
        assert.deepEqual(marks(hunk).slice(-3), [' scenarios.signup', '-scenarios.email', '+scenarios.email']);
    });
});

describe('snapshot diff format — inline segments', () => {
    it('keeps identical strings as one unchanged segment', () => {
        assert.deepEqual(inlineDiffSegments('1.2.3.4', '1.2.3.4'), [{ text: '1.2.3.4', changed: false }]);
    });

    it('marks only the differing octet of an IP', () => {
        assert.deepEqual(inlineDiffSegments('1.2.3.99', '1.2.3.4'),
            [{ text: '1.2.3.', changed: false }, { text: '99', changed: true }]);
        assert.deepEqual(inlineDiffSegments('1.2.3.4', '1.2.3.99'),
            [{ text: '1.2.3.', changed: false }, { text: '4', changed: true }]);
    });

    it('marks the number and keeps the unit of a speed', () => {
        assert.deepEqual(inlineDiffSegments('480.2 Mbps', '92.1 Mbps'),
            [{ text: '480.2', changed: true }, { text: ' Mbps', changed: false }]);
        assert.deepEqual(inlineDiffSegments('92.1 Mbps', '480.2 Mbps'),
            [{ text: '92.1', changed: true }, { text: ' Mbps', changed: false }]);
    });

    it('shows no inner highlight when nothing is shared', () => {
        assert.deepEqual(inlineDiffSegments('Singtel', 'Starhub'), [{ text: 'Singtel', changed: false }]);
    });

    it('shows no inner highlight when only separators are shared', () => {
        assert.deepEqual(inlineDiffSegments('Asia/Singapore', 'America/Chicago'),
            [{ text: 'Asia/Singapore', changed: false }]);
        assert.deepEqual(inlineDiffSegments('America/Chicago', 'Asia/Singapore'),
            [{ text: 'America/Chicago', changed: false }]);
        assert.deepEqual(inlineDiffSegments('Amazon.com, Inc.', 'Comcast Cable'),
            [{ text: 'Amazon.com, Inc.', changed: false }]);
    });

    it('marks only the differing word when one is shared', () => {
        assert.deepEqual(inlineDiffSegments('Asia/Singapore', 'Asia/Tokyo'),
            [{ text: 'Asia/', changed: false }, { text: 'Singapore', changed: true }]);
        assert.deepEqual(inlineDiffSegments('Asia/Tokyo', 'Asia/Singapore'),
            [{ text: 'Asia/', changed: false }, { text: 'Tokyo', changed: true }]);
    });

    it('returns no segments for an empty string', () => {
        assert.deepEqual(inlineDiffSegments('', 'abc'), []);
    });

    it('merges adjacent changed tokens', () => {
        assert.deepEqual(inlineDiffSegments('AS1 Foo Bar', 'AS1 Baz'),
            [{ text: 'AS1 ', changed: false }, { text: 'Foo Bar', changed: true }]);
    });
});
