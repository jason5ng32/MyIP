// Exercises the report export layer: envelope assembly (section selection,
// ordering, deep-copy isolation, masking), the AI-facing Markdown generator
// and the download filename. i18n is stubbed — the generator only needs a
// t() shape, prose content is irrelevant here.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SECTION_TITLE_KEYS,
    buildShareReport,
    reportToMarkdown,
    reportFileName,
} from '../frontend/utils/report-export.js';
import { REPORT_SECTION_IDS, REPORT_VERSION, validateReport } from '../common/report-schema.js';

// t() stub: returns the key, with params appended so interpolation is visible.
const t = (key, params) => (params ? `${key}[${Object.values(params).join(',')}]` : key);

const makeSections = () => ({
    ipinfo: {
        testedAt: '2026-07-14T08:00:00.000Z',
        cards: [{ source: 'IPCheck.ing IPv4', ip: '1.2.3.4', countryCode: 'US', city: 'LA', timezone: 'America/Los_Angeles', asn: 'AS15169', isp: 'Google' }],
    },
    speedtest: {
        testedAt: '2026-07-14T08:05:00.000Z',
        downloadMbps: 500.2,
        uploadMbps: 42.1,
        latencyMs: 12,
        scores: { streaming: 90, gaming: 70, rtc: 80 },
        qualities: { streaming: 'great', gaming: 'good', rtc: 'good' },
        connection: { ip: '104.16.0.1', colo: 'HKG', coloCountryCode: 'HK' },
    },
    mtrtest: {
        testedAt: '2026-07-14T08:10:00.000Z',
        target: '1.2.3.4',
        probes: [{
            countryCode: 'DE',
            network: 'Hetzner',
            asn: 24940,
            hops: [
                { n: 1, host: '_gateway', ip: '172.17.0.1', lossPct: 0, avgMs: 0.3 },
                { n: 2, lossPct: 100 },
            ],
        }],
    },
});

describe('buildShareReport', () => {
    it('assembles a schema-valid envelope from selected sections', () => {
        const report = buildShareReport({
            sections: makeSections(),
            selectedIds: ['speedtest', 'ipinfo', 'mtrtest'],
            maskTail: false,
            locale: 'zh',
            origin: 'ipcheck.ing',
        });
        assert.equal(report.v, REPORT_VERSION);
        assert.equal(report.origin, 'ipcheck.ing');
        assert.equal(report.locale, 'zh');
        assert.ok(!Number.isNaN(Date.parse(report.generatedAt)));
        // Homepage order, not selection order.
        assert.deepEqual(Object.keys(report.sections), ['ipinfo', 'speedtest', 'mtrtest']);
        assert.deepEqual(validateReport(report), { ok: true, errors: [] });
    });

    it('includes only selected sections and skips ids without data', () => {
        const report = buildShareReport({
            sections: makeSections(),
            selectedIds: ['speedtest', 'webrtc'], // webrtc has no snapshot
            maskTail: false,
            locale: 'en',
            origin: 'localhost',
        });
        assert.deepEqual(Object.keys(report.sections), ['speedtest']);
    });

    it('applies tail masking across sections when asked', () => {
        const report = buildShareReport({
            sections: makeSections(),
            selectedIds: ['ipinfo', 'speedtest', 'mtrtest'],
            maskTail: true,
            locale: 'en',
            origin: 'localhost',
        });
        assert.equal(report.sections.ipinfo.cards[0].ip, '1.2.3.x');
        assert.equal(report.sections.speedtest.connection.ip, '104.16.0.x');
        assert.equal(report.sections.mtrtest.target, '1.2.3.x');
        assert.equal(report.sections.mtrtest.probes[0].hops[0].ip, '172.17.0.x');
        assert.equal(validateReport(report).ok, true);
    });

    it('deep-copies snapshots so later mutations cannot alter an exported report', () => {
        const sections = makeSections();
        const report = buildShareReport({
            sections, selectedIds: ['ipinfo'], maskTail: false, locale: 'en', origin: 'localhost',
        });
        sections.ipinfo.cards[0].ip = '9.9.9.9';
        assert.equal(report.sections.ipinfo.cards[0].ip, '1.2.3.4');
    });
});

describe('SECTION_TITLE_KEYS', () => {
    it('covers every schema section id', () => {
        assert.deepEqual(Object.keys(SECTION_TITLE_KEYS).sort(), [...REPORT_SECTION_IDS].sort());
    });
});

describe('reportToMarkdown', () => {
    const makeReport = (maskTail = false) => buildShareReport({
        sections: makeSections(),
        selectedIds: ['ipinfo', 'speedtest', 'mtrtest'],
        maskTail,
        locale: 'en',
        origin: 'ipcheck.ing',
    });

    it('renders heading, intro, per-section blocks and the closing instruction', () => {
        const md = reportToMarkdown(makeReport(), t);
        assert.ok(md.startsWith('# report.ai.Heading'));
        assert.ok(md.includes('report.ai.Intro[ipcheck.ing'));
        for (const id of ['ipinfo', 'speedtest', 'mtrtest']) {
            assert.ok(md.includes(`## ${SECTION_TITLE_KEYS[id]}`), `missing title for ${id}`);
            assert.ok(md.includes(`report.ai.Sections.${id}`), `missing explanation for ${id}`);
        }
        assert.ok(md.trimEnd().endsWith('report.ai.Instruction'));
        // Data made it into the tables.
        assert.ok(md.includes('| IPCheck.ing IPv4 | 1.2.3.4 |'));
        // Every schema field the ipinfo card carries reaches the AI table —
        // its columns are hand-listed, so a new field is silently dropped
        // unless it is added there too.
        assert.ok(md.includes('| source | ip | countryCode | region | city | timezone | asn | isp |'));
        assert.ok(md.includes('America/Los_Angeles'));
        assert.ok(md.includes('- downloadMbps: 500.2'));
        assert.ok(md.includes('### probe: DE — Hetzner (AS24940)'));
    });

    it('omits sections absent from the report and skips the masked note by default', () => {
        const md = reportToMarkdown(makeReport(), t);
        assert.ok(!md.includes(SECTION_TITLE_KEYS.webrtc));
        assert.ok(!md.includes('report.ai.Masked'));
    });

    it('adds the masked note when masked, and hop tables only carry present stats', () => {
        const md = reportToMarkdown(makeReport(true), t, { masked: true });
        assert.ok(md.includes('report.ai.Masked'));
        assert.ok(md.includes('1.2.3.x'));
        // The mtr fixture has lossPct/avgMs only — absent stats stay out of the header.
        assert.ok(md.includes('| n | host | ip | asn | lossPct | avgMs |'));
        assert.ok(!md.includes('worstMs'));
        // The no-reply hop renders em-dash placeholders, keeping row width.
        assert.ok(md.includes('| 2 | — | — | — | 100 | — |'));
    });

    it('escapes pipe characters inside values', () => {
        const report = makeReport();
        report.sections.ipinfo.cards[0].isp = 'Evil|Corp';
        const md = reportToMarkdown(report, t);
        assert.ok(md.includes('Evil\\|Corp'));
    });

    it('escapes backslashes so they cannot neutralize pipe escaping', () => {
        const report = makeReport();
        report.sections.ipinfo.cards[0].isp = 'Evil\\|Corp';
        const md = reportToMarkdown(report, t);
        assert.ok(md.includes('Evil\\\\\\|Corp'));
    });
});

describe('reportFileName', () => {
    it('derives a dated json filename from generatedAt', () => {
        assert.equal(reportFileName('2026-07-14T08:00:00.000Z'), 'myip-report-2026-07-14.json');
    });
});
