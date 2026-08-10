// Celebration particle engine for the Pulse ("Earth Online") Sheet.
// One canvas, one rAF loop, three recipes:
//   pop       — the clicked status's emoji bursts from the chip (default)
//   fall      — emoji drift down from the top (snow / hearts / pumpkins)
//   fireworks — shells rise from the bottom and burst into colored sparks
// Which statuses get which recipe lives in data/pulse-statuses.js
// (`effect` / `effectEmoji`); resolveEffect() maps a status to a recipe.
//
// Perf rules baked in: pre-rasterized emoji sprites drawn with drawImage
// (no per-frame fillText), no shadowBlur / per-particle gradients, hard
// particle caps, DPR capped at 2, the loop self-terminates with the last
// particle, and prefers-reduced-motion skips playback entirely.
//
// Split for testability: spawn/step are pure and rng-injected (Node tests
// in tests/pulse-celebration.test.js); only playCelebration touches the DOM.

export const EFFECT_KINDS = ['pop', 'fall', 'fireworks'];

// Per-recipe budgets. MAX_PARTICLES is the engine-wide safety net; the
// worst case (fireworks: sparks from all shells alive at once) stays under it.
export const POP_COUNT = 12;
export const FALL_COUNT = 48;
export const SHELL_COUNT = 7;
export const SPARKS_PER_SHELL = 36;
export const MAX_PARTICLES = 200;

const GRAVITY_POP = 900;
const GRAVITY_SPARK = 260;
const FIREWORK_HUES = [45, 0, 200, 280, 330]; // gold / red / cyan / violet / pink

// Status → recipe. Unknown/absent effect falls back to pop; the particle
// sprite is the status's own emoji unless the data overrides it
// (christmas 🎄 snows ❄️).
export const resolveEffect = (status) => {
    if (!status) return { kind: 'pop', emoji: '✨' };
    const kind = EFFECT_KINDS.includes(status.effect) ? status.effect : 'pop';
    return { kind, emoji: status.effectEmoji || status.emoji };
};

// ---------------------------------------------------------------- spawn ---

const spawnPop = (origin, rng) => {
    // A cone of emoji launched upward from the chip.
    const parts = [];
    for (let i = 0; i < POP_COUNT; i += 1) {
        const angle = -Math.PI / 2 + (rng() - 0.5) * Math.PI * 0.9;
        const speed = 220 + rng() * 200;
        parts.push({
            type: 'pop',
            x: origin.x,
            y: origin.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rot: (rng() - 0.5) * 0.6,
            vr: (rng() - 0.5) * 6,
            size: 18 + rng() * 8,
            age: 0,
            ttl: 0.75 + rng() * 0.35,
        });
    }
    return parts;
};

const spawnFall = (bounds, rng) => {
    // Staggered entries from above the top edge; sway is computed from age
    // so a flake's x never drifts unbounded. Flakes die below the bottom
    // edge or fade out at ttl, whichever comes first.
    const parts = [];
    for (let i = 0; i < FALL_COUNT; i += 1) {
        const size = 14 + rng() * 10;
        parts.push({
            type: 'fall',
            baseX: rng() * bounds.width,
            x: 0,
            y: -size,
            vy: 80 + rng() * 100,
            swayAmp: 12 + rng() * 24,
            swayFreq: 1 + rng() * 1.5,
            swayPhase: rng() * Math.PI * 2,
            rot: (rng() - 0.5) * 0.8,
            vr: (rng() - 0.5) * 1.6,
            size,
            delay: rng() * 1.8,
            age: 0,
            ttl: 5.5 + rng(),
        });
    }
    return parts;
};

const spawnSparks = (shell, rng) => {
    const parts = [];
    for (let i = 0; i < SPARKS_PER_SHELL; i += 1) {
        const angle = rng() * Math.PI * 2;
        const speed = 90 + rng() * 180;
        parts.push({
            type: 'spark',
            x: shell.x,
            y: shell.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            hue: shell.hue,
            size: 1.5 + rng() * 1.5,
            age: 0,
            ttl: 0.9 + rng() * 0.5,
        });
    }
    return parts;
};

const spawnFireworks = (bounds, rng) => {
    // Shells launch from just below the bottom edge and explode at their
    // fuse time (which is exactly the rise time to the target height).
    const parts = [];
    for (let i = 0; i < SHELL_COUNT; i += 1) {
        const startY = bounds.height + 10;
        const targetY = bounds.height * (0.18 + rng() * 0.22);
        const fuse = 0.55 + rng() * 0.2;
        parts.push({
            type: 'shell',
            x: bounds.width * (0.2 + rng() * 0.6),
            y: startY,
            vy: -(startY - targetY) / fuse,
            hue: FIREWORK_HUES[Math.floor(rng() * FIREWORK_HUES.length)],
            fuse,
            // 0.4s spacing keeps concurrent bursts (spark ttl ≤1.4s ⇒ ~3.5
            // shells' sparks alive at once ≈ 130) under MAX_PARTICLES.
            delay: i * 0.4 + rng() * 0.15,
            age: 0,
        });
    }
    return parts;
};

