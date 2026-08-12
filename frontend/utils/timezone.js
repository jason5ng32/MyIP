// Timezone helpers, sharing one UTC-offset format across both callers:
// analytics reads the browser's own timezone (GA4 derives Country from the
// request IP and Language from navigator.language, but never the timezone),
// while the IP cards render the offset of a looked-up IP's zone.

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
