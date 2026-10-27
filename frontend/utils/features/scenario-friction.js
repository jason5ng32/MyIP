// Scenario friction: validates the IPCheck.ing `advancedData.scenarios` block and maps
// it onto display order, tones and locale keys (`ipInfos.scenarioFriction.*`).

// Display order; `kind` picks the verdict wording.
export const SCENARIOS = Object.freeze([
    { id: 'signup' },
    { id: 'payments' },
    { id: 'finance' },
    { id: 'streaming' },
    { id: 'availability', kind: 'availability' },
    { id: 'browsing' },
    { id: 'posting' },
    { id: 'crossBorderSocial' },
    { id: 'automation' },
    { id: 'email' },
].map((s) => Object.freeze(s)));

const LEVELS = ['low', 'medium', 'high'];

// Green and yellow only, never red: medium is the light yellow, high the full one.
export const LEVEL_TONE = Object.freeze({ low: 'ok-fast', medium: 'ok-mild', high: 'ok-slow' });

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// `{ id, kind?, level }` in display order, or null when nothing usable arrived.
// Any positive integer `version` is accepted; only the shape is checked.
export const normalizeScenarios = (raw) => {
    if (!isPlainObject(raw) || !Number.isInteger(raw.version) || raw.version < 1 || !Array.isArray(raw.items)) return null;
    const levelById = new Map();
    for (const item of raw.items) {
        if (!isPlainObject(item) || !LEVELS.includes(item.level) || levelById.has(item.id)) continue;
        levelById.set(item.id, item.level);
    }
    const out = SCENARIOS.filter((meta) => levelById.has(meta.id))
        .map((meta) => ({ ...meta, level: levelById.get(meta.id) }));
    return out.length ? out : null;
};

// An unknown level counts as low.
const levelOf = (s) => (LEVELS.includes(s?.level) ? s.level : 'low');

export const scenarioTone = (scenario) => LEVEL_TONE[levelOf(scenario)];

// Shared by the card dots and the details list: low, then medium, then high;
// display order kept within a level (stable sort).
const LEVEL_RANK = { low: 0, medium: 1, high: 2 };
export const sortByLevel = (scenarios = []) =>
    [...scenarios].sort((a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)]);

// Card dots: one tone per scenario, in `sortByLevel` order.
export const frictionDots = (scenarios = []) =>
    sortByLevel(scenarios).map((s) => ({ id: s.id, tone: scenarioTone(s) }));

// Locale key per API id where the two differ.
const NAME_KEYS = Object.freeze({ crossBorderSocial: 'localSocial' });

// Social-as-a-local names the card's country when there is one (`{country}` param).
export const scenarioNameKey = (scenario, countryName = '') => {
    const name = NAME_KEYS[scenario.id] ?? scenario.id;
    const withCountry = scenario.id === 'crossBorderSocial' && countryName;
    return `ipInfos.scenarioFriction.scenarios.${name}${withCountry ? 'In' : ''}`;
};

export const verdictKey = (scenario) =>
    `ipInfos.scenarioFriction.verdict.${scenario?.kind === 'availability' ? 'availability' : 'default'}.${levelOf(scenario)}`;

// Card breakdown: count per level (low = smooth, medium = checks, high = restricted).
export const frictionShares = (scenarios = []) => {
    const count = (level) => scenarios.filter((s) => levelOf(s) === level).length;
    return { total: scenarios.length, smooth: count('low'), checks: count('medium'), restricted: count('high') };
};
