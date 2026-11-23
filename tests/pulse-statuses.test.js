// Tests for frontend/data/pulse-statuses.js: vocabulary integrity (unique
// ids and emoji across preset + festival lists), festival range shape and
// the global activation window (UTC+14 entering the first day → UTC−12
// leaving the last; yearly recurrence incl. year-boundary wrap, n-th weekday
// rules, explicit windows for lunar-calendar festivals), and full locale
// coverage. Also
// acts as the maintenance reminder: explicit windows must keep ≥90 days of
// runway, so `pnpm check` starts failing well before they run out.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    PRESET_STATUSES,
    FESTIVAL_STATUSES,
    festivalsActiveAt,
    nthWeekdayOf,
} from '../frontend/data/pulse-statuses.js';
import { FULL_LOCALE_CODES } from '../common/locale-registry.js';

// Coverage is required of full locales only; a beta pack may still be filling in.
const REQUIRED_LOCALES = FULL_LOCALE_CODES;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_DAY_RE = /^\d{2}-\d{2}$/;
const ALL = [...PRESET_STATUSES, ...FESTIVAL_STATUSES];

describe('pulse status vocabulary', () => {
    it('ids are unique across preset + festival lists', () => {
        const ids = ALL.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate status id');
    });

    it('emoji are unique across preset + festival lists (country rows render them bare)', () => {
        const emoji = ALL.map((s) => s.emoji);
        assert.equal(new Set(emoji).size, emoji.length, 'duplicate status emoji');
    });

    it('every status has a non-empty id and emoji', () => {
        for (const s of ALL) {
            assert.ok(typeof s.id === 'string' && s.id.length > 0, 'missing id');
            assert.ok(typeof s.emoji === 'string' && s.emoji.length > 0, `${s.id} missing emoji`);
        }
    });

    it('celebration effect fields are valid', () => {
        for (const s of ALL) {
            if (s.effect !== undefined) {
                assert.ok(['fireworks', 'fall'].includes(s.effect),
                    `${s.id} has unknown effect "${s.effect}"`);
            }
            if (s.effectEmoji !== undefined) {
                assert.equal(s.effect, 'fall',
                    `${s.id}: effectEmoji only overrides the sprite of a fall effect`);
                assert.ok(typeof s.effectEmoji === 'string' && s.effectEmoji.length > 0,
                    `${s.id} effectEmoji empty`);
            }
        }
    });
});

