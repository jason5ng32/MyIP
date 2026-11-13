// Unit tests for the universal WAAPI `<EmojiMotion>` engine (`utils/emoji-motion.js`)
// and preset references in `data/tools.js`. Guards keyframe invariants and typo
// safety while allowing future tools to omit or freely reuse presets.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ADVANCED_TOOLS } from '../frontend/data/tools.js';
import {
    DEFAULT_EMOJI_MOTION,
    EMOJI_FX,
    EMOJI_MOTIONS,
    EMOJI_TONES,
    MOTION_DURATION_MS,
    playEmojiMotion,
    resolveEmojiMotion,
    shouldPlayOnFocusIn,
} from '../frontend/utils/emoji-motion.js';

const makeWin = ({ reducedMotion = false } = {}) => ({
    matchMedia: (query) => ({
        matches: reducedMotion && query.includes('prefers-reduced-motion'),
    }),
});

const assertValidWaapiKeyframes = (keyframes, label) => {
    assert.ok(Array.isArray(keyframes) && keyframes.length >= 2, `${label}: expected >=2 keyframes`);
    assert.equal(keyframes[0].offset, 0, `${label}: first keyframe must start at offset 0`);
    assert.equal(keyframes.at(-1).offset, 1, `${label}: last keyframe must end at offset 1`);

    let prev = -1;
    for (const frame of keyframes) {
        assert.equal(typeof frame.offset, 'number', `${label}: numeric offset required`);
        assert.ok(frame.offset > prev, `${label}: offsets must strictly ascend (${prev} -> ${frame.offset})`);
        assert.ok(
            'transform' in frame || 'opacity' in frame,
            `${label}: keyframes must animate compositor properties (transform / opacity)`,
        );
        prev = frame.offset;
    }
};

