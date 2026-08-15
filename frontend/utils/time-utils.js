// Time & date helpers, grouped by concern: UTC offsets & zone wall-clock time
// (IP cards, analytics), relative time & durations (Pulse widgets), and
// absolute date rendering (changelog, achievements). Intl owns all wording so
// every viewer reads their own locale; only tier rules and CJK spacing are
// decided locally.

/* ------------------------------------------------------------------ */
/* UTC offsets & zone wall-clock time                                  */
/* ------------------------------------------------------------------ */

// Format a UTC offset given in minutes (east-positive) as "+08:00" / "-05:00".
// 480 → "+08:00", -300 → "-05:00", 0 → "+00:00".
export const formatUtcOffset = (offsetMinutes) => {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
};

// Current UTC offset of an IANA zone name ("Asia/Singapore" → "+08:00"), '' for
// a missing or unrecognized zone. The backend sends geo results the zone name
// alone — offsets are computed here, per view, because those routes sit behind
// a 24h edge cache that would keep serving a pre-DST offset after the switch.
//
// `at` exists so tests can pin an instant; callers pass nothing and get now.
export const getZoneUtcOffset = (timezone, at = new Date()) => {
    if (!timezone) return '';

    let label = '';
    try {
        label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
            .formatToParts(at)
            .find((part) => part.type === 'timeZoneName')?.value || '';
    } catch {
        // Unknown zone name — Intl throws rather than falling back.
        return '';
    }

    // Intl spells the offset "GMT+08:00" / "GMT-03:30", and a bare "GMT" at zero.
    const match = label.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
    if (!match) return '';

    const [, sign, hours, minutes] = match;
    if (!sign) return formatUtcOffset(0);

    const total = Number(hours) * 60 + Number(minutes || 0);
    return formatUtcOffset(sign === '-' ? -total : total);
};

