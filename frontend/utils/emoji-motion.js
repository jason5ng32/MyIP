// Finite, composable Web Animations API (WAAPI) presets and runner for
// `<EmojiMotion>` (`components/widgets/EmojiMotion.vue`).
//
// Defines 9 universal glyph motions (`EMOJI_MOTIONS`) and 4 optional SVG
// micro-effects (`EMOJI_FX`), all expressed in relative `em` transforms so the
// same preset scales cleanly from inline text to cards and section headings.

export const MOTION_DURATION_MS = 700;
export const REPLAY_COOLDOWN_MS = 260;
export const DEFAULT_EMOJI_MOTION = 'pop';

export const EMOJI_TONES = Object.freeze({
    info: 'var(--info)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    destructive: 'var(--destructive)',
    muted: 'var(--muted-foreground)',
});

const EASE_OUT_EXPO = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_RING_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

const round = (n) => Math.round(n * 1000) / 1000;

const unitVector = (angleDeg = 0) => {
    const rad = (Number(angleDeg || 0) * Math.PI) / 180;
    return { ux: round(Math.cos(rad)), uy: round(Math.sin(rad)) };
};

// --- 9 Core Glyph Motions ----------------------------------------------------

export const EMOJI_MOTIONS = Object.freeze({
    // Crisp gather & spring rebound (default fallback)
    pop: () => ({
        easing: EASE_OUT_EXPO,
        keyframes: [
            { offset: 0, transform: 'translate3d(0, 0, 0) scale(1, 1)' },
            { offset: 0.22, transform: 'translate3d(0, 0.08em, 0) scale(1.16, 0.84)' },
            { offset: 0.5, transform: 'translate3d(0, -0.34em, 0) scale(0.94, 1.1)' },
            { offset: 0.74, transform: 'translate3d(0, 0.03em, 0) scale(1.04, 0.97)' },
            { offset: 1, transform: 'translate3d(0, 0, 0) scale(1, 1)' },
        ],
    }),

    // Lift & high-frequency bell / pager shake
    ring: () => ({
        easing: 'ease-out',
        keyframes: [
            { offset: 0, transform: 'translate3d(0, 0, 0) rotate(0deg)' },
            { offset: 0.14, transform: 'translate3d(-0.08em, -0.28em, 0) rotate(-16deg)' },
            { offset: 0.28, transform: 'translate3d(0.08em, -0.34em, 0) rotate(16deg)' },
            { offset: 0.42, transform: 'translate3d(-0.08em, -0.32em, 0) rotate(-13deg)' },
            { offset: 0.56, transform: 'translate3d(0.06em, -0.24em, 0) rotate(10deg)' },
            { offset: 0.74, transform: 'translate3d(-0.03em, -0.06em, 0) rotate(-4deg)' },
            { offset: 1, transform: 'translate3d(0, 0, 0) rotate(0deg)' },
        ],
    }),

    // Bottom-pivoted pendulum swing
    swing: () => ({
        origin: '50% 88%',
        easing: EASE_OUT_EXPO,
        keyframes: [
            { offset: 0, transform: 'rotate(0deg)' },
            { offset: 0.22, transform: 'rotate(-24deg)' },
            { offset: 0.48, transform: 'rotate(22deg)' },
            { offset: 0.7, transform: 'rotate(-10deg)' },
            { offset: 0.86, transform: 'rotate(4deg)' },
            { offset: 1, transform: 'rotate(0deg)' },
        ],
    }),

    // Wind-up & directional sprint (`angle`: 0 = right, 180 = left, -45 = up-right)
    dash: ({ angle = 0 } = {}) => {
        const { ux, uy } = unitVector(angle);
        return {
            easing: EASE_OUT_EXPO,
            keyframes: [
                { offset: 0, transform: 'translate3d(0, 0, 0) scale(1)' },
                { offset: 0.18, transform: `translate3d(${round(-ux * 0.18)}em, ${round(-uy * 0.18)}em, 0) scale(0.92)` },
                { offset: 0.52, transform: `translate3d(${round(ux * 0.88)}em, ${round(uy * 0.88)}em, 0) scale(1.08)` },
                { offset: 0.82, transform: `translate3d(${round(-ux * 0.06)}em, ${round(-uy * 0.06)}em, 0) scale(0.98)` },
                { offset: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
            ],
        };
    },

    // High lift, gravity drop & impact squash-stretch
    slam: () => ({
        easing: 'linear',
        keyframes: [
            { offset: 0, transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1, 1)', easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' },
            { offset: 0.3, transform: 'translate3d(0, -0.78em, 0) rotate(-8deg) scale(1.12, 1.12)', easing: 'cubic-bezier(0.65, 0, 0.9, 0.4)' },
            { offset: 0.46, transform: 'translate3d(0, 0.08em, 0) rotate(0deg) scale(1.2, 0.8)', easing: 'ease-out' },
            { offset: 0.66, transform: 'translate3d(0, -0.1em, 0) rotate(2deg) scale(0.95, 1.06)', easing: 'ease-out' },
            { offset: 1, transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1, 1)' },
        ],
    }),

    // Crouch, 360° high-arc toss & soft landing
    toss: () => ({
        easing: 'linear',
        keyframes: [
            { offset: 0, transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1, 1)', easing: 'cubic-bezier(0.3, 0, 0.7, 1)' },
            { offset: 0.12, transform: 'translate3d(0, 0.1em, 0) rotate(-14deg) scale(1.14, 0.86)', easing: 'cubic-bezier(0.2, 0.75, 0.35, 1)' },
            { offset: 0.5, transform: 'translate3d(0, -0.88em, 0) rotate(195deg) scale(1.18, 1.18)', easing: 'cubic-bezier(0.55, 0, 0.85, 0.38)' },
            { offset: 0.8, transform: 'translate3d(0, 0.06em, 0) rotate(360deg) scale(1.12, 0.88)', easing: 'ease-out' },
            { offset: 0.91, transform: 'translate3d(0, -0.07em, 0) rotate(362deg) scale(0.97, 1.03)', easing: 'ease-out' },
            { offset: 1, transform: 'translate3d(0, 0, 0) rotate(360deg) scale(1, 1)' },
        ],
    }),

    // 3D perspective flip around the vertical axis
    flip: () => ({
        easing: EASE_OUT_EXPO,
        keyframes: [
            { offset: 0, transform: 'perspective(10em) translate3d(0, 0, 0) rotateY(0deg) scale(1)' },
            { offset: 0.45, transform: 'perspective(10em) translate3d(0, -0.36em, 0) rotateY(180deg) scale(1.1)' },
            { offset: 0.82, transform: 'perspective(10em) translate3d(0, -0.08em, 0) rotateY(360deg) scale(1.02)' },
            { offset: 1, transform: 'perspective(10em) translate3d(0, 0, 0) rotateY(360deg) scale(1)' },
        ],
    }),

    // 720° whirlpool spin with breathing scale
    spin: () => ({
        easing: 'cubic-bezier(0.32, 0, 0.24, 1)',
        keyframes: [
            { offset: 0, transform: 'translate3d(0, 0, 0) rotate(0deg) scale(1)' },
            { offset: 0.3, transform: 'translate3d(0, -0.12em, 0) rotate(210deg) scale(0.8)' },
            { offset: 0.65, transform: 'translate3d(0, -0.28em, 0) rotate(540deg) scale(1.18)' },
            { offset: 1, transform: 'translate3d(0, 0, 0) rotate(720deg) scale(1)' },
        ],
    }),

    // Stealth cloak fade & sideways peek
    peek: () => ({
        easing: EASE_OUT_EXPO,
        keyframes: [
            { offset: 0, opacity: 1, transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)' },
            { offset: 0.18, opacity: 0.08, transform: 'translate3d(0, 0.08em, 0) scale(0.55) rotate(0deg)' },
            { offset: 0.38, opacity: 0.08, transform: 'translate3d(0, 0.08em, 0) scale(0.55) rotate(0deg)' },
            { offset: 0.6, opacity: 1, transform: 'translate3d(0.28em, -0.18em, 0) scale(1.1) rotate(14deg)' },
            { offset: 0.8, opacity: 1, transform: 'translate3d(-0.18em, -0.22em, 0) scale(1.05) rotate(-10deg)' },
            { offset: 1, opacity: 1, transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)' },
        ],
    }),
});

