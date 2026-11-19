// Shared helpers that turn a geo source's upstream answer into its `extended` block.

import { METRIC_TEXT_LENGTH, isValidExtended } from '../common/ip-extended.js';

// A trimmed string, or undefined for an empty or placeholder one.
export const cleanText = (value, placeholders = []) => {
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text && !placeholders.includes(text) ? text : undefined;
};

// True when any boolean among `values` is true, false when some are and none is, undefined when none is boolean.
export const anyOf = (...values) => {
    const known = values.filter((value) => typeof value === 'boolean');
    return known.length > 0 ? known.includes(true) : undefined;
};

// A yes / no as the code a source without kinds or frequencies reports: 'detected' or 'none'.
export const detectedCode = (answer) => {
    if (answer === true) return 'detected';
    if (answer === false) return 'none';
    return undefined;
};

// One `metrics` member: a finite number within [0, max], or a short text as the source words it.
export const buildMetric = (id, value, { max, placeholders = [] } = {}) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value < 0 || (max !== undefined && value > max)) return undefined;
        return max === undefined ? { id, value } : { id, value, max };
    }
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    if (!text || placeholders.includes(text) || text.length > METRIC_TEXT_LENGTH) return undefined;
    return { id, value: text };
};

// Keeps the defined metrics; undefined when none is left.
const pickMetrics = (metrics) => {
    const kept = (metrics || []).filter((metric) => metric !== undefined);
    return kept.length > 0 ? kept : undefined;
};

// Assembles an `extended` block from its parts; undefined when empty or not valid.
export const buildExtended = ({ lineType, anonymityCode, abuse, metrics } = {}) => {
    const parts = {
        lineType,
        anonymity: anonymityCode === undefined ? undefined : { code: anonymityCode },
        abuse,
        metrics: pickMetrics(metrics),
    };
    const block = Object.fromEntries(Object.entries(parts).filter(([, value]) => value !== undefined));
    if (Object.keys(block).length === 0) return undefined;
    return isValidExtended(block) ? block : undefined;
};
