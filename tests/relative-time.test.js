// Unit tests for the shared relative-time / duration formatters used by the
// Pulse widgets. Assertions stay on structure (tier picked, numeral spacing)
// rather than exact CLDR wording, which moves between ICU versions.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    relativeTimeFromMinutes,
    relativeTimeSince,
    formatDuration,
} from '../frontend/utils/relative-time.js';

// CJK typography rule: a numeral never touches a Han glyph ("3 小时前").
const assertCjkSpacing = (text) => {
    assert.ok(!/\d\p{Script=Han}/u.test(text), `numeral glued to text: ${text}`);
    assert.ok(!/\p{Script=Han}\d/u.test(text), `text glued to numeral: ${text}`);
};

// Relative time additionally reads as prose everywhere ("3 hr. ago",
// "il y a 3 min") — no glued unit abbreviations.
const assertSpacedNumerals = (text) => {
    assertCjkSpacing(text);
    assert.ok(!/\d\p{L}/u.test(text), `numeral glued to unit: ${text}`);
};

describe('relativeTimeFromMinutes', () => {
    it('picks minutes, hours and days by tier', () => {
        assert.match(relativeTimeFromMinutes(5, 'en'), /5 min/);
        assert.match(relativeTimeFromMinutes(59, 'en'), /59 min/);
        assert.match(relativeTimeFromMinutes(60, 'en'), /1 hr/);
        assert.match(relativeTimeFromMinutes(47 * 60, 'en'), /47 hr/);
        assert.match(relativeTimeFromMinutes(48 * 60, 'en'), /2 days/);
        assert.match(relativeTimeFromMinutes(10 * 24 * 60, 'en'), /10 days/);
    });

    it('separates numerals from their unit in every shipped locale', () => {
        for (const locale of ['en', 'zh', 'fr', 'ru']) {
            for (const minutes of [5, 90, 3 * 24 * 60]) {
                assertSpacedNumerals(relativeTimeFromMinutes(minutes, locale));
            }
        }
    });

    it('renders past tense, never a bare minus sign', () => {
        assert.ok(!relativeTimeFromMinutes(90, 'fr').startsWith('-'));
        assert.ok(!relativeTimeFromMinutes(90, 'ru').startsWith('-'));
    });

    it('clamps clock skew to now and rejects unusable input', () => {
        assert.equal(relativeTimeFromMinutes(-30, 'en'), relativeTimeFromMinutes(0, 'en'));
        assert.equal(relativeTimeFromMinutes(NaN, 'en'), '');
        assert.equal(relativeTimeFromMinutes(undefined, 'en'), '');
    });
});

describe('relativeTimeSince', () => {
    it('accepts an ISO timestamp', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        assert.match(relativeTimeSince(twoHoursAgo, 'en'), /2 hr/);
    });

    it('returns empty for an unparseable date', () => {
        assert.equal(relativeTimeSince('not-a-date', 'en'), '');
    });
});

describe('formatDuration', () => {
    it('keeps the two largest units', () => {
        const day = 24 * 60 * 60 * 1000;
        assert.match(formatDuration(2 * day + 3 * 60 * 60 * 1000 + 30 * 60 * 1000, 'en'), /2d.*3h/);
        assert.match(formatDuration(5 * 60 * 60 * 1000 + 20 * 60 * 1000, 'en'), /5h.*20m/);
        assert.match(formatDuration(20 * 60 * 1000, 'en'), /20m/);
    });

    // Duration stays deliberately compact ("2d 3h"), so only the CJK rule applies.
    it('spaces numerals against CJK units', () => {
        for (const locale of ['en', 'zh', 'fr', 'ru']) {
            assertCjkSpacing(formatDuration(26 * 60 * 60 * 1000, locale));
        }
        assert.match(formatDuration(26 * 60 * 60 * 1000, 'zh'), /1 天 2 小时/);
    });

    it('returns empty for a non-positive or unusable span', () => {
        assert.equal(formatDuration(0, 'en'), '');
        assert.equal(formatDuration(-1000, 'en'), '');
        assert.equal(formatDuration(NaN, 'en'), '');
    });
});