describe('festival windows', () => {
    it('every festival has exactly one window shape: yearly, nth or windows', () => {
        for (const f of FESTIVAL_STATUSES) {
            const shapes = [f.yearly, f.nth, f.windows].filter(Boolean).length;
            assert.equal(shapes, 1, `${f.id} must have exactly one of yearly / nth / windows`);
        }
    });

    it('nth rules are valid month / weekday / n', () => {
        for (const f of FESTIVAL_STATUSES.filter((s) => s.nth)) {
            const { month, weekday, n } = f.nth;
            assert.ok(Number.isInteger(month) && month >= 1 && month <= 12, `${f.id} nth.month`);
            assert.ok(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6, `${f.id} nth.weekday`);
            assert.ok(Number.isInteger(n) && n !== 0, `${f.id} nth.n`);
        }
    });

    it('yearly windows are valid MM-DD ranges', () => {
        for (const f of FESTIVAL_STATUSES.filter((s) => s.yearly)) {
            assert.match(f.yearly.from, MONTH_DAY_RE, `${f.id} yearly.from malformed`);
            assert.match(f.yearly.to, MONTH_DAY_RE, `${f.id} yearly.to malformed`);
        }
    });

    it('explicit windows are valid, ordered date ranges', () => {
        for (const f of FESTIVAL_STATUSES.filter((s) => s.windows)) {
            assert.ok(f.windows.length > 0, `${f.id} has no windows`);
            for (const w of f.windows) {
                assert.match(w.from, DATE_RE, `${f.id} window.from malformed`);
                assert.match(w.to, DATE_RE, `${f.id} window.to malformed`);
                assert.ok(w.from <= w.to, `${f.id} window from > to`);
                assert.ok(!Number.isNaN(Date.parse(w.from)), `${f.id} window.from unparseable`);
                assert.ok(!Number.isNaN(Date.parse(w.to)), `${f.id} window.to unparseable`);
            }
        }
    });

    it('explicit windows keep at least 90 days of runway (maintenance reminder)', () => {
        // Deliberately time-dependent: when this fails, append the next few
        // years of dates in frontend/data/pulse-statuses.js (see its header).
        const deadline = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        const deadlineStr = deadline.toISOString().slice(0, 10);
        for (const f of FESTIVAL_STATUSES.filter((s) => s.windows)) {
            const latest = f.windows.map((w) => w.to).sort().at(-1);
            assert.ok(latest >= deadlineStr,
                `${f.id} windows run out on ${latest} — append upcoming years in pulse-statuses.js`);
        }
    });

    const ids = (iso) => festivalsActiveAt(new Date(iso)).map((f) => f.id);

    it('a single day is active from UTC+14 entering it to UTC−12 leaving it', () => {
        assert.deepEqual(ids('2026-10-30T09:59:59Z'), ['internetday']);
        assert.ok(ids('2026-10-30T10:00:00Z').includes('halloween'));
        assert.deepEqual(ids('2026-11-01T11:59:59Z'), ['halloween', 'dayofdead']);
        assert.deepEqual(ids('2026-11-01T12:00:00Z'), ['dayofdead']);
    });

    it('yearly festivals recur in any year', () => {
        assert.deepEqual(ids('2031-10-31T09:00:00Z'), ['halloween']);
        assert.deepEqual(ids('2026-08-10T12:00:00Z'), []);
        // Overlapping windows both stay visible.
        assert.deepEqual(ids('2026-10-30T11:00:00Z'), ['internetday', 'halloween']);
        assert.deepEqual(ids('2026-11-01T11:00:00Z'), ['halloween', 'dayofdead']);
        // prgday covers leap years, where day 256 is Sep 12.
        assert.ok(ids('2028-09-11T10:00:00Z').includes('prgday'));
        // IPCheck.ing's own birthday (v1.0 shipped Nov 6, 2020).
        assert.ok(ids('2031-11-06T12:00:00Z').includes('birthday'));
    });

    it('the newyear window wraps the year boundary', () => {
        assert.deepEqual(ids('2026-12-30T10:00:00Z'), ['newyear']);
        assert.deepEqual(ids('2031-01-02T11:59:00Z'), ['newyear']);
        assert.deepEqual(ids('2027-01-02T12:00:00Z'), []);
    });

    it('nthWeekdayOf counts from the start (n ≥ 1) or the end (n ≤ −1)', () => {
        const day = (year, nth) => new Date(nthWeekdayOf(year, nth)).toISOString().slice(0, 10);
        assert.equal(day(2026, { month: 11, weekday: 4, n: 1 }), '2026-11-05');
        assert.equal(day(2026, { month: 11, weekday: 0, n: 1 }), '2026-11-01'); // month opens on it
        assert.equal(day(2026, { month: 7, weekday: 5, n: -1 }), '2026-07-31'); // month closes on it
        assert.equal(day(2028, { month: 2, weekday: 2, n: -1 }), '2028-02-29'); // leap day
        assert.equal(day(2026, { month: 10, weekday: 2, n: -2 }), '2026-10-20');
    });

    it('nth festivals land on their weekday every year', () => {
        const expected = {
            sysadmin: ['2026-07-31', '2027-07-30', '2028-07-28', '2029-07-27', '2030-07-26', '2031-07-25'],
            tomatina: ['2026-08-26', '2027-08-25', '2028-08-30', '2029-08-29', '2030-08-28', '2031-08-27'],
            adaday: ['2026-10-13', '2027-10-12', '2028-10-10', '2029-10-09', '2030-10-08', '2031-10-14'],
            thanksgiving: ['2026-11-26', '2027-11-25', '2028-11-23', '2029-11-22', '2030-11-28', '2031-11-27'],
        };
        assert.deepEqual(Object.keys(expected).sort(),
            FESTIVAL_STATUSES.filter((f) => f.nth).map((f) => f.id).sort());
        const twoDaysLater = (iso) => new Date(Date.parse(`${iso}T12:00:00Z`) + 2 * 24 * 60 * 60 * 1000).toISOString();
        for (const [id, days] of Object.entries(expected)) {
            for (const iso of days) {
                assert.ok(ids(`${iso}T12:00:00Z`).includes(id), `${id} inactive on ${iso}`);
                assert.ok(!ids(twoDaysLater(iso)).includes(id), `${id} still active 2 days after ${iso}`);
            }
        }
        // sysadmin 2026 (Jul 31): opens Jul 30 10:00Z, closes Aug 1 12:00Z.
        assert.ok(!ids('2026-07-30T09:59:59Z').includes('sysadmin'));
        assert.deepEqual(ids('2026-08-01T11:59:59Z'), ['sysadmin']);
        assert.deepEqual(ids('2026-08-01T12:00:00Z'), []);
    });

    it('explicit windows are active only around their dates', () => {
        assert.deepEqual(ids('2028-01-26T12:00:00Z'), ['lunar']);
        assert.deepEqual(ids('2026-11-08T12:00:00Z'), ['diwali']);
        assert.deepEqual(ids('2030-02-05T12:00:00Z'), ['eid']);
        // eid 2030 (02-05..02-06) opens 02-04T10:00Z, closes 02-07T12:00Z.
        assert.ok(!ids('2030-02-04T09:59:59Z').includes('eid'));
        assert.deepEqual(ids('2030-02-07T11:59:59Z'), ['eid']);
        assert.deepEqual(ids('2030-02-07T12:00:00Z'), []);
        assert.deepEqual(ids('2026-02-17T12:00:00Z'), []); // before the list shipped
        // holi 2029 (02-28..03-01) opens 02-27T10:00Z, closes 03-02T12:00Z.
        assert.ok(!ids('2029-02-27T09:59:59Z').includes('holi'));
        assert.deepEqual(ids('2029-03-01T12:00:00Z'), ['holi']);
        assert.deepEqual(ids('2029-03-02T12:00:00Z'), []);
    });

    it('defaults to the current instant', () => {
        assert.ok(Array.isArray(festivalsActiveAt()));
    });
});

