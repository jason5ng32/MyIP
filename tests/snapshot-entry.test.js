// Tests for frontend/utils/features/snapshot-entry.js — the tool path and
// label-card clamping for the Preferences picker.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SNAPSHOTS_TOOL_PATH, clampLabelCard } from '../frontend/utils/features/snapshot-entry.js';

describe('SNAPSHOTS_TOOL_PATH', () => {
    it('is the tool page', () => {
        assert.equal(SNAPSHOTS_TOOL_PATH, '/tools/snapshots');
    });
});

describe('clampLabelCard', () => {
    it('keeps a position within the cards shown', () => {
        assert.equal(clampLabelCard(1, 4), 1);
        assert.equal(clampLabelCard(3, 4), 3);
        assert.equal(clampLabelCard(4, 4), 4);
    });

    it('falls back to card 1 when out of range or invalid', () => {
        for (const bad of [0, -2, 5, 2.5, '2', null, undefined, NaN, [2]]) {
            assert.equal(clampLabelCard(bad, 4), 1, String(bad));
        }
    });

    it('is card 1 without a usable card count', () => {
        for (const count of [0, -1, undefined, 2.5, '4']) {
            assert.equal(clampLabelCard(2, count), 1, String(count));
        }
        assert.equal(clampLabelCard(1, 0), 1);
    });
});
