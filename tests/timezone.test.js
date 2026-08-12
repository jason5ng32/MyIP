// Tests for frontend/utils/timezone.js. The zone-name helpers take an explicit
// instant so DST and date-rollover cases are deterministic; getTimezoneInfo
// reads the host's own zone, which the Node test runner doesn't pin, so only
// its shape is asserted.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatUtcOffset, getTimezoneInfo, getZoneUtcOffset, getZoneLocalTime } from '../frontend/utils/timezone.js';

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
