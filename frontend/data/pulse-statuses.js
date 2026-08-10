// Pulse (Earth Online) status vocabulary: evergreen preset statuses plus
// time-limited festival statuses. ids + emoji, plus an optional celebration
// `effect` on festivals ('fireworks' | 'fall'; absent → the default emoji
// pop). `effectEmoji` overrides the particle sprite when the status emoji
// isn't the thing that should fall (christmas 🎄 snows ❄️). Recipes live in
// utils/pulse-celebration.js.

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
// active (visitor-local date, so each festival "rolls" around the globe
// with the timezones). Two window shapes:
//
//   yearly:  { from: 'MM-DD', to: 'MM-DD' } — recurs every year forever,
//            zero maintenance. from > to means the window wraps the year
//            boundary (newyear). Ranges carry ±1 day of slack; prgday's
//            slack also covers leap years, where day 256 is Sep 12.
//   windows: [{ from/to: 'YYYY-MM-DD' }] — for lunar-calendar festivals
//            that land on different dates every year (no computable rule).
//            Filled through 2031; extending = appending one line per year
//            with the festival's next date ±1 day (±2 for eid, whose date
//            depends on moon sighting). tests/pulse-statuses.test.js starts
//            failing 90 days before the runway ends as the reminder.
//
// Ordered chronologically from the season this list first shipped.
export const FESTIVAL_STATUSES = [
    { id: 'prgday', emoji: '⌨️', yearly: { from: '09-12', to: '09-14' } },
    { id: 'internetday', emoji: '🌐', yearly: { from: '10-28', to: '10-30' } },
    { id: 'halloween', emoji: '🎃', effect: 'fall', yearly: { from: '10-30', to: '11-01' } },
    { id: 'birthday', emoji: '🎂', effect: 'fireworks', yearly: { from: '11-05', to: '11-07' } },
    {
        id: 'diwali', emoji: '🪔', effect: 'fireworks',
        windows: [
            { from: '2026-11-07', to: '2026-11-09' },
            { from: '2027-10-28', to: '2027-10-30' },
            { from: '2028-10-16', to: '2028-10-18' },
            { from: '2029-11-04', to: '2029-11-06' },
            { from: '2030-10-25', to: '2030-10-27' },
            { from: '2031-11-13', to: '2031-11-15' },
        ],
    },
    { id: 'christmas', emoji: '🎄', effect: 'fall', effectEmoji: '❄️', yearly: { from: '12-24', to: '12-26' } },
    { id: 'newyear', emoji: '🎆', effect: 'fireworks', yearly: { from: '12-30', to: '01-02' } },
    { id: 'privacyday', emoji: '🕵️', yearly: { from: '01-27', to: '01-29' } },
    {
        id: 'lunar', emoji: '🧧', effect: 'fall',
        windows: [
            { from: '2027-02-05', to: '2027-02-07' },
            { from: '2028-01-25', to: '2028-01-27' },
            { from: '2029-02-12', to: '2029-02-14' },
            { from: '2030-02-02', to: '2030-02-04' },
            { from: '2031-01-22', to: '2031-01-24' },
        ],
    },
    { id: 'valentine', emoji: '💘', effect: 'fall', yearly: { from: '02-13', to: '02-15' } },
    { id: 'jobs', emoji: '🍎', yearly: { from: '02-23', to: '02-25' } },
    {
        id: 'eid', emoji: '🕌',
        windows: [
            { from: '2027-03-08', to: '2027-03-11' },
            { from: '2028-02-25', to: '2028-02-28' },
            { from: '2029-02-13', to: '2029-02-16' },
            { from: '2030-02-04', to: '2030-02-07' },
            { from: '2031-01-24', to: '2031-01-27' },
        ],
    },
    { id: 'aprilfools', emoji: '🤡', yearly: { from: '03-31', to: '04-02' } },
    { id: 'earthday', emoji: '🌍', yearly: { from: '04-21', to: '04-23' } },
    { id: 'turing', emoji: '🤖', yearly: { from: '06-22', to: '06-24' } },
    { id: 'emojiday', emoji: '😀', yearly: { from: '07-16', to: '07-18' } },
];

// YYYY-MM-DD in the visitor's local time — festival windows are local-date
// comparisons by design (no UTC conversion).
export const localDateString = (d = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Pure window checks via ISO string compare; exported for tests.
const inYearly = (monthDay, y) => (y.from <= y.to
    ? monthDay >= y.from && monthDay <= y.to
    : monthDay >= y.from || monthDay <= y.to); // wraps the year boundary

export const festivalsActiveOn = (dateStr) => {
    const monthDay = dateStr.slice(5);
    return FESTIVAL_STATUSES.filter((f) => (f.yearly
        ? inYearly(monthDay, f.yearly)
        : f.windows.some((w) => dateStr >= w.from && dateStr <= w.to)));
};
