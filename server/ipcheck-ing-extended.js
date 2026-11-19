// Turns an IPCheck.ing API `/ipinfo` answer into the generic `extended` block (common/ip-extended.js).

import { ABUSE_LEVELS, SCENARIO_FRICTION_IDS, SCENARIO_FRICTION_LEVELS } from '../common/codes/ip.js';
import {
    LINE_TYPE_UNKNOWN, SCORE_UNKNOWN, EXTENDED_FLAGS, SCORE_DIMENSION_KEYS,
} from '../common/ip-extended.js';

// Upstream value that replaces the advanced fields → the gate it stands for.
const GATE_BY_VALUE = new Map([
    ['sign_in_required', 'auth'],
    ['quota_exceeded', 'quota'],
    ['cooldown', 'cooldown'],
]);

const LINE_TYPES = { Business: 'business', Residential: 'residential', Wireless: 'wireless', Hosting: 'hosting' };

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// The gate of the first advanced field holding a gate value, or null.
const gateOf = (advanced) => {
    for (const value of Object.values(advanced)) {
        if (GATE_BY_VALUE.has(value)) return GATE_BY_VALUE.get(value);
    }
    return null;
};

// Tor and iCloud Private Relay first, then the public anonymity class, a
// definite verdict only when several independent sources agree ('multi'). A
// residential proxy only the sighting history reports stays suspected.
export const anonymityCodeOf = (tags, dimensions) => {
    const anonymity = isPlainObject(dimensions) ? dimensions.anonymity : null;
    const cls = isPlainObject(anonymity) ? anonymity.class : null;
    const multi = isPlainObject(anonymity) && anonymity.sources === 'multi';
    if (tags.isTor) return 'tor';
    if (tags.isRelay) return 'relay';
    if (tags.isAnyAnonymizer && cls === 'residential_proxy') return 'residential';
    if (cls === 'proxy') return multi ? 'proxy' : 'proxy_suspected';
    if (cls === 'vpn') return multi ? 'vpn' : 'vpn_suspected';
    if (tags.isResidentialProxy) return 'suspected_residential';
    return 'none';
};

// IP_TYPE_CODES for the four known operator types, LINE_TYPE_UNKNOWN for anything else.
export const lineTypeOf = (operatorType) =>
    (Object.hasOwn(LINE_TYPES, operatorType) ? LINE_TYPES[operatorType] : LINE_TYPE_UNKNOWN);

// `{ version, items }` → `[{ id, level }]` of known ids and levels, first
// occurrence of an id kept; null when nothing usable arrived.
export const scenariosOf = (raw) => {
    if (!isPlainObject(raw) || !Number.isInteger(raw.version) || raw.version < 1 || !Array.isArray(raw.items)) return null;
    const seen = new Set();
    const out = [];
    for (const item of raw.items) {
        if (!isPlainObject(item) || !SCENARIO_FRICTION_LEVELS.includes(item.level) || seen.has(item.id)) continue;
        seen.add(item.id);
        if (SCENARIO_FRICTION_IDS.includes(item.id)) out.push({ id: item.id, level: item.level });
    }
    return out.length ? out : null;
};

const scoreOf = (score) => {
    if (score === SCORE_UNKNOWN) return SCORE_UNKNOWN;
    return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100 ? score : undefined;
};

// The boolean tags of the flag vocabulary; null when none.
export const flagsOf = (tags) => {
    const flags = Object.fromEntries(EXTENDED_FLAGS
        .filter((key) => typeof tags[key] === 'boolean')
        .map((key) => [key, tags[key]]));
    return Object.keys(flags).length ? flags : null;
};

// The known dimensions with their known string members; null when not an object.
export const dimensionsOf = (dimensions) => {
    if (!isPlainObject(dimensions)) return null;
    const out = {};
    for (const [name, keys] of Object.entries(SCORE_DIMENSION_KEYS)) {
        const member = dimensions[name];
        if (!isPlainObject(member)) continue;
        out[name] = Object.fromEntries(keys
            .filter((key) => typeof member[key] === 'string')
            .map((key) => [key, member[key]]));
    }
    return out;
};

const nameOf = (value) => (typeof value === 'string' && value ? value : undefined);

// Drops undefined members so absent fields stay absent.
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

// The `extended` block of an answer, or null when it has no usable advanced data.
export const toExtended = (answer) => {
    const advanced = isPlainObject(answer) ? answer.advancedData : null;
    if (!isPlainObject(advanced)) return null;

    const gate = gateOf(advanced);
    if (gate) return { gate };

    const { tags, dimensions } = advanced;
    if (!isPlainObject(tags)) return null;

    const reputation = isPlainObject(dimensions) ? dimensions.reputation : null;
    const abuse = isPlainObject(reputation) && ABUSE_LEVELS.includes(reputation.level) ? reputation.level : undefined;
    const scoreDimensions = dimensionsOf(dimensions);

    return compact({
        anonymity: compact({
            code: anonymityCodeOf(tags, dimensions),
            provider: nameOf(advanced.anonymityProvider),
            protocol: nameOf(advanced.anonymityProtocol),
        }),
        lineType: lineTypeOf(advanced.operatorType),
        native: typeof tags.isNative === 'boolean' ? tags.isNative : undefined,
        score: scoreOf(advanced.score),
        abuse,
        scenarios: scenariosOf(advanced.scenarios) ?? undefined,
        scoreDetails: scoreDimensions ? { dimensions: scoreDimensions } : undefined,
        flags: flagsOf(tags) ?? undefined,
    });
};
