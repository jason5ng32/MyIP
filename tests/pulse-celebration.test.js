// Tests for frontend/utils/pulse-celebration.js: effect resolution against
// the real status vocabulary, and the pure particle physics — spawn counts
// stay within budget, every recipe self-terminates, shells explode into
// sparks, delays hold particles back, and the engine-wide cap is enforced.
// playCelebration (canvas/rAF) is browser-only and out of scope here.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    EFFECT_KINDS,
    POP_COUNT,
    FALL_COUNT,
    SHELL_COUNT,
    SPARKS_PER_SHELL,
    MAX_PARTICLES,
    resolveEffect,
    createParticles,
    stepParticles,
} from '../frontend/utils/pulse-celebration.js';
import { PRESET_STATUSES, FESTIVAL_STATUSES } from '../frontend/data/pulse-statuses.js';

// Deterministic LCG so physics runs are reproducible.
const makeRng = (seed = 42) => {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
};

const BOUNDS = { width: 500, height: 800 };
const ORIGIN = { x: 250, y: 120 };

// Runs the simulation at 60fps until empty or maxSeconds; returns the peak
// alive count and the seconds it took to drain.
const simulate = (particles, rng, maxSeconds = 15) => {
    let peak = particles.length;
    let t = 0;
    while (particles.length > 0 && t < maxSeconds) {
        particles = stepParticles(particles, 1 / 60, BOUNDS, rng);
        peak = Math.max(peak, particles.length);
        t += 1 / 60;
    }
    return { peak, seconds: t, leftover: particles.length };
};

describe('resolveEffect', () => {
    it('preset statuses default to pop with their own emoji', () => {
        for (const s of PRESET_STATUSES) {
            assert.deepEqual(resolveEffect(s), { kind: 'pop', emoji: s.emoji });
        }
    });

    it('every festival resolves to a known kind', () => {
        for (const f of FESTIVAL_STATUSES) {
            const { kind, emoji } = resolveEffect(f);
            assert.ok(EFFECT_KINDS.includes(kind), `${f.id} → unknown kind ${kind}`);
            assert.ok(emoji.length > 0, `${f.id} → empty emoji`);
        }
    });

    it('honors the data mapping: fireworks, fall, and sprite overrides', () => {
        const byId = Object.fromEntries(FESTIVAL_STATUSES.map((f) => [f.id, f]));
        assert.equal(resolveEffect(byId.newyear).kind, 'fireworks');
        assert.equal(resolveEffect(byId.christmas).kind, 'fall');
        assert.equal(resolveEffect(byId.christmas).emoji, '❄️'); // snows, not trees
        assert.equal(resolveEffect(byId.valentine).emoji, '💘'); // own emoji falls
        assert.equal(resolveEffect(byId.prgday).kind, 'pop');    // no effect field
    });

    it('falls back to pop on a missing status', () => {
        assert.equal(resolveEffect(null).kind, 'pop');
        assert.equal(resolveEffect(undefined).kind, 'pop');
    });
});

describe('particle physics', () => {
    it('pop spawns its emoji budget at the origin', () => {
        const parts = createParticles('pop', BOUNDS, ORIGIN, makeRng());
        assert.equal(parts.length, POP_COUNT);
        for (const p of parts) {
            assert.equal(p.x, ORIGIN.x);
            assert.equal(p.y, ORIGIN.y);
        }
    });

    it('pop dies out within two seconds', () => {
        const rng = makeRng();
        const { seconds, leftover } = simulate(createParticles('pop', BOUNDS, ORIGIN, rng), rng);
        assert.equal(leftover, 0);
        assert.ok(seconds < 2, `pop still alive after ${seconds.toFixed(1)}s`);
    });

    it('fall spawns its budget and drains within its ttl window', () => {
        const rng = makeRng();
        const parts = createParticles('fall', BOUNDS, ORIGIN, rng);
        assert.equal(parts.length, FALL_COUNT);
        const { seconds, leftover } = simulate(parts, rng);
        assert.equal(leftover, 0);
        // Worst case: max delay 1.8s + max ttl 6.5s.
        assert.ok(seconds < 9, `fall still alive after ${seconds.toFixed(1)}s`);
    });

    it('fireworks shells explode into sparks, then everything dies', () => {
        const rng = makeRng();
        const parts = createParticles('fireworks', BOUNDS, ORIGIN, rng);
        assert.equal(parts.length, SHELL_COUNT);
        const { peak, seconds, leftover } = simulate(parts, rng);
        assert.ok(peak > SHELL_COUNT, 'no shell ever exploded');
        assert.ok(peak <= SHELL_COUNT * SPARKS_PER_SHELL + SHELL_COUNT, 'spark burst overshot');
        assert.equal(leftover, 0);
        // Worst case: last shell delay ~2.55s + fuse 0.75s + spark ttl 1.4s.
        assert.ok(seconds < 5.5, `fireworks still alive after ${seconds.toFixed(1)}s`);
    });

    it('no recipe ever exceeds the engine-wide particle cap', () => {
        for (const kind of EFFECT_KINDS) {
            const rng = makeRng(7);
            const { peak } = simulate(createParticles(kind, BOUNDS, ORIGIN, rng), rng);
            assert.ok(peak <= MAX_PARTICLES, `${kind} peaked at ${peak}`);
        }
    });

    it('a delayed particle holds position until its delay elapses', () => {
        const rng = makeRng();
        const parts = createParticles('fall', BOUNDS, ORIGIN, rng);
        const delayed = parts.filter((p) => p.delay > 0.5);
        assert.ok(delayed.length > 0, 'expected some staggered flakes');
        const before = delayed.map((p) => ({ y: p.y, age: p.age }));
        stepParticles(parts, 1 / 60, BOUNDS, rng);
        delayed.forEach((p, i) => {
            assert.equal(p.y, before[i].y, 'delayed flake moved');
            assert.equal(p.age, before[i].age, 'delayed flake aged');
        });
    });

    it('stepParticles enforces the cap even on an oversized input', () => {
        const rng = makeRng();
        const flood = [];
        for (let i = 0; i < MAX_PARTICLES + 80; i += 1) {
            flood.push({ type: 'pop', x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 20, age: 0, ttl: 5 });
        }
        const next = stepParticles(flood, 1 / 60, BOUNDS, rng);
        assert.equal(next.length, MAX_PARTICLES);
    });
});
