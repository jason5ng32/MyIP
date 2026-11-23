// Tests for frontend/utils/features/festival-garland.js: the footer garland
// covers any width with equal scallops, hang points sit at each low point,
// points along a scallop meet the cord, and trait cycles wrap.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GARLAND_DEFAULTS, cycle, garlandLayout, scallopPoint } from '../frontend/utils/features/festival-garland.js';

const { spacing, sag, top } = GARLAND_DEFAULTS;

describe('garlandLayout()', () => {
    it('covers the width with whole scallops', () => {
        assert.equal(garlandLayout(560).points.length, 10);
        assert.equal(garlandLayout(561).points.length, 11);
        assert.equal(garlandLayout(0).points.length, 1);
        const { points } = garlandLayout(1600);
        assert.ok(points.at(-1).x + spacing / 2 >= 1600);
    });

    it('hangs one point at each scallop\'s low point', () => {
        const { points, path } = garlandLayout(200);
        assert.deepEqual(points[0], { i: 0, x: spacing / 2, y: top + sag });
        assert.equal(points[2].x, spacing * 2.5);
        assert.ok(path.startsWith(`M0 ${top} Q`));
    });
});

describe('scallopPoint()', () => {
    it('meets the pegs at the ends and the low point mid-way, level there', () => {
        const start = scallopPoint(1, 0);
        assert.equal(start.x, spacing);
        assert.equal(start.y, top);
        const mid = scallopPoint(1, 0.5);
        assert.equal(mid.x, spacing * 1.5);
        assert.equal(mid.y, top + sag);
        assert.equal(mid.angle, 0);
        assert.ok(scallopPoint(1, 0.2).angle > 0);
        assert.ok(scallopPoint(1, 0.8).angle < 0);
    });
});

describe('cycle()', () => {
    it('wraps by index', () => {
        assert.deepEqual([0, 1, 2, 3, 4].map((i) => cycle(['a', 'b', 'c'], i)), ['a', 'b', 'c', 'a', 'b']);
    });
});
