// The `extended` block a geo source may add to its answer: field list, gate values and validator.

import {
    ANONYMITY_CODES, IP_TYPE_CODES, ABUSE_LEVELS, SCENARIO_FRICTION_IDS, SCENARIO_FRICTION_LEVELS,
} from './codes/ip.js';

// Every field the block may carry; each one is optional.
export const EXTENDED_FIELDS = Object.freeze([
    'gate', 'anonymity', 'lineType', 'native', 'score', 'abuse', 'scenarios', 'scoreDetails',
]);

// Why the fields are withheld: sign-in needed, quota used up, or paused for a while.
export const EXTENDED_GATES = Object.freeze(['auth', 'quota', 'cooldown']);

// A line type outside IP_TYPE_CODES.
export const LINE_TYPE_UNKNOWN = 'unknown';

// A score the source could not compute.
export const SCORE_UNKNOWN = 'unknown';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isName = (value) => typeof value === 'string' && value.length > 0;
const onlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key));

const isAnonymity = (value) => isPlainObject(value) && onlyKeys(value, ['code', 'provider', 'protocol'])
    && ANONYMITY_CODES.includes(value.code)
    && (value.provider === undefined || isName(value.provider))
    && (value.protocol === undefined || isName(value.protocol));

const isScore = (value) => value === SCORE_UNKNOWN
    || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);

const isScenarios = (value) => Array.isArray(value) && value.length > 0
    && value.every((item) => isPlainObject(item) && onlyKeys(item, ['id', 'level'])
        && SCENARIO_FRICTION_IDS.includes(item.id) && SCENARIO_FRICTION_LEVELS.includes(item.level))
    && new Set(value.map((item) => item.id)).size === value.length;

const isScoreDetails = (value) => isPlainObject(value) && onlyKeys(value, ['tags', 'dimensions'])
    && (value.tags === undefined || isPlainObject(value.tags))
    && (value.dimensions === undefined || isPlainObject(value.dimensions));

const FIELD_CHECKS = {
    anonymity: isAnonymity,
    lineType: (value) => IP_TYPE_CODES.includes(value) || value === LINE_TYPE_UNKNOWN,
    native: (value) => typeof value === 'boolean',
    score: isScore,
    abuse: (value) => ABUSE_LEVELS.includes(value),
    scenarios: isScenarios,
    scoreDetails: isScoreDetails,
};

// True when `value` matches the contract: known fields only, each well-formed,
// and a gated block carries nothing but its gate.
export const isValidExtended = (value) => {
    if (!isPlainObject(value) || !onlyKeys(value, EXTENDED_FIELDS)) return false;
    if ('gate' in value) return EXTENDED_GATES.includes(value.gate) && Object.keys(value).length === 1;
    return Object.entries(value).every(([key, field]) => FIELD_CHECKS[key](field));
};