export const createParticles = (kind, bounds, origin, rng = Math.random) => {
    if (kind === 'fall') return spawnFall(bounds, rng);
    if (kind === 'fireworks') return spawnFireworks(bounds, rng);
    return spawnPop(origin, rng);
};

// ----------------------------------------------------------------- step ---

// Pure physics step: advances every particle by dt seconds, drops the dead,
// converts expired shells into sparks. Mutates particles in place (they are
// engine-private), returns the alive list.
export const stepParticles = (particles, dt, bounds, rng = Math.random) => {
    const next = [];
    for (const p of particles) {
        if (p.delay > 0) {
            p.delay -= dt;
            next.push(p);
            continue;
        }
        p.age += dt;
        switch (p.type) {
            case 'pop':
                p.vy += GRAVITY_POP * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.rot += p.vr * dt;
                if (p.age < p.ttl) next.push(p);
                break;
            case 'fall':
                p.y += p.vy * dt;
                p.x = p.baseX + Math.sin(p.swayPhase + p.age * p.swayFreq) * p.swayAmp;
                p.rot += p.vr * dt;
                if (p.age < p.ttl && p.y < bounds.height + p.size) next.push(p);
                break;
            case 'shell':
                p.y += p.vy * dt;
                if (p.age >= p.fuse) next.push(...spawnSparks(p, rng));
                else next.push(p);
                break;
            case 'spark': {
                const drag = 1 - Math.min(1, 1.8 * dt);
                p.vx *= drag;
                p.vy = p.vy * drag + GRAVITY_SPARK * dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.age < p.ttl) next.push(p);
                break;
            }
            default:
                break;
        }
    }
    return next.length > MAX_PARTICLES ? next.slice(0, MAX_PARTICLES) : next;
};

// --------------------------------------------------------------- render ---

// Emoji pre-rasterized once per glyph to a 96px offscreen canvas, then
// drawImage'd (downscaled) every frame — fillText per frame is the classic
// canvas-emoji perf trap.
const spriteCache = new Map();
const emojiSprite = (emoji) => {
    let sprite = spriteCache.get(emoji);
    if (!sprite) {
        const px = 96;
        sprite = document.createElement('canvas');
        sprite.width = px;
        sprite.height = px;
        const g = sprite.getContext('2d');
        g.font = `${px * 0.75}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(emoji, px / 2, px / 2 + px * 0.04);
        spriteCache.set(emoji, sprite);
    }
    return sprite;
};

const drawParticles = (ctx, particles, sprite) => {
    for (const p of particles) {
        if (p.delay > 0) continue;
        switch (p.type) {
            case 'pop':
            case 'fall': {
                // Fade over the last 30% (pop) / last second (fall) of life.
                const left = p.ttl - p.age;
                ctx.globalAlpha = p.type === 'pop'
                    ? Math.min(1, left / (p.ttl * 0.3))
                    : Math.min(1, left);
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(sprite, -p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
                break;
            }
            case 'shell':
                ctx.globalAlpha = 0.9;
                ctx.strokeStyle = `hsl(${p.hue} 70% 65%)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x, p.y + 14);
                ctx.stroke();
                break;
            case 'spark':
                ctx.globalAlpha = Math.max(0, 1 - p.age / p.ttl);
                ctx.fillStyle = `hsl(${p.hue} 85% 65%)`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                break;
            default:
                break;
        }
    }
    ctx.globalAlpha = 1;
};

// ----------------------------------------------------------------- play ---

// Plays one celebration on the given canvas (sized here to its CSS box).
// Returns { stop } — stop() cancels the loop and wipes the canvas; safe to
// call at any time, including after natural completion.
export const playCelebration = ({ canvas, kind, emoji, origin }) => {
    const noop = { stop: () => { } };
    if (!canvas || typeof requestAnimationFrame !== 'function') return noop;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return noop;
    }

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return noop;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bounds = { width, height };
    const sprite = emojiSprite(emoji);
    let particles = createParticles(kind, bounds, origin || { x: width / 2, y: height / 2 });

    let raf = 0;
    let prev = 0;
    const frame = (now) => {
        const dt = prev ? Math.min((now - prev) / 1000, 0.032) : 0.016;
        prev = now;
        particles = stepParticles(particles, dt, bounds);
        ctx.clearRect(0, 0, width, height);
        if (particles.length > 0) {
            drawParticles(ctx, particles, sprite);
            raf = requestAnimationFrame(frame);
        }
    };
    raf = requestAnimationFrame(frame);

    return {
        stop: () => {
            cancelAnimationFrame(raf);
            ctx.clearRect(0, 0, width, height);
        },
    };
};
