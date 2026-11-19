// Tests for server/source-extended.js — building an `extended` block from an upstream answer.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { METRIC_TEXT_LENGTH } from '../common/ip-extended.js';
import {
    anyOf, buildExtended, buildMetric, cleanText, detectedCode,
} from '../server/source-extended.js';

describe('cleanText', () => {
    it('trims strings and drops empty and placeholder ones', () => {
        assert.equal(cleanText('  Example Net  '), 'Example Net');
        assert.equal(cleanText(''), undefined);
        assert.equal(cleanText('   '), undefined);
        assert.equal(cleanText('-', ['-']), undefined);
        assert.equal(cleanText(' - ', ['-']), undefined);
        assert.equal(cleanText('-'), '-');
    });

    it('ignores non-strings', () => {
        for (const value of [5, true, null, undefined, {}, []]) assert.equal(cleanText(value), undefined);
    });
});

describe('anyOf / detectedCode', () => {
    it('answers yes when any boolean is true, no when all booleans are false, undefined without one', () => {
        assert.equal(anyOf(false, true, undefined), true);
        assert.equal(anyOf(false, null, 'yes', false), false);
        assert.equal(anyOf(undefined, null, 'true', 1), undefined);
        assert.equal(anyOf(), undefined);
    });

    it('turns the yes / no into a code', () => {
        assert.equal(detectedCode(true), 'detected');
        assert.equal(detectedCode(false), 'none');
        assert.equal(detectedCode(undefined), undefined);
        assert.equal(detectedCode('true'), undefined);
    });
});

describe('buildMetric', () => {
    it('keeps a finite number within [0, max] with its max', () => {
        assert.deepEqual(buildMetric('fraudScore', 0, { max: 100 }), { id: 'fraudScore', value: 0, max: 100 });
        assert.deepEqual(buildMetric('fraudScore', 100, { max: 100 }), { id: 'fraudScore', value: 100, max: 100 });
        assert.deepEqual(buildMetric('fraudScore', 7), { id: 'fraudScore', value: 7 });
    });

    it('drops a number out of range or not finite', () => {
        for (const value of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
            assert.equal(buildMetric('fraudScore', value, { max: 100 }), undefined, String(value));
        }
    });

    it('keeps a trimmed text as worded, without a max', () => {
        assert.deepEqual(buildMetric('abuserScore', ' 0.002 (Low) ', { max: 100 }), { id: 'abuserScore', value: '0.002 (Low)' });
        assert.equal(buildMetric('abuserScore', 'x'.repeat(METRIC_TEXT_LENGTH)).value.length, METRIC_TEXT_LENGTH);
    });

    it('drops empty, placeholder, over-long and non-scalar values', () => {
        for (const value of ['', '   ', 'x'.repeat(METRIC_TEXT_LENGTH + 1), null, undefined, true, {}, []]) {
            assert.equal(buildMetric('abuserScore', value), undefined, JSON.stringify(value));
        }
        assert.equal(buildMetric('abuserScore', '-', { placeholders: ['-'] }), undefined);
    });
});

describe('buildExtended', () => {
    it('assembles the given parts in a fixed order', () => {
        const metric = { id: 'fraudScore', value: 3, max: 100 };
        assert.deepEqual(buildExtended({
            metrics: [metric], abuse: 'none', anonymityCode: 'detected', lineType: 'residential',
        }), {
            lineType: 'residential', anonymity: { code: 'detected' }, abuse: 'none', metrics: [metric],
        });
    });

    it('drops undefined metrics, an empty list and an absent code', () => {
        const metric = { id: 'fraudScore', value: 3, max: 100 };
        assert.deepEqual(buildExtended({ abuse: 'detected', metrics: [undefined, metric] }), {
            abuse: 'detected', metrics: [metric],
        });
        assert.deepEqual(buildExtended({ abuse: 'none', metrics: [], anonymityCode: undefined }), { abuse: 'none' });
        assert.equal(buildExtended({ metrics: [undefined] }), undefined);
    });

    it('returns undefined when every part is empty', () => {
        assert.equal(buildExtended(), undefined);
        assert.equal(buildExtended({ lineType: undefined, anonymityCode: undefined }), undefined);
    });

    it('fails soft on a malformed block', () => {
        assert.equal(buildExtended({ lineType: 'satellite' }), undefined);
        assert.equal(buildExtended({ abuse: 'severe' }), undefined);
        assert.equal(buildExtended({ anonymityCode: 'masked' }), undefined);
        assert.equal(buildExtended({ metrics: [{ id: 'nope', value: 1 }] }), undefined);
    });
});
