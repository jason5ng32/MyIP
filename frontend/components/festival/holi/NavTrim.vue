<template>
    <div class="relative">
        <!-- Powder puffs clustered at the nav's bottom corners, thinning toward
             the middle; the right cluster mirrored. Phones keep the outer puffs. -->
        <svg v-for="side in SIDES" :key="side.cls" :class="side.cls"
            class="absolute top-0 h-[56px] w-[140px] overflow-visible" width="140" height="56" viewBox="0 0 140 56"
            xmlns="http://www.w3.org/2000/svg">
            <circle v-for="p in side.puffs" :key="p.i" :class="{ 'max-sm:hidden': p.x > INNER_X }" class="puff"
                :cx="p.x" :cy="p.y" :r="p.r" :fill="p.fill" :fill-opacity="p.o"
                :style="{ animationDuration: p.dur, animationDelay: p.delay }" />
        </svg>

        <!-- Powder bursts hanging from the nav's bottom edge, swaying on their
             threads; the svg viewport clips the thread's spare top. Phones keep
             only the first. -->
        <svg v-for="(b, i) in BURSTS" :key="b.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: b.x }" width="24" :height="b.len + 16"
            :viewBox="`-12 0 24 ${b.len + 16}`" xmlns="http://www.w3.org/2000/svg">
            <g>
                <!-- SMIL keeps the pivot on the thread's top; no CSS transform-origin guesswork. -->
                <animateTransform v-if="sway" attributeName="transform" type="rotate" values="-4;4;-4" dur="6s"
                    :begin="b.delay" repeatCount="indefinite" calcMode="spline"
                    keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
                <line class="text-muted-foreground" y1="-8" :y2="b.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <circle v-for="(c, k) in BURST" :key="k" :cx="c.x" :cy="b.len + c.y" :r="c.r"
                    :fill="k % 2 ? b.colors[1] : b.colors[0]" :fill-opacity="c.o" />
            </g>
        </svg>
    </div>
</template>

<script setup>
// Holi nav trim: drifting powder at both nav corners and two powder bursts hanging below the bar.
import { computed } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (6 × 5 × 7) keep neighbouring puffs from repeating;
// the durations only keep the drift out of sync.
const PALETTE = ['#db2777', '#7c3aed', '#0ea5e9', '#22c55e', '#facc15', '#f97316'];
const RADII = [7, 4, 10, 3, 6];
const OPACITIES = [0.6, 0.4, 0.8, 0.5, 0.35, 0.7, 0.45];
const DURATIONS = ['8s', '10s', '12s'];

// Puffs past this distance from the edge are the inner ones phones drop.
const INNER_X = 70;
const PER_SIDE = 13;

// Seeded [0, 1) sequence: the same layout on every render.
const rnd = (seed) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
};

// Origin = the corner, x toward the middle, y down; squaring the spread packs puffs at the edge.
const puffsFor = (offset) => Array.from({ length: PER_SIDE }, (_, k) => {
    const i = k + offset;
    const r = cycle(RADII, i);
    return {
        i,
        x: 4 + rnd(i) ** 2 * 126,
        y: r + rnd(i + 50) * 36,
        r,
        fill: cycle(PALETTE, i),
        o: cycle(OPACITIES, i),
        dur: cycle(DURATIONS, i),
        delay: `${-((i * 1.3) % 12).toFixed(1)}s`,
    };
});

const SIDES = [
    { cls: 'left-0', puffs: puffsFor(0) },
    { cls: 'right-0 -scale-x-100', puffs: puffsFor(PER_SIDE) },
];

// A ~13 px cluster of overlapping circles, relative to the thread's end.
const BURST = [
    { x: 0, y: 6, r: 4, o: 0.7 },
    { x: -3.5, y: 4.5, r: 3, o: 0.55 },
    { x: 3.5, y: 5, r: 3.2, o: 0.6 },
    { x: 0.5, y: 9.5, r: 3, o: 0.5 },
];

// Thread length in px; delays keep the two swaying out of phase.
const BURSTS = [
    { x: '30%', len: 22, delay: '0s', colors: [PALETTE[0], PALETTE[4]] },
    { x: '70%', len: 14, delay: '-3s', colors: [PALETTE[2], PALETTE[1]] },
];

const motion = usePreferredReducedMotion();
const sway = computed(() => motion.value !== 'reduce');
</script>

<style scoped>
/* A very slow drift: each puff sinks a few px and fades a little. */
@media (prefers-reduced-motion: no-preference) {
    .puff {
        animation: drift 10s ease-in-out infinite;
    }
}

@keyframes drift {
    0%, 100% { transform: translateY(0); opacity: 1; }
    50% { transform: translateY(3px); opacity: 0.7; }
}
</style>
