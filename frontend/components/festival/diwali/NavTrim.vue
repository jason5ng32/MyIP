<template>
    <div class="relative">
        <!-- Marigold strings hanging from the nav's bottom corners; the right
             side mirrored. Phones keep only the outermost string per side. -->
        <svg v-for="side in SIDES" :key="side" :class="side"
            class="absolute top-0 h-[48px] w-[46px] overflow-visible" width="46" height="48" viewBox="0 0 46 48"
            xmlns="http://www.w3.org/2000/svg">
            <g v-for="(s, i) in STRINGS" :key="s.x" :class="{ 'max-sm:hidden': i > 0 }">
                <g class="sway" :style="{ transformOrigin: `${s.x}px 0px`, animationDelay: s.delay }">
                    <line class="text-muted-foreground" :x1="s.x" :x2="s.x" :y2="s.len" stroke="currentColor"
                        stroke-width="0.6" stroke-opacity="0.7" />
                    <circle v-for="(y, k) in beadsOf(s.len)" :key="y" :cx="s.x" :cy="y" r="3"
                        :fill="cycle(COLORS, k)" />
                </g>
            </g>
        </svg>

        <!-- Marigold strings ending in a hanging diya; the svg viewport clips
             them as they sway. Phones keep only the first. -->
        <svg v-for="(l, i) in LAMPS" :key="l.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: l.x }" width="24" :height="l.len + 22"
            :viewBox="`0 0 24 ${l.len + 22}`" xmlns="http://www.w3.org/2000/svg">
            <g class="sway" :style="{ transformOrigin: '12px 0px', animationDelay: l.delay }">
                <line class="text-muted-foreground" x1="12" x2="12" :y2="l.len" stroke="currentColor"
                    stroke-width="0.6" stroke-opacity="0.7" />
                <circle v-for="(y, k) in beadsOf(l.len - 4)" :key="y" cx="12" :cy="y" r="3"
                    :fill="cycle(COLORS, k)" />
                <g :transform="`translate(12 ${l.len})`">
                    <path class="text-muted-foreground" d="M0 0 L-6 9 M0 0 L6 9" fill="none" stroke="currentColor"
                        stroke-width="0.6" stroke-opacity="0.7" />
                    <g transform="translate(0 9)">
                        <path :d="FLAME" fill="#f59e0b" />
                        <path :d="LAMP" fill="#c2410c" />
                    </g>
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Diwali nav trim: marigold strings at the nav bar's bottom corners and two hanging diyas between.
import { cycle } from '@/utils/features/festival-garland.js';

const SIDES = ['left-0', 'right-0 -scale-x-100'];
const COLORS = ['#ea580c', '#f59e0b'];

// Origin = the nav's bottom-left corner; length in px, outermost first.
const STRINGS = [
    { x: 8, len: 44, delay: '0s' },
    { x: 21, len: 34, delay: '-1.7s' },
    { x: 34, len: 24, delay: '-3.4s' },
];

// Hanging diyas: string length in px; delays keep the two swaying out of phase.
const LAMPS = [
    { x: '30%', len: 22, delay: '-0.8s' },
    { x: '70%', len: 14, delay: '-3.3s' },
];

// Origin = the bowl's rim centre: a 14 × 10 bowl below, the flame above.
const LAMP = 'M-7 0 C-7 7 -3 10 0 10 C3 10 7 7 7 0 Z';
const FLAME = 'M0 -7 C2.6 -3.6 2.6 -1 0 1 C-2.6 -1 -2.6 -3.6 0 -7 Z';

// Beads every 7px from the top down to the string's end.
const BEAD_STEP = 7;
const beadsOf = (len) => {
    const ys = [];
    for (let y = len; y >= 6; y -= BEAD_STEP) ys.unshift(y);
    return ys;
};
</script>

<style scoped>
.sway {
    transform-box: view-box;
}

/* A slow sway from each string's top (view-box origin = the svg's top-left). */
@media (prefers-reduced-motion: no-preference) {
    .sway {
        animation: sway 5s ease-in-out infinite;
    }
}

@keyframes sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
}
</style>
