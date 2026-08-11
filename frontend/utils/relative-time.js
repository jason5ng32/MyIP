// Localized "how long ago" / "how long it lasted" strings, shared by the Pulse
// widgets (status feed + outage broadcast). Intl owns the wording; the only
// local rules are the unit tiers and CJK spacing.

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
