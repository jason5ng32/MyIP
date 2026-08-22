// Collects the browser-local signals no other test on the site reports:
// timezone and UTC offsets, the language list, and the browser's own
// rendering of a fixed number and date.

// The fixed values both halves format. Changing either here means changing
// it in the evaluating API too.
const SAMPLE_INSTANT = Date.UTC(2026, 0, 23, 15, 4, 5);
const SAMPLE_NUMBER = 1234567.89;

// Mid-winter and mid-summer of this year and last — enough instants to
// exercise a zone's DST rule.
const historicalSampleInstants = () => {
    const year = new Date().getUTCFullYear();
    return [
        Date.UTC(year, 0, 15),
        Date.UTC(year, 6, 15),
        Date.UTC(year - 1, 0, 15),
        Date.UTC(year - 1, 6, 15),
    ];
};

// JS reports minutes *behind* UTC (Tokyo → -540); everything downstream speaks
// minutes east of UTC, so the sign is flipped once, here.
const offsetEastOf = (instant) => -new Date(instant).getTimezoneOffset();

// Rendered output rather than resolvedOptions(): the string is what a site
// actually sees. All three samples follow the browser's locale, not the OS
// preferences (Chromium and Firefox ignore the system 24-hour toggle; Safari
// honors it). The date is pinned to UTC so both halves format the same day.
const readIntlSamples = () => {
    try {
        return {
            number: new Intl.NumberFormat().format(SAMPLE_NUMBER),
            date: new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' }).format(SAMPLE_INSTANT),
            hourCycle: new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
                .resolvedOptions().hourCycle || '',
        };
    } catch {
        return null;
    }
};

/**
 * Measure everything observable synchronously from this browser.
 */
export const observeBrowser = () => {
    const resolved = (() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions();
        } catch {
            return {};
        }
    })();

    return {
        timeZone: resolved.timeZone || '',
        // No locale argument on purpose: the browser's own regional setting.
        intl: readIntlSamples(),
        offsetMinutes: offsetEastOf(Date.now()),
        historicalOffsets: historicalSampleInstants()
            .map((ts) => ({ ts, offsetMinutes: offsetEastOf(ts) })),
        languages: Array.isArray(navigator.languages) && navigator.languages.length
            ? [...navigator.languages]
            : [navigator.language].filter(Boolean),
    };
};

