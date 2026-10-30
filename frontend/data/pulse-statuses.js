// Pulse (Earth Online) status vocabulary: evergreen preset statuses plus
// time-limited festival statuses. ids + emoji, plus an optional celebration
// `effect` on festivals ('fireworks' | 'fall'; absent → the default emoji
// pop). `effectEmoji` overrides the particle sprite when the status emoji
// isn't the thing that should fall (christmas 🎄 snows ❄️). Recipes live in
// utils/features/pulse-celebration.js.

export const PRESET_STATUSES = [
    { id: 'fast', emoji: '🚀' },
    { id: 'ok', emoji: '✅' },
    { id: 'slow', emoji: '🐢' },
    { id: 'flaky', emoji: '🔌' },
    { id: 'blocked', emoji: '🚧' },
    { id: 'lag', emoji: '🎮' },
    { id: 'newip', emoji: '🔄' },
    { id: 'vpn', emoji: '🛡️' },
    { id: 'fixing', emoji: '🔧' },
    { id: 'tuning', emoji: '⏱️' },
    { id: 'good', emoji: '😎' },
    { id: 'bad', emoji: '😮‍💨' },
    { id: 'night', emoji: '🌙' },
    { id: 'vibing', emoji: '🧑‍💻' },
    { id: 'passing', emoji: '👋' },
];

// Festival statuses show up in the composer only while their window is
// active. A range names the festival's own calendar day(s); the window is
// global — open from the moment the first timezone (UTC+14) enters the
// first day until the last one (UTC−12) leaves the last day, ~50h for a
// single day. Whenever anyone on Earth can post a festival, every viewer
// sees its chip. The Pulse worker checks the same window. Two range shapes:
//
//   yearly:  { from: 'MM-DD', to: 'MM-DD' } — recurs every year forever,
//            zero maintenance. from > to means the range wraps the year
//            boundary (newyear). prgday spans Sep 12–13: day 256 is Sep 13,
//            or Sep 12 in leap years.
//   windows: [{ from/to: 'YYYY-MM-DD' }] — for lunar-calendar festivals
//            that land on different dates every year (no computable rule).
//            Filled through 2031; extending = appending one line per year
//            with the festival's next date (eid keeps ±1 day, as its date
//            depends on moon sighting). tests/pulse-statuses.test.js starts
//            failing 90 days before the runway ends as the reminder.
//
// Ordered chronologically from the season this list first shipped.
export const FESTIVAL_STATUSES = [
    { id: 'prgday', emoji: '⌨️', yearly: { from: '09-12', to: '09-13' } },
    { id: 'internetday', emoji: '🌐', yearly: { from: '10-29', to: '10-29' } },
    { id: 'halloween', emoji: '🎃', effect: 'fall', yearly: { from: '10-31', to: '10-31' } },
    { id: 'birthday', emoji: '🎂', effect: 'fireworks', yearly: { from: '11-06', to: '11-06' } },
    {
        id: 'diwali', emoji: '🪔', effect: 'fireworks',
        windows: [
            { from: '2026-11-08', to: '2026-11-08' },
            { from: '2027-10-29', to: '2027-10-29' },
            { from: '2028-10-17', to: '2028-10-17' },
            { from: '2029-11-05', to: '2029-11-05' },
            { from: '2030-10-26', to: '2030-10-26' },
            { from: '2031-11-14', to: '2031-11-14' },
        ],
    },
    { id: 'christmas', emoji: '🎄', effect: 'fall', effectEmoji: '❄️', yearly: { from: '12-25', to: '12-25' } },
    { id: 'newyear', emoji: '🎆', effect: 'fireworks', yearly: { from: '12-31', to: '01-01' } },
    { id: 'privacyday', emoji: '🕵️', yearly: { from: '01-28', to: '01-28' } },
    {
        id: 'lunar', emoji: '🧧', effect: 'fall',
        windows: [
            { from: '2027-02-06', to: '2027-02-06' },
            { from: '2028-01-26', to: '2028-01-26' },
            { from: '2029-02-13', to: '2029-02-13' },
            { from: '2030-02-03', to: '2030-02-03' },
            { from: '2031-01-23', to: '2031-01-23' },
        ],
    },
    { id: 'valentine', emoji: '💘', effect: 'fall', yearly: { from: '02-14', to: '02-14' } },
    { id: 'jobs', emoji: '🍎', yearly: { from: '02-24', to: '02-24' } },
    {
        id: 'eid', emoji: '🕌',
        windows: [
            { from: '2027-03-09', to: '2027-03-10' },
            { from: '2028-02-26', to: '2028-02-27' },
            { from: '2029-02-14', to: '2029-02-15' },
            { from: '2030-02-05', to: '2030-02-06' },
            { from: '2031-01-25', to: '2031-01-26' },
        ],
    },
    { id: 'aprilfools', emoji: '🤡', yearly: { from: '04-01', to: '04-01' } },
    { id: 'earthday', emoji: '🌍', yearly: { from: '04-22', to: '04-22' } },
    { id: 'turing', emoji: '🤖', yearly: { from: '06-23', to: '06-23' } },
    { id: 'emojiday', emoji: '😀', yearly: { from: '07-17', to: '07-17' } },
];

// Global window of a calendar range: from UTC+14 entering its first day
// to UTC−12 leaving its last, compared against an instant, never a local date.
const DAY_MS = 24 * 60 * 60 * 1000;
const LEAD_MS = 14 * 60 * 60 * 1000;
const TRAIL_MS = 12 * 60 * 60 * 1000;

// 'MM-DD' of a given year / 'YYYY-MM-DD' → UTC midnight timestamp.
const mdTime = (year, md) => Date.UTC(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3)));
const isoTime = (iso) => Date.parse(`${iso}T00:00:00Z`);

const inWindow = (t, fromMs, toMs) => t >= fromMs - LEAD_MS && t < toMs + DAY_MS + TRAIL_MS;

const isActiveAt = (festival, t) => {
    if (festival.windows) {
        return festival.windows.some((w) => inWindow(t, isoTime(w.from), isoTime(w.to)));
    }
    // Yearly: materialize last, this and next year's range (a window reaches
    // across Jan 1); from > to wraps into the following year.
    const year = new Date(t).getUTCFullYear();
    return [year - 1, year, year + 1].some((y) => {
        const fromMs = mdTime(y, festival.yearly.from);
        let toMs = mdTime(y, festival.yearly.to);
        if (toMs < fromMs) toMs = mdTime(y + 1, festival.yearly.to);
        return inWindow(t, fromMs, toMs);
    });
};

export const festivalsActiveAt = (now = new Date()) => {
    const t = now.getTime();
    return FESTIVAL_STATUSES.filter((f) => isActiveAt(f, t));
};
