// Tests for frontend/utils/time-utils.js — the merged time & date helpers:
// zone offsets / wall-clock time, relative time & durations (Pulse), and
// absolute date rendering (changelog, achievements). Zone helpers take an
// explicit instant so DST and rollover cases are deterministic; assertions on
// Intl wording stay structural where CLDR moves between ICU versions.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    formatUtcOffset,
    getTimezoneInfo,
    getZoneUtcOffset,
    getZoneLocalTime,
    getZoneUtcOffsetMinutes,
    getWeekdayNames,
    relativeTimeFromMinutes,
    relativeTimeSince,
    formatDuration,
    unixToDateTime,
    isoToDateTime,
    formatIsoDate,
} from '../frontend/utils/time-utils.js';
import { LOCALE_CODES } from '../common/locale-registry.js';

/* ------------------------------------------------------------------ */
/* UTC offsets & zone wall-clock time                                  */
/* ------------------------------------------------------------------ */

describe('formatUtcOffset', () => {
  it('formats east-positive offsets with a leading +', () => {
    assert.equal(formatUtcOffset(480), '+08:00');   // China
    assert.equal(formatUtcOffset(330), '+05:30');   // India (half-hour)
    assert.equal(formatUtcOffset(345), '+05:45');   // Nepal (quarter-hour)
  });

  it('formats west offsets with a leading -', () => {
    assert.equal(formatUtcOffset(-300), '-05:00');  // US Eastern (DST)
    assert.equal(formatUtcOffset(-480), '-08:00');  // US Pacific
  });

  it('treats zero as +00:00', () => {
    assert.equal(formatUtcOffset(0), '+00:00');
  });
});

describe('getZoneUtcOffset', () => {
  // Instants are pinned so the DST cases don't flip with the calendar.
  const JANUARY = new Date('2026-01-15T12:00:00Z');
  const JULY = new Date('2026-07-15T12:00:00Z');

  it('resolves a zone name to its offset', () => {
    assert.equal(getZoneUtcOffset('Asia/Singapore', JANUARY), '+08:00');
    assert.equal(getZoneUtcOffset('Europe/Moscow', JANUARY), '+03:00');
  });

  it('handles the sub-hour zones', () => {
    assert.equal(getZoneUtcOffset('Asia/Kolkata', JANUARY), '+05:30');
    assert.equal(getZoneUtcOffset('Asia/Kathmandu', JANUARY), '+05:45');
    assert.equal(getZoneUtcOffset('Pacific/Marquesas', JANUARY), '-09:30');
  });

  it('follows DST, which is why the offset is computed per view', () => {
    assert.equal(getZoneUtcOffset('America/New_York', JANUARY), '-05:00');
    assert.equal(getZoneUtcOffset('America/New_York', JULY), '-04:00');
    // Southern hemisphere, and half-hour on both sides of the switch.
    assert.equal(getZoneUtcOffset('Australia/Adelaide', JANUARY), '+10:30');
    assert.equal(getZoneUtcOffset('Australia/Adelaide', JULY), '+09:30');
  });

  it('renders zero as +00:00, where Intl reports a bare "GMT"', () => {
    assert.equal(getZoneUtcOffset('UTC', JANUARY), '+00:00');
    assert.equal(getZoneUtcOffset('Africa/Abidjan', JANUARY), '+00:00');
  });

  it("returns '' for a missing or unrecognized zone", () => {
    assert.equal(getZoneUtcOffset(''), '');
    assert.equal(getZoneUtcOffset(null), '');
    assert.equal(getZoneUtcOffset(undefined), '');
    assert.equal(getZoneUtcOffset('Not/AZone', JANUARY), '');
  });
});

describe('getZoneLocalTime', () => {
  const NOON_UTC = new Date('2026-08-12T12:00:00Z');

  it('renders the wall-clock time in the target zone, not the host zone', () => {
    // 12:00 UTC is 20:00 in Singapore and 08:00 in New York (EDT).
    assert.match(getZoneLocalTime('Asia/Singapore', 'en', NOON_UTC), /8:00\s*PM/);
    assert.match(getZoneLocalTime('America/New_York', 'en', NOON_UTC), /8:00\s*AM/);
  });

  it('includes the date, which is the half most likely to differ', () => {
    assert.match(getZoneLocalTime('Asia/Singapore', 'en', NOON_UTC), /Aug 12, 2026/);
    // Same instant, already the 13th in Auckland.
    assert.match(getZoneLocalTime('Pacific/Auckland', 'en', NOON_UTC), /Aug 13, 2026/);
  });

  it('formats in the viewer locale', () => {
    assert.match(getZoneLocalTime('Asia/Singapore', 'zh', NOON_UTC), /2026/);
    assert.notEqual(
      getZoneLocalTime('Asia/Singapore', 'zh', NOON_UTC),
      getZoneLocalTime('Asia/Singapore', 'en', NOON_UTC),
    );
  });

  it("returns '' for a missing or unrecognized zone", () => {
    assert.equal(getZoneLocalTime('', 'en', NOON_UTC), '');
    assert.equal(getZoneLocalTime(undefined, 'en', NOON_UTC), '');
    assert.equal(getZoneLocalTime('Not/AZone', 'en', NOON_UTC), '');
  });
});

describe('getTimezoneInfo', () => {
  it('returns an { timezone, offset } pair of strings', () => {
    const info = getTimezoneInfo();
    assert.equal(typeof info.timezone, 'string');
    assert.equal(typeof info.offset, 'string');
  });

  it('produces a well-formed offset for the host timezone', () => {
    const { offset } = getTimezoneInfo();
    // Empty only on platforms without Date; otherwise must match ±HH:MM.
    assert.match(offset, /^$|^[+-]\d{2}:\d{2}$/);
  });
});

