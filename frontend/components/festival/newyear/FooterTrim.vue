<template>
    <!-- Gold stars, mirror balls and silver stars along the garland; kind and drop cycle on their own. -->
    <Garland v-slot="{ i }">
        <template v-for="p in [piece(i)]" :key="i">
            <line :y2="p.drop" class="text-muted-foreground" stroke="currentColor" stroke-opacity="0.6"
                stroke-width="0.6" />
            <g :transform="`translate(0 ${p.drop})`">
                <!-- Mirror ball: a cap, a faceted sphere and a glint. -->
                <g v-if="p.kind === 'ball'">
                    <rect x="-1.4" width="2.8" height="2" rx="0.4" fill="#888780" />
                    <circle :cy="BALL.cy" :r="BALL.r" fill="#D3D1C7" stroke="#888780" stroke-width="0.6" />
                    <path :d="BALL.grid" fill="none" stroke="#888780" stroke-width="0.4" />
                    <path d="M-2.6 4 Q-2.4 5.6 -0.8 5.8 Q-2.4 6 -2.6 7.6 Q-2.8 6 -4.4 5.8 Q-2.8 5.6 -2.6 4 Z"
                        fill="#FFFFFF" />
                </g>

                <!-- A star hung by its top point. -->
                <path v-else class="twinkle" :style="{ animationDelay: `${-((i * 1.3) % 4)}s` }"
                    :d="STARS[p.kind].d" :fill="STARS[p.kind].fill" :stroke="STARS[p.kind].edge"
                    stroke-width="0.7" stroke-linejoin="round" />
            </g>
        </template>
    </Garland>
</template>

<script setup>
// New Year footer trim: a metallic party garland of stars and mirror balls.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (3 × 4) keep neighbours from repeating as a group.
const KINDS = ['gold', 'ball', 'silver'];
const DROPS = [3, 10, 6, 13];

const piece = (i) => ({ kind: cycle(KINDS, i), drop: cycle(DROPS, i) });

// A five-point star with its top point at the origin.
const star = (R, r) => {
    let d = '';
    for (let k = 0; k < 10; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5;
        const rad = k % 2 ? r : R;
        d += `${k ? 'L' : 'M'}${(rad * Math.cos(a)).toFixed(2)} ${(R + rad * Math.sin(a)).toFixed(2)} `;
    }
    return `${d}Z`;
};

const STARS = {
    gold: { d: star(7.5, 3.1), fill: '#EF9F27', edge: '#BA7517' },
    silver: { d: star(6.5, 2.7), fill: '#D3D1C7', edge: '#888780' },
};

// Mirror ball under a 2px cap: meridians and parallels inside the sphere.
const BALL = (() => {
    const r = 6.5;
    const cy = 2 + r;
    let grid = '';
    for (const rx of [2.4, 4.8]) {
        grid += `M0 ${cy - r} A${rx} ${r} 0 0 0 0 ${cy + r} A${rx} ${r} 0 0 0 0 ${cy - r} `;
    }
    for (const k of [-4.4, -2.2, 0, 2.2, 4.4]) {
        const w = Math.sqrt(r * r - k * k).toFixed(2);
        grid += `M${-w} ${cy + k} H${w} `;
    }
    return { r, cy, grid: grid.trim() };
})();
</script>

<style scoped>
/* Stars catch the light now and then, out of step with each other. */
@media (prefers-reduced-motion: no-preference) {
    .twinkle {
        animation: twinkle 4s ease-in-out infinite;
    }
}

@keyframes twinkle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
}
</style>