// Wall-clock time in an IANA zone right now, localized for the viewer
// ("Aug 12, 2026, 5:30 PM" / "2026年8月12日 17:30"), '' for a missing or
// unrecognized zone. The date rides along because it is the half most likely
// to differ from the viewer's own.
export const getZoneLocalTime = (timezone, locale = 'en', at = new Date()) => {
    if (!timezone) return '';

    try {
        return new Intl.DateTimeFormat(locale || undefined, {
            timeZone: timezone,
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(at);
    } catch {
        return '';
    }
};

// Read the browser's timezone
export const getTimezoneInfo = () => {
    let timezone = '';
    let offset = '';
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch { /* leave empty */ }
    try {
        // getTimezoneOffset() is UTC-minus-local in minutes; negate it so the
        // result is east-positive, matching how offsets are written (+08:00).
        offset = formatUtcOffset(-new Date().getTimezoneOffset());
    } catch { /* leave empty */ }
    return { timezone, offset };
};

/* ------------------------------------------------------------------ */
/* Relative time & durations (Pulse widgets)                           */
/* ------------------------------------------------------------------ */

// `short`, not `narrow`: narrow renders French / Russian as a bare "-3 min",
// while short keeps the natural "il y a 3 min" / "3 мин. назад" and puts a
// space between the number and its unit in every Latin / Cyrillic locale.
const RELATIVE_STYLE = 'short';

const HOUR = 60;
const DAY = 24 * HOUR;
const DAY_TIER = 2 * DAY; // below two days, hours read better than "2 days ago"

// Intl packs Chinese as "3小时前" / "2天3小时"; CJK typography wants a space on
// both sides of a numeral. Kana / Hangul are in range too — they follow the
// same rule if those locales ever ship.
const CJK = '\\u3400-\\u9fff\\u3040-\\u30ff\\uac00-\\ud7af';
const DIGIT_THEN_CJK = new RegExp(`(\\d)([${CJK}])`, 'g');
const CJK_THEN_DIGIT = new RegExp(`([${CJK}])(\\d)`, 'g');

const spaceNumerals = (text) => text
    .replace(DIGIT_THEN_CJK, '$1 $2')
    .replace(CJK_THEN_DIGIT, '$1 $2');

// Minutes inside the hour, hours up to two days, days beyond.
// Falls back to "-42m" where Intl.RelativeTimeFormat is unavailable.
export const relativeTimeFromMinutes = (minutesAgo, locale) => {
    if (!Number.isFinite(minutesAgo)) return '';
    const minutes = Math.max(0, Math.round(minutesAgo));
    try {
        const rtf = new Intl.RelativeTimeFormat(locale, { style: RELATIVE_STYLE });
        if (minutes >= DAY_TIER) return spaceNumerals(rtf.format(-Math.round(minutes / DAY), 'day'));
        if (minutes >= HOUR) return spaceNumerals(rtf.format(-Math.floor(minutes / HOUR), 'hour'));
        return spaceNumerals(rtf.format(-minutes, 'minute'));
    } catch {
        return `-${minutes}m`;
    }
};

// Same output, from an absolute timestamp (anything Date.parse accepts).
export const relativeTimeSince = (date, locale) =>
    relativeTimeFromMinutes((Date.now() - Date.parse(date)) / 60000, locale);

// Compact duration ("2d 3h" / "2 天 3 小时") from a millisecond span, via
// Intl.DurationFormat with a plain d/h/m fallback. Two largest units only —
// enough at bulletin granularity.
export const formatDuration = (ms, locale) => {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    const totalMinutes = Math.round(ms / 60000);
    const days = Math.floor(totalMinutes / DAY);
    const hours = Math.floor((totalMinutes % DAY) / HOUR);
    const minutes = totalMinutes % HOUR;
    const parts = days > 0
        ? { days, hours }
        : (hours > 0 ? { hours, minutes } : { minutes });
    try {
        return spaceNumerals(new Intl.DurationFormat(locale, { style: 'narrow' }).format(parts));
    } catch {
        return [
            parts.days ? `${parts.days}d` : null,
            parts.hours ? `${parts.hours}h` : null,
            parts.minutes ? `${parts.minutes}m` : null,
        ].filter(Boolean).join(' ') || '0m';
    }
};

/* ------------------------------------------------------------------ */
/* Absolute dates                                                      */
/* ------------------------------------------------------------------ */

// Localized absolute date ("Jan 1, 2024" / "2024年1月1日") from a Unix
// millisecond timestamp (number or numeric string), rendered in the viewer's
// own zone. `locale` is the app UI language; omitted → browser locale. '' for
// an unusable timestamp.
export const unixToDateTime = (timestamp, locale) => {
    // Number(null) / Number('') coerce to 0 — treat "no data" as unusable, not epoch.
    if (timestamp == null || timestamp === '') return '';
    const ms = Number(timestamp);
    if (!Number.isFinite(ms)) return '';
    try {
        return new Intl.DateTimeFormat(locale || undefined, { dateStyle: 'medium' })
            .format(new Date(ms));
    } catch {
        return '';
    }
};

// Localized date + time ("Aug 15, 2026, 3:04 PM" / "2026年8月15日 15:04") from
// an ISO 8601 instant (anything Date.parse accepts), rendered in the viewer's
// own zone — the shared report's generated / expiry / per-section stamps.
// '' for a missing or unparseable input.
export const isoToDateTime = (iso, locale) => {
    const ms = Date.parse(iso ?? '');
    if (!Number.isFinite(ms)) return '';
    try {
        return new Intl.DateTimeFormat(locale || undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(ms);
    } catch {
        return '';
    }
};

// Localized absolute date ("Nov 6, 2020" / "2020年11月6日") from an ISO
// "YYYY-MM-DD" string — the changelog and every date-only ISO surface
// (OONI windows, IP-history day headers). Formatted in UTC so the calendar
// date never shifts a day for west-of-UTC viewers; non-ISO strings (the
// changelog's "Beta" placeholder) pass through untouched.
export const formatIsoDate = (isoDate, locale) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
    if (!match) return isoDate || '';

    const [, year, month, day] = match;
    try {
        return new Intl.DateTimeFormat(locale || undefined, {
            dateStyle: 'medium',
            timeZone: 'UTC',
        }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
    } catch {
        return isoDate;
    }
};
