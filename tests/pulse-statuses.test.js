// Tests for frontend/data/pulse-statuses.js: vocabulary integrity (unique
// ids and emoji across preset + festival lists), festival window shape and
// activation logic (yearly recurrence incl. year-boundary wrap, explicit
// windows for lunar-calendar festivals), and full locale coverage. Also
// acts as the maintenance reminder: explicit windows must keep ≥90 days of
// runway, so `pnpm check` starts failing well before they run out.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    PRESET_STATUSES,
    FESTIVAL_STATUSES,
    festivalsActiveOn,
    localDateString,
} from '../frontend/data/pulse-statuses.js';

const REQUIRED_LOCALES = ['en', 'zh', 'fr', 'ru'];
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
    it('every festival has exactly one window shape: yearly or windows', () => {
        for (const f of FESTIVAL_STATUSES) {
            assert.ok(Boolean(f.yearly) !== Boolean(f.windows),
                `${f.id} must have either yearly or windows, not both/neither`);
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
        const deadlineStr = localDateString(deadline);
        for (const f of FESTIVAL_STATUSES.filter((s) => s.windows)) {
            const latest = f.windows.map((w) => w.to).sort().at(-1);
            assert.ok(latest >= deadlineStr,
                `${f.id} windows run out on ${latest} — append upcoming years in pulse-statuses.js`);
        }
    });

    it('festivalsActiveOn matches yearly festivals in any year', () => {
        const ids = (d) => festivalsActiveOn(d).map((f) => f.id);
        assert.deepEqual(ids('2026-10-31'), ['halloween']);
        assert.deepEqual(ids('2031-10-31'), ['halloween']);
        assert.deepEqual(ids('2026-08-10'), []);
        // Overlapping windows both stay visible.
        assert.deepEqual(ids('2026-10-30'), ['internetday', 'halloween']);
        // prgday's window covers leap years, where day 256 is Sep 12.
        assert.ok(ids('2028-09-12').includes('prgday'));
        // IPCheck.ing's own birthday (v1.0 shipped Nov 6, 2020).
        assert.ok(ids('2031-11-06').includes('birthday'));
    });

    it('the newyear window wraps the year boundary', () => {
        const ids = (d) => festivalsActiveOn(d).map((f) => f.id);
        assert.deepEqual(ids('2026-12-30'), ['newyear']);
        assert.deepEqual(ids('2031-01-02'), ['newyear']);
        assert.deepEqual(ids('2027-01-03'), []);
    });

    it('festivalsActiveOn matches explicit windows only inside their dates', () => {
        const ids = (d) => festivalsActiveOn(d).map((f) => f.id);
        assert.deepEqual(ids('2028-01-26'), ['lunar']);
        assert.deepEqual(ids('2026-11-08'), ['diwali']);
        assert.deepEqual(ids('2030-02-05'), ['eid']);
        assert.deepEqual(ids('2026-02-17'), []); // before the list shipped
    });

    it('localDateString formats as YYYY-MM-DD with zero padding', () => {
        assert.equal(localDateString(new Date(2026, 0, 5)), '2026-01-05');
        assert.equal(localDateString(new Date(2026, 11, 31)), '2026-12-31');
    });
});

describe('locale coverage', () => {
    const packs = Object.fromEntries(REQUIRED_LOCALES.map((lang) => [
        lang, JSON.parse(fs.readFileSync(`frontend/locales/${lang}.json`, 'utf8')),
    ]));

    it('every status has a label in all four packs', () => {
        for (const lang of REQUIRED_LOCALES) {
            const labels = packs[lang].nav?.pulse?.statuses || {};
            for (const s of ALL) {
                assert.ok(typeof labels[s.id] === 'string' && labels[s.id].length > 0,
                    `${lang}.json missing nav.pulse.statuses.${s.id}`);
            }
        }
    });

    it('every festival has a description in all four packs', () => {
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
