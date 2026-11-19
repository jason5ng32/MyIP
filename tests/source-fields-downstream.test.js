// Pins what Persona Check, reports, snapshots and achievements see once geo sources other than the default one fill the card's extended fields.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { transformDataFromIPapi } from '../frontend/utils/ip/transform-ip-data.js';
import { normalizeIpinfo } from '../frontend/composables/use-persona-collector.js';
import { REPORT_EVENT_BUILDERS } from '../frontend/utils/report/report-builders.js';
import { buildShareReport, reportToMarkdown } from '../frontend/utils/report/report-export.js';
import { REPORT_VERSION, validateReport, stripLocalOnly } from '../common/report-schema.js';
import { sanitizeSnapshot, createSnapshot } from '../frontend/utils/features/snapshots.js';
import { diffSnapshots } from '../frontend/utils/features/snapshot-diff.js';
import { snapshotTrigger, notableChanges } from '../frontend/utils/features/snapshot-trigger.js';
import { ACHIEVEMENT_RULES } from '../frontend/data/achievement-rules.js';

const T0 = '2026-11-19T10:00:00.000Z';
const IP = '203.0.113.7';
const t = (key) => `<${key}>`;

// Fields only the card holds: none may reach a report, snapshot or export
// (the answering source reaches Snapshots alone, as `geoSource`).
const CARD_ONLY_FIELDS = ['flags', 'sourceMetrics', 'geoSourceId'];
const METRIC_VALUE = '0.0021 (Low)';

// A geo answer with an extended block, as an adapter sends it.
const answer = (extended) => ({
    ip: IP, country: 'SG', region: 'Central', city: 'Singapore',
    latitude: 1.29, longitude: 103.85, asn: 'AS64500', org: 'Example Net',
    ...(extended ? { extended } : {}),
});

const FULL_EXTENDED = {
    lineType: 'hosting',
    flags: { isDatacenter: true, isVPN: true, isAnyAnonymizer: true },
    anonymity: { code: 'vpn', provider: 'ExampleVPN' },
    metrics: [{ id: 'abuserScore', value: METRIC_VALUE }, { id: 'fraudScore', value: 100, max: 100 }],
};

// A homepage card: its fixed slot, the probe as `source`, the answering source as `geoSourceId`.
const cardOf = (extended, geoSourceId, slot = 'ipchecking_v4') => ({
    id: slot, source: 'IPCheck.ing IPv4', ip: IP,
    ...transformDataFromIPapi(answer(extended), t, 'en'), geoSourceId,
});

const buildIpinfo = (cards) => REPORT_EVENT_BUILDERS['ipinfo:finished'].build({ cards });

const sectionsOf = (cards) => ({ ipinfo: { testedAt: T0, ...buildIpinfo(cards) } });

const envelope = (sections) => ({ v: REPORT_VERSION, generatedAt: T0, origin: 'test', locale: 'en', sections });

describe('source fields downstream — Persona Check', () => {
    it('observes the line type the answering source gave for the same IP', () => {
        const fromDefault = cardOf({ lineType: 'residential' }, 0);
        const fromOther = cardOf(FULL_EXTENDED, 2);
        const [a] = normalizeIpinfo({ cards: [fromDefault] }).cards;
        const [b] = normalizeIpinfo({ cards: [fromOther] }).cards;
        assert.equal(a.ip, b.ip);
        assert.equal(a.ipType, 'residential');
        assert.equal(b.ipType, 'hosting');
    });

    it('leaves the line type out for a source without one', () => {
        const flagsOnly = cardOf({ flags: { isMobile: true } }, 3);
        const noBlock = cardOf(undefined, 5);
        for (const card of [flagsOnly, noBlock]) {
            const [observed] = normalizeIpinfo({ cards: [card] }).cards;
            assert.equal(observed.ipType, undefined);
            assert.ok(!('ipType' in JSON.parse(JSON.stringify(observed))));
        }
    });

    it('carries none of the card-only fields nor the source', () => {
        const [observed] = normalizeIpinfo({ cards: [cardOf(FULL_EXTENDED, 2)] }).cards;
        assert.deepEqual(Object.keys(observed).sort(),
            ['asn', 'countryCode', 'ip', 'ipType', 'isp', 'source', 'timezone', 'version']);
        assert.equal(observed.source, 'IPCheck.ing IPv4', 'the probe, not the answering source');
    });
});