const makeAnimatableEl = () => {
    const calls = [];
    return {
        style: {},
        calls,
        animate(keyframes, options) {
            let resolveFinished;
            let rejectFinished;
            const finished = new Promise((resolve, reject) => {
                resolveFinished = resolve;
                rejectFinished = reject;
            });
            const anim = {
                keyframes,
                options,
                cancelled: false,
                finished,
                finish: () => resolveFinished(anim),
                cancel() {
                    if (this.cancelled) return;
                    this.cancelled = true;
                    rejectFinished(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                },
            };
            calls.push(anim);
            return anim;
        },
    };
};

describe('EMOJI_MOTIONS & EMOJI_FX catalog', () => {
    it('defines the 9 core motions and 4 micro-effects with valid WAAPI keyframe tracks', () => {
        assert.deepEqual(
            Object.keys(EMOJI_MOTIONS).sort(),
            ['dash', 'flip', 'peek', 'pop', 'ring', 'slam', 'spin', 'swing', 'toss'],
        );
        assert.deepEqual(
            Object.keys(EMOJI_FX).sort(),
            ['ripple', 'scan', 'spark', 'streaks'],
        );

        for (const [name, buildMotion] of Object.entries(EMOJI_MOTIONS)) {
            const spec = buildMotion({ angle: -45 });
            assertValidWaapiKeyframes(spec.keyframes, `motion:${name}`);
        }

        for (const [name, buildFx] of Object.entries(EMOJI_FX)) {
            const actors = buildFx({ color: EMOJI_TONES.info, angle: 180 });
            assert.ok(actors.length >= 1, `fx:${name} produces >=1 SVG actor`);
            actors.forEach((actor, idx) => {
                assert.ok(actor.svg?.tag, `fx:${name}[${idx}] defines an SVG tag`);
                assertValidWaapiKeyframes(actor.keyframes, `fx:${name}[${idx}]`);
            });
        }
    });

    it('orients dash and streaks along the requested angle and falls back cleanly when omitted', () => {
        const upRight = resolveEmojiMotion({ motion: 'dash', angle: -45, fx: 'streaks' });
        assert.match(upRight.motion.keyframes[2].transform, /translate3d\(0\.622em, -0\.622em, 0\)/);
        assert.equal(upRight.actors.length, 2);

        const leftward = resolveEmojiMotion({ motion: 'dash', angle: 180 });
        assert.match(leftward.motion.keyframes[2].transform, /translate3d\(-0\.88em, 0em, 0\)/);
        assert.deepEqual(leftward.actors, []);

        // Bare call or unknown preset names fall back to pure `pop` without throwing
        const fallback = resolveEmojiMotion({ motion: 'nonexistent', fx: 'nonexistent', tone: 'nonexistent' });
        assert.equal(fallback.motionName, DEFAULT_EMOJI_MOTION);
        assert.equal(fallback.fxName, null);
        assert.deepEqual(fallback.actors, []);
    });

    it('validates optional motion / fx / tone fields on ADVANCED_TOOLS without forcing every tool to set them', () => {
        for (const tool of ADVANCED_TOOLS) {
            if (tool.motion !== undefined) {
                assert.ok(tool.motion in EMOJI_MOTIONS, `${tool.slug}: unknown motion "${tool.motion}"`);
            }
            if (tool.fx !== undefined) {
                assert.ok(tool.fx in EMOJI_FX, `${tool.slug}: unknown fx "${tool.fx}"`);
            }
            if (tool.tone !== undefined) {
                assert.ok(tool.tone in EMOJI_TONES, `${tool.slug}: unknown tone "${tool.tone}"`);
            }
            const spec = resolveEmojiMotion(tool);
            assert.ok(spec.motion.keyframes.length >= 2);
        }
    });
});

describe('playEmojiMotion (WAAPI runner)', () => {
    it('drives glyph and SVG actors, applies custom pivot, and absorbs AbortError on cancel', async () => {
        const emojiEl = makeAnimatableEl();
        const actorEls = [makeAnimatableEl(), makeAnimatableEl()];

        const swingRipple = resolveEmojiMotion({ motion: 'swing', fx: 'ripple', tone: 'success' });
        const run1 = playEmojiMotion({
            emojiEl,
            actorEls,
            spec: swingRipple,
            win: makeWin(),
        });

        assert.equal(emojiEl.style.transformOrigin, '50% 88%');
        assert.equal(run1.animations.length, 3);
        assert.equal(emojiEl.calls[0].options.duration, MOTION_DURATION_MS);

        run1.cancel();
        await assert.doesNotReject(() => run1.finished);
        assert.ok(run1.animations.every((a) => a.cancelled));

        // Pure heading motion (no fx) resets transformOrigin when motion has no custom pivot
        const purePop = resolveEmojiMotion({ motion: 'pop' });
        const run2 = playEmojiMotion({
            emojiEl,
            spec: purePop,
            win: makeWin(),
        });
        assert.equal(emojiEl.style.transformOrigin, '');
        assert.equal(run2.animations.length, 1);
        run2.animations[0].finish();
        await run2.finished;
    });

    it('skips WAAPI calls under prefers-reduced-motion', async () => {
        const emojiEl = makeAnimatableEl();
        const playback = playEmojiMotion({
            emojiEl,
            spec: resolveEmojiMotion({ motion: 'slam', fx: 'ripple' }),
            win: makeWin({ reducedMotion: true }),
        });

        assert.equal(playback.animations.length, 0);
        assert.equal(emojiEl.calls.length, 0);
        await playback.finished;
    });
});

describe('shouldPlayOnFocusIn (Tab keyboard focus trigger)', () => {
    it('triggers on external :focus-visible entry, skipping pointer clicks and internal focus moves', () => {
        const insideLink = { matches: (sel) => sel === ':focus-visible' };
        const clickedLink = { matches: () => false };
        const siblingControl = {};
        const outsideLink = {};
        const cardEl = {
            contains: (node) => node === insideLink || node === clickedLink || node === siblingControl,
        };

        // Tabbing into the card's <a> from outside plays the animation
        assert.equal(
            shouldPlayOnFocusIn({ target: insideLink, relatedTarget: outsideLink }, cardEl),
            true,
        );
        assert.equal(
            shouldPlayOnFocusIn({ target: insideLink, relatedTarget: null }, cardEl),
            true,
        );

        // Mouse click / touch tap focus (:focus-visible is false) does not re-trigger
        assert.equal(
            shouldPlayOnFocusIn({ target: clickedLink, relatedTarget: null }, cardEl),
            false,
        );

        // Focus moving between two elements inside the same trigger container is ignored
        assert.equal(
            shouldPlayOnFocusIn({ target: insideLink, relatedTarget: siblingControl }, cardEl),
            false,
        );
    });
});