// --- 4 Optional Generic SVG Micro-Effects ------------------------------------

export const EMOJI_FX = Object.freeze({
    // Dual expanding concentric rings
    ripple: ({ color }) => [0, 130].map((delay) => ({
        svg: { tag: 'circle', attrs: { cx: 16, cy: 16, r: 9.5, stroke: color, 'stroke-width': 1.75 } },
        duration: 580,
        delay,
        easing: EASE_RING_OUT,
        keyframes: [
            { offset: 0, opacity: 0.88, transform: 'scale(0.55)' },
            { offset: 1, opacity: 0, transform: 'scale(1.85)' },
        ],
    })),

    // Trailing slipstream lines opposite the dash direction
    streaks: ({ color, angle = 0 }) => {
        const { ux, uy } = unitVector(angle);
        const rot = Number(angle || 0);
        return [
            { y: 12.5, x1: 9, x2: 22, delay: 60 },
            { y: 19.5, x1: 12, x2: 21, delay: 120 },
        ].map(({ y, x1, x2, delay }) => ({
            svg: {
                tag: 'line',
                attrs: { x1, y1: y, x2, y2: y, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' },
            },
            duration: 520,
            delay,
            easing: 'ease-out',
            keyframes: [
                { offset: 0, opacity: 0, transform: `translate3d(0, 0, 0) rotate(${rot}deg) scaleX(0.3)` },
                { offset: 0.32, opacity: 0.9, transform: `translate3d(${round(ux * 0.16)}em, ${round(uy * 0.16)}em, 0) rotate(${rot}deg) scaleX(1.2)` },
                { offset: 1, opacity: 0, transform: `translate3d(${round(-ux * 0.45)}em, ${round(-uy * 0.45)}em, 0) rotate(${rot}deg) scaleX(0.25)` },
            ],
        }));
    },

    // Radial trio of crisp bursting sparks
    spark: ({ color }) => [
        { dx: -0.58, dy: -0.56, delay: 70 },
        { dx: 0.56, dy: -0.58, delay: 120 },
        { dx: -0.62, dy: 0.22, delay: 170 },
    ].map(({ dx, dy, delay }) => ({
        front: true,
        svg: { tag: 'circle', attrs: { cx: 16, cy: 16, r: 2.3, fill: color } },
        duration: 500,
        delay,
        easing: EASE_OUT_EXPO,
        keyframes: [
            { offset: 0, opacity: 0, transform: 'translate3d(0, 0, 0) scale(0.4)' },
            { offset: 0.28, opacity: 1, transform: `translate3d(${round(dx * 0.45)}em, ${round(dy * 0.45)}em, 0) scale(1.15)` },
            { offset: 1, opacity: 0, transform: `translate3d(${dx}em, ${dy}em, 0) scale(0.3)` },
        ],
    })),

    // Sweeping horizontal laser scanline across the glyph
    scan: ({ color }) => [{
        front: true,
        svg: {
            tag: 'line',
            attrs: { x1: 6, y1: 8, x2: 26, y2: 8, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' },
        },
        duration: 620,
        delay: 40,
        easing: 'ease-in-out',
        keyframes: [
            { offset: 0, opacity: 0, transform: 'translate3d(0, 0, 0)' },
            { offset: 0.16, opacity: 0.95, transform: 'translate3d(0, 0.12em, 0)' },
            { offset: 0.54, opacity: 0.95, transform: 'translate3d(0, 0.72em, 0)' },
            { offset: 0.88, opacity: 0.8, transform: 'translate3d(0, 0.04em, 0)' },
            { offset: 1, opacity: 0, transform: 'translate3d(0, 0, 0)' },
        ],
    }],
});

// --- Spec Resolver & WAAPI Runner --------------------------------------------

export const prefersReducedMotion = (win = globalThis.window) =>
    Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

// Play on `focusin` only when focus enters `triggerEl` from outside via keyboard
// navigation (`:focus-visible`), ignoring mouse clicks, touch taps, and internal
// focus transfers within the same trigger container.
export const shouldPlayOnFocusIn = (event, triggerEl) => {
    if (!triggerEl || !event) return false;
    if (event.relatedTarget && triggerEl.contains?.(event.relatedTarget)) return false;
    const target = event.target;
    if (typeof target?.matches === 'function') {
        try {
            return target.matches(':focus-visible');
        } catch {
            return true;
        }
    }
    return true;
};

export const resolveEmojiMotion = ({
    motion = DEFAULT_EMOJI_MOTION,
    fx = '',
    tone = 'info',
    angle = 0,
} = {}) => {
    const motionName = motion in EMOJI_MOTIONS ? motion : DEFAULT_EMOJI_MOTION;
    const fxName = fx && fx in EMOJI_FX ? fx : null;
    const color = EMOJI_TONES[tone] ?? EMOJI_TONES.info;
    const params = { color, angle };

    return {
        motionName,
        fxName,
        motion: EMOJI_MOTIONS[motionName](params),
        actors: fxName ? EMOJI_FX[fxName](params) : [],
    };
};

export const playEmojiMotion = ({
    emojiEl,
    actorEls = [],
    spec,
    durationMs = MOTION_DURATION_MS,
    win = globalThis.window,
} = {}) => {
    if (!emojiEl || typeof emojiEl.animate !== 'function' || !spec?.motion || prefersReducedMotion(win)) {
        return {
            animations: [],
            cancel: () => {},
            finished: Promise.resolve(),
        };
    }

    if (emojiEl.style) {
        emojiEl.style.transformOrigin = spec.motion.origin ?? '';
    }

    const animations = [
        emojiEl.animate(spec.motion.keyframes, {
            duration: spec.motion.duration ?? durationMs,
            easing: spec.motion.easing ?? 'ease-out',
        }),
    ];

    const actors = spec.actors ?? [];
    for (let i = 0; i < actors.length; i += 1) {
        const actor = actors[i];
        const el = actorEls[i];
        if (!el || typeof el.animate !== 'function') continue;
        animations.push(
            el.animate(actor.keyframes, {
                duration: actor.duration ?? durationMs,
                delay: actor.delay ?? 0,
                easing: actor.easing ?? 'ease-out',
            }),
        );
    }

    const cancel = () => {
        for (const anim of animations) {
            try {
                anim.cancel();
            } catch {
                // Ignore already-settled or detached Animation instances.
            }
        }
    };

    // Absorb WAAPI's AbortError on `.cancel()` so replays never leak unhandled rejections.
    const finished = Promise.allSettled(
        animations.map((anim) => Promise.resolve(anim?.finished)),
    ).then(() => undefined);

    return { animations, cancel, finished };
};
