// Scenario friction: puts the `extended.scenarios` list in display order and maps it
// onto tones and locale keys (`ipInfos.scenarioFriction.*`).

import { SCENARIO_FRICTION_IDS, SCENARIO_FRICTION_LEVELS } from '../codes/ip.js';

// Display order (ids and levels from utils/codes/ip.js); `kind` picks the verdict wording.
export const SCENARIOS = Object.freeze(SCENARIO_FRICTION_IDS
    .map((id) => Object.freeze(id === 'availability' ? { id, kind: 'availability' } : { id })));

const LEVELS = SCENARIO_FRICTION_LEVELS;

// Green and yellow only, never red: medium is the light yellow, high the full one.
export const LEVEL_TONE = Object.freeze({ low: 'ok-fast', medium: 'ok-mild', high: 'ok-slow' });

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// `[{ id, level }]` (validated with the block) → `{ id, kind?, level }` in
// display order, or null when none is a known scenario.
export const orderScenarios = (items) => {
    if (!Array.isArray(items)) return null;
    const levelById = new Map(items.filter(isPlainObject).map((item) => [item.id, item.level]));
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
