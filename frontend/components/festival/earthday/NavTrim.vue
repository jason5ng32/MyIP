<template>
    <div class="relative">
        <!-- Vines curling out of the nav's bottom corners; the right one mirrored.
             Phones keep the inner stems and leaves only. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 h-[64px] w-[120px] overflow-visible"
            width="120" height="64" viewBox="0 0 120 64" xmlns="http://www.w3.org/2000/svg">
            <path v-for="s in STEMS" :key="s.d" :class="{ 'max-sm:hidden': s.outer }" :d="s.d" fill="none"
                stroke="#15803d" stroke-width="1.1" stroke-linecap="round" />
            <g v-for="l in LEAVES" :key="l.x" :class="{ 'max-sm:hidden': l.outer }"
                :transform="`translate(${l.x} ${l.y}) rotate(${l.rot})`">
                <path class="leaf" :d="LEAF" :fill="l.fill" :style="{ animationDelay: l.delay }" />
            </g>
        </svg>

        <!-- Sprigs hanging from the nav's bottom edge: a stem ending in a leaf
             pair and a tendril curl. Phones keep only the first. -->
        <svg v-for="(h, i) in SPRIGS" :key="h.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2 overflow-visible" :style="{ left: h.x }" width="36"
            :height="h.len + 16" :viewBox="`-18 0 36 ${h.len + 16}`" xmlns="http://www.w3.org/2000/svg">
            <path :d="`M0 0 V${h.len} ${TENDRIL}`" fill="none" stroke="#15803d" stroke-width="1.1"
                stroke-linecap="round" />
            <g v-for="(turn, j) in [35, 145]" :key="turn" :transform="`translate(0 ${h.len}) rotate(${turn})`">
                <path class="leaf" :d="LEAF" :fill="h.fills[j]" :style="{ animationDelay: h.delays[j] }" />
            </g>
        </svg>
    </div>
</template>

<script setup>
// Earth Day nav trim: leafy corner vines and two sprigs hanging below the nav bar.
const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: a main stem curling out
// along the edge, a branch dropping off the corner, a tendril off the main stem.
const STEMS = [
    { d: 'M4 0 C6 18 14 30 30 34' },
    { d: 'M4 0 C2 14 8 26 20 44' },
    { d: 'M30 34 C44 38 56 30 70 24', outer: true },
    { d: 'M30 34 C34 44 40 50 52 52', outer: true },
];

// A 16 × 12 leaf pointing +x from its stalk at the origin.
const LEAF = 'M0 0 C6 -8 14 -8 16 0 C14 8 6 8 0 0 Z';

// Delays keep neighbouring leaves fluttering out of phase.
const LEAVES = [
    { x: 12, y: 20, rot: 30, fill: '#16a34a', delay: '0s' },
    { x: 28, y: 33, rot: -20, fill: '#22c55e', delay: '-1.3s' },
    { x: 18, y: 44, rot: 60, fill: '#4ade80', delay: '-2.6s' },
    { x: 50, y: 32, rot: 10, fill: '#15803d', delay: '-0.7s', outer: true },
    { x: 44, y: 50, rot: 20, fill: '#22c55e', delay: '-3.2s', outer: true },
    { x: 66, y: 26, rot: -10, fill: '#16a34a', delay: '-1.9s', outer: true },
];

// Relative to the stem's end: a small curl below the leaf pair.
const TENDRIL = 'c0 4 2.5 6 4 4.5 c1.2 -1.2 0 -2.8 -1.2 -1.8';

// Stem length in px; delays keep the leaves fluttering out of phase.
const SPRIGS = [
    { x: '30%', len: 22, fills: ['#16a34a', '#4ade80'], delays: ['-0.4s', '-2.2s'] },
    { x: '70%', len: 14, fills: ['#22c55e', '#15803d'], delays: ['-1.6s', '-3.4s'] },
];
</script>

<style scoped>
/* Pivot on the stalk: the left middle of the untransformed leaf. */
.leaf {
    transform-box: fill-box;
    transform-origin: 0% 50%;
}

/* A gentle flutter of a few degrees. */
@media (prefers-reduced-motion: no-preference) {
    .leaf {
        animation: flutter 4s ease-in-out infinite;
    }
}

@keyframes flutter {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(8deg); }
}
</style>
