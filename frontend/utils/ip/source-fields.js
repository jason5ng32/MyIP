// What an IP card draws about its answering source: the metric cells.

import { SOURCE_METRIC_IDS } from './ip-extended.js';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// The card's source metrics as drawn in the outer grid: known ids only, in the
// source's order; `ratio` marks a value out of `max`.
export const listSourceMetrics = (card) => (Array.isArray(card?.sourceMetrics) ? card.sourceMetrics : [])
    .filter((item) => isPlainObject(item) && SOURCE_METRIC_IDS.includes(item.id))
    .map(({ id, value, max }) => (max === undefined
        ? { id, text: String(value), ratio: false }
        : { id, text: `${value}/${max}`, ratio: true }));
