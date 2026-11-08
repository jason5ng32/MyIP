<template>
    <div class="relative">
        <!-- A sugar skull among marigolds growing out of each bottom corner; the
             right one mirrored. Phones drop the outer blossoms and petals. -->
        <svg v-for="side in SIDES" :key="side" :class="side"
            class="absolute top-0 h-[24px] w-[110px] overflow-visible" width="110" height="24" viewBox="0 0 110 24"
            xmlns="http://www.w3.org/2000/svg">
            <g v-for="b in CORNER_BLOSSOMS" :key="b.x" :class="{ 'max-sm:hidden': b.outer }"
                :transform="`translate(${b.x} ${b.y}) scale(${b.r / 28})`">
                <path class="spin" :d="PETALS" :fill="b.fill" />
                <circle r="11" fill="#facc15" />
            </g>
            <ellipse v-for="f in LOOSE_PETALS" :key="f.x" class="max-sm:hidden" rx="2.5" ry="1.5" fill="#f97316"
                :transform="`translate(${f.x} ${f.y}) rotate(${f.angle})`" />
            <g transform="translate(24 11) scale(0.25)">
                <path :d="SKULL" fill="#fafafa" :stroke="skullEdge" stroke-width="3" stroke-linejoin="round" />
                <ellipse v-for="dir in [-1, 1]" :key="dir" :cx="dir * 11" cy="-2" rx="9" ry="10" fill="#312e81" />
                <circle cx="-19" cy="11" r="3.5" fill="#db2777" />
                <circle cx="19" cy="11" r="3.5" fill="#0d9488" />
                <g transform="translate(0 -28) scale(0.55)">
                    <path :d="PETALS" fill="#f97316" />
                    <circle r="11" fill="#facc15" />
                </g>
            </g>
        </svg>

        <!-- A calavera and a marigold cluster hanging from the nav's bottom edge;
             the svg viewport clips the thread's spare top as they sway. Phones
             keep only the first. -->
        <svg v-for="(h, i) in HANGERS" :key="h.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: h.x }" width="24" :height="h.len + 24"
            :viewBox="`-12 0 24 ${h.len + 24}`" xmlns="http://www.w3.org/2000/svg">
            <g class="sway" :style="{ animationDelay: h.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="h.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />

                <!-- Sugar skull, ~13 × 17 with its crown marigold, held by the flower. -->
                <g v-if="h.kind === 'skull'" :transform="`translate(0 ${h.len + 10}) scale(0.25)`">
                    <path :d="SKULL" fill="#fafafa" :stroke="skullEdge" stroke-width="3" stroke-linejoin="round" />
                    <ellipse v-for="dir in [-1, 1]" :key="dir" :cx="dir * 11" cy="-2" rx="9" ry="10"
                        fill="#312e81" />
                    <circle cx="-19" cy="11" r="3.5" fill="#db2777" />
                    <circle cx="19" cy="11" r="3.5" fill="#0d9488" />
                    <g transform="translate(0 -28) scale(0.55)">
                        <path :d="PETALS" fill="#f97316" />
                        <circle r="11" fill="#facc15" />
                    </g>
                </g>

                <!-- Three marigolds, r ≈ 4, bunched under the thread. -->
                <g v-else>
                    <g v-for="b in CLUSTER" :key="b.x" :transform="`translate(${b.x} ${h.len + b.y}) scale(0.14)`">
                        <path :d="PETALS" :fill="b.fill" />
                        <circle r="11" fill="#facc15" />
                    </g>
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Día de los Muertos nav trim: a calavera among marigolds at each bottom corner,
// a calavera and a marigold cluster hanging below the nav bar.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: blossoms (radius r) either
// side of the skull at x 24; the outer two leave phones.
const CORNER_BLOSSOMS = [
    { x: 7, y: 6, r: 5, fill: '#ea580c' },
    { x: 41, y: 7, r: 6, fill: '#f97316' },
    { x: 57, y: 5, r: 4, fill: '#ea580c', outer: true },
    { x: 72, y: 9, r: 5, fill: '#f97316', outer: true },
];
const LOOSE_PETALS = [
    { x: 86, y: 5, angle: 30 },
    { x: 97, y: 11, angle: -25 },
];

// Thread length in px; delays keep the two swaying out of phase.
const HANGERS = [
    { x: '30%', len: 22, delay: '-0.8s', kind: 'skull' },
    { x: '70%', len: 14, delay: '-3s', kind: 'marigolds' },
];

// The logo's skull (52 × 58, centred) and marigold (eight lobes, ~56 across).
const SKULL = 'M-26 -2 C-26 -22 -14 -30 0 -30 C14 -30 26 -22 26 -2 C26 8 20 12 16 14 V24'
    + ' Q16 28 12 28 H-12 Q-16 28 -16 24 V14 C-20 12 -26 8 -26 -2 Z';
const PETALS = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    const at = (r, t) => `${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`;
    return `M0 0 L${at(22, a - Math.PI / 8)} Q${at(36, a)} ${at(22, a + Math.PI / 8)} Z`;
}).join(' ');

// Blossom centres below the thread's end: one on top, two beneath.
const CLUSTER = [
    { x: 0, y: 4, fill: '#f97316' },
    { x: -4.4, y: 10.5, fill: '#ea580c' },
    { x: 4.4, y: 10.5, fill: '#f97316' },
];

// The white skull needs an edge on the light page only.
const store = useMainStore();
const skullEdge = computed(() => (store.isDarkMode ? null : '#B4B2A9'));
</script>

<style scoped>
.sway {
    transform-box: fill-box;
    transform-origin: 50% 0;
}

.spin {
    transform-box: fill-box;
    transform-origin: 50% 50%;
}

/* The hanging pieces sway gently; the corner blossoms turn very slowly. */
@media (prefers-reduced-motion: no-preference) {
    .sway {
        animation: sway 5s ease-in-out infinite;
    }

    .spin {
        animation: turn 20s linear infinite;
    }
}

@keyframes sway {
    0%, 100% { transform: rotate(-4deg); }
    50% { transform: rotate(4deg); }
}

@keyframes turn {
    to { transform: rotate(360deg); }
}
</style>