describe('source fields downstream — reports, snapshots, exports', () => {
    const card = cardOf(FULL_EXTENDED, 2);

    it('the card carries every new field before the builder', () => {
        for (const key of CARD_ONLY_FIELDS) assert.ok(card[key] !== undefined, key);
        assert.equal(card.anonymityProvider, 'ExampleVPN');
    });

    it('the ipinfo builder drops flags and metrics, and keeps the answering source as `geoSource`', () => {
        const [built] = buildIpinfo([card]).cards;
        for (const key of CARD_ONLY_FIELDS) assert.ok(!(key in built), key);
        assert.equal(built.geoSource, 2);
        assert.equal(built.ipType, 'hosting', 'line type keeps the existing field');
        assert.equal(built.anonymityProvider, 'ExampleVPN', 'the existing provider field carries it');
        assert.equal(built.anonymity, 'vpn', 'the verdict keeps the existing field');
        assert.deepEqual(validateReport(envelope(sectionsOf([card])), { local: true }).errors, []);
    });

    it('`geoSource` lives in Snapshots only', () => {
        const snapshot = { ...createSnapshot({ id: 'snap-1', now: T0 }), sections: sectionsOf([card]) };
        assert.equal(sanitizeSnapshot(snapshot).sections.ipinfo.cards[0].geoSource, 2, 'stored');
        assert.deepEqual(validateReport(envelope(sectionsOf([card]))).errors,
            ['report.sections.ipinfo.cards[0].geoSource: unknown key'], 'the share validator rejects it');
        const report = buildShareReport({
            sections: sectionsOf([card]), selectedIds: ['ipinfo'], maskTail: false, locale: 'en', origin: 'test',
        });
        assert.ok(!('geoSource' in report.sections.ipinfo.cards[0]), 'the shared report strips it');
        assert.deepEqual(validateReport(report).errors, []);
    });

    it('the share validator and the snapshot store reject any of them', () => {
        const extras = { flags: { isVPN: true }, sourceMetrics: FULL_EXTENDED.metrics, geoSourceId: 2, details: [] };
        const snapshotOf = (sections) => ({ ...createSnapshot({ id: 'snap-1', now: T0 }), sections });
        assert.notEqual(sanitizeSnapshot(snapshotOf(sectionsOf([card]))), null, 'baseline is storable');
        for (const [key, value] of Object.entries(extras)) {
            const sections = sectionsOf([card]);
            sections.ipinfo.cards[0][key] = value;
            assert.equal(validateReport(stripLocalOnly(envelope(sections))).ok, false, `${key}: share`);
            assert.equal(validateReport(envelope(sections), { local: true }).ok, false, `${key}: local`);
            assert.equal(sanitizeSnapshot(snapshotOf(sections)), null, `${key}: snapshot`);
        }
    });

    it('the shared report and its Markdown export hold none of them', () => {
        const report = buildShareReport({
            sections: sectionsOf([card]), selectedIds: ['ipinfo'], maskTail: false, locale: 'en', origin: 'test',
        });
        const json = JSON.stringify(report);
        const markdown = reportToMarkdown(report, (key) => key);
        for (const text of [json, markdown]) {
            for (const needle of [...CARD_ONLY_FIELDS, 'geoSource', 'isDatacenter', 'abuserScore', 'fraudScore', METRIC_VALUE]) {
                assert.ok(!text.includes(needle), needle);
            }
        }
        assert.ok(markdown.includes('hosting'));
    });
});

describe('source fields downstream — snapshot diff after a source switch', () => {
    const before = sectionsOf([cardOf({ lineType: 'residential' }, 0)]);
    const after = sectionsOf([cardOf({ ...FULL_EXTENDED, lineType: 'hosting' }, 2)]);
    // A section as an older snapshot stored it: no answering source.
    const older = (sections) => ({
        ipinfo: { ...sections.ipinfo, cards: sections.ipinfo.cards.map(({ geoSource, ...rest }) => rest) },
    });

    it('opens with an unhighlighted data source row, then the line type as a highlighted one', () => {
        const left = { ...createSnapshot({ id: 'a', now: T0 }), sections: before };
        const right = { ...createSnapshot({ id: 'b', now: T0 }), sections: after };
        const { rows } = diffSnapshots(left, right).sections.ipinfo;
        const changed = rows.filter((row) => row.changed);
        assert.deepEqual(changed.map((row) => [row.field, row.from, row.to, row.highlight]), [
            ['geoSource', 0, 2, false],
            ['anonymity', undefined, 'vpn', true],
            ['ipType', 'residential', 'hosting', true],
            ['anonymityProvider', undefined, 'ExampleVPN', false],
        ]);
    });

    it('a line type change from another source fires the smart trigger, not the change notice', () => {
        assert.equal(snapshotTrigger(before, after), 'ipinfo');
        assert.deepEqual(notableChanges(before, after), []);
    });

    it('a provider name spelled differently by another source counts as nothing', () => {
        const a = sectionsOf([cardOf({ anonymity: { code: 'vpn', provider: 'ExampleVPN' } }, 0)]);
        const b = sectionsOf([cardOf({ anonymity: { code: 'vpn', provider: 'Example VPN' } }, 2)]);
        assert.deepEqual(notableChanges(a, b), []);
    });

    it('a different IP still counts across a source switch', () => {
        const moved = sectionsOf([{ ...cardOf({ ...FULL_EXTENDED, lineType: 'hosting' }, 2), ip: '203.0.113.8' }]);
        assert.deepEqual(notableChanges(before, moved), ['ipinfo']);
    });

    it('with the same source, or a side stored without one, the change notice compares every field', () => {
        const same = sectionsOf([cardOf({ lineType: 'residential' }, 2)]);
        assert.deepEqual(notableChanges(same, after), ['ipinfo'], 'same source');
        assert.deepEqual(notableChanges(older(before), after), ['ipinfo'], 'older snapshot');
        const a = sectionsOf([cardOf({ anonymity: { code: 'vpn', provider: 'ExampleVPN' } }, 2)]);
        const b = sectionsOf([cardOf({ anonymity: { code: 'vpn', provider: 'Example VPN' } }, 2)]);
        assert.deepEqual(notableChanges(a, b), ['ipinfo'], 'a provider name, same source');
    });

    it('a line type on one side only counts as nothing', () => {
        const without = sectionsOf([cardOf({ flags: { isMobile: true } }, 3)]);
        assert.equal(snapshotTrigger(before, without), null);
        assert.deepEqual(notableChanges(before, without), []);
        assert.deepEqual(notableChanges(without, after), []);
    });
});

describe('source fields downstream — achievements', () => {
    it('no ipinfo rule fires on flags, metrics or a line type', () => {
        const rules = ACHIEVEMENT_RULES.filter((rule) => rule.event === 'ipinfo:finished');
        assert.ok(rules.length > 0);
        const card = { ...cardOf(FULL_EXTENDED, 2), country_code: 'SG' };
        for (const rule of rules) assert.equal(Boolean(rule.when?.({ cards: [card] })), false, rule.slug);
    });
});