describe('getZoneUtcOffsetMinutes', () => {
    it('returns east-positive minutes for whole and half-hour zones', () => {
        const jan = new Date('2026-01-15T12:00:00Z');
        assert.equal(getZoneUtcOffsetMinutes('Asia/Singapore', jan), 480);
        assert.equal(getZoneUtcOffsetMinutes('Asia/Kolkata', jan), 330);
        assert.equal(getZoneUtcOffsetMinutes('America/New_York', jan), -300);
        assert.equal(getZoneUtcOffsetMinutes('UTC', jan), 0);
    });

    it('follows DST at the pinned instant', () => {
        assert.equal(getZoneUtcOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z')), -240);
    });

    it('returns null for missing or unknown zones', () => {
        assert.equal(getZoneUtcOffsetMinutes(''), null);
        assert.equal(getZoneUtcOffsetMinutes('Not/AZone'), null);
    });
});

describe('getWeekdayNames', () => {
  it('returns seven Monday-first names in English', () => {
    const names = getWeekdayNames('en');
    assert.equal(names.length, 7);
    assert.equal(names[0], 'Mon');
    assert.equal(names[6], 'Sun');
  });

  it('localizes for every registered locale without throwing', () => {
    for (const code of LOCALE_CODES) {
      const names = getWeekdayNames(code);
      assert.equal(names.length, 7);
      assert.ok(names.every((n) => typeof n === 'string' && n.length > 0), code);
    }
  });

  it('starts the Chinese week on 周一', () => {
    assert.equal(getWeekdayNames('zh')[0], '周一');
  });
});

/* ------------------------------------------------------------------ */
/* Relative time & durations (Pulse widgets)                           */
/* ------------------------------------------------------------------ */

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
        for (const locale of LOCALE_CODES) {
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
        for (const locale of LOCALE_CODES) {
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

/* ------------------------------------------------------------------ */
/* Absolute dates                                                      */
/* ------------------------------------------------------------------ */

// The timestamp → local date string output depends on the host TZ, so
// assertions stay flexible to avoid false failures across CI environments.
describe('unixToDateTime', () => {
  it('accepts a numeric timestamp and returns a non-empty string', () => {
    const out = unixToDateTime(1704067200000); // 2024-01-01 UTC
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  });

  it('accepts a numeric-string timestamp (coerced via Number())', () => {
    const out = unixToDateTime('1704067200000');
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  });

  it('output contains the year', () => {
    const epochYearZero = unixToDateTime(1704067200000); // 2024 boundary
    assert.ok(/2023|2024/.test(epochYearZero), `expected 2023 or 2024 in output, got "${epochYearZero}"`);
  });

  it('renders in the app locale when one is passed', () => {
    assert.match(unixToDateTime(1704067200000, 'zh'), /年/);
    assert.notEqual(
      unixToDateTime(1704067200000, 'zh'),
      unixToDateTime(1704067200000, 'en'),
    );
  });

  it('different timestamps produce different strings', () => {
    const a = unixToDateTime(1704067200000); // 2024
    const b = unixToDateTime(1767225600000); // 2026 UTC
    assert.notEqual(a, b);
  });

  it("returns '' for an unusable timestamp", () => {
    assert.equal(unixToDateTime(undefined), '');
    assert.equal(unixToDateTime('not-a-number'), '');
    assert.equal(unixToDateTime(null), ''); // Number(null) is 0 — but null means "no data"
  });
});

// Host-TZ-dependent output → structural assertions only (same policy as
// unixToDateTime above).
describe('isoToDateTime', () => {
  it('renders an ISO instant as a localized date + time', () => {
    const out = isoToDateTime('2026-08-15T09:23:41.412Z', 'en');
    assert.match(out, /2026/);
    assert.match(out, /\d:\d{2}/); // carries a time, unlike the date-only helpers
  });

  it('follows the app locale', () => {
    assert.match(isoToDateTime('2026-08-15T09:23:41Z', 'zh'), /年/);
    assert.notEqual(
      isoToDateTime('2026-08-15T09:23:41Z', 'zh'),
      isoToDateTime('2026-08-15T09:23:41Z', 'en'),
    );
  });

  it("returns '' for a missing or unparseable input", () => {
    assert.equal(isoToDateTime('', 'en'), '');
    assert.equal(isoToDateTime(undefined, 'en'), '');
    assert.equal(isoToDateTime('not-a-date', 'en'), '');
  });
});

describe('formatIsoDate', () => {
  it('localizes an ISO date per viewer locale', () => {
    assert.equal(formatIsoDate('2020-11-06', 'en'), 'Nov 6, 2020');
    assert.equal(formatIsoDate('2020-11-06', 'zh'), '2020年11月6日');
    assert.match(formatIsoDate('2020-11-06', 'fr'), /6 nov\. 2020/);
    assert.match(formatIsoDate('2020-11-06', 'ru'), /2020/);
  });

  it('keeps the calendar date stable regardless of host timezone', () => {
    // Formatted in UTC: a west-of-UTC host must not roll back to Dec 31.
    assert.match(formatIsoDate('2024-01-01', 'en'), /Jan 1, 2024/);
  });

  it('passes non-ISO strings through untouched', () => {
    assert.equal(formatIsoDate('Beta', 'en'), 'Beta');
    assert.equal(formatIsoDate('', 'en'), '');
    assert.equal(formatIsoDate(undefined, 'en'), '');
  });
});