describe('locale coverage', () => {
    const packs = Object.fromEntries(REQUIRED_LOCALES.map((lang) => [
        lang, JSON.parse(fs.readFileSync(`frontend/locales/${lang}.json`, 'utf8')),
    ]));

    it('every status has a label in every full pack', () => {
        for (const lang of REQUIRED_LOCALES) {
            const labels = packs[lang].nav?.pulse?.statuses || {};
            for (const s of ALL) {
                assert.ok(typeof labels[s.id] === 'string' && labels[s.id].length > 0,
                    `${lang}.json missing nav.pulse.statuses.${s.id}`);
            }
        }
    });

    it('every festival has a description in every full pack', () => {
        for (const lang of REQUIRED_LOCALES) {
            const descs = packs[lang].nav?.pulse?.festivalDesc || {};
            for (const f of FESTIVAL_STATUSES) {
                assert.ok(typeof descs[f.id] === 'string' && descs[f.id].length > 0,
                    `${lang}.json missing nav.pulse.festivalDesc.${f.id}`);
            }
            assert.equal(Object.keys(descs).length, FESTIVAL_STATUSES.length,
                `${lang}.json festivalDesc has stray keys`);
        }
    });

    it('the emoji-day label is pure emoji and identical everywhere', () => {
        for (const lang of REQUIRED_LOCALES) {
            const label = packs[lang].nav.pulse.statuses.emojiday;
            assert.equal(label, packs.en.nav.pulse.statuses.emojiday,
                `${lang}.json emojiday label diverged`);
            assert.ok(!/[A-Za-z0-9一-鿿Ѐ-ӿ]/.test(label),
                'emojiday label must contain no letters or digits');
        }
    });
});
