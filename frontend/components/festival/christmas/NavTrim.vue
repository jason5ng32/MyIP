<template>
    <div class="relative">
        <!-- Pine sprigs with holly anchored at the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 size-[46px] overflow-visible"
            viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
            <path :d="STEM" fill="none" :stroke="colors.stem" stroke-width="1.4" stroke-linecap="round" />
            <path :d="NEEDLES" fill="none" :stroke="colors.needle" stroke-width="1" stroke-linecap="round" />
            <path v-for="turn in [25, 155]" :key="turn" :d="LEAF" :fill="colors.stem"
                :transform="`translate(27 13) rotate(${turn})`" />
            <circle v-for="[cx, cy] in BERRIES" :key="cx" :cx="cx" :cy="cy" r="2.4" fill="#E24B4A" />
        </svg>

        <!-- Baubles hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(b, i) in BAUBLES" :key="b.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: b.x }" width="24" :height="b.len + 24"
            :viewBox="`-12 0 24 ${b.len + 24}`" xmlns="http://www.w3.org/2000/svg">
            <g class="bob" :style="{ animationDelay: b.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="b.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${b.len})`">
                    <rect x="-2.5" width="5" height="3.5" rx="0.8" fill="#BA7517" />
                    <circle cy="10.5" r="7" :fill="b.color" />
                    <ellipse cx="-2.6" cy="8" rx="1.4" ry="2.4" fill="#FFFFFF" fill-opacity="0.55"
                        transform="rotate(30 -2.6 8)" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Christmas nav trim: pine-and-holly corners and two baubles hanging below the nav bar.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: a branch along the edge and
// a twig dropping off it, needles in pairs along both.
const STEM = 'M0 2 Q20 3 42 9 M15 3.4 Q20 10 21 19';
const NEEDLES = 'M2.8 2.5 l3.6 4.6 M2.8 2.5 l4.9 -3.2 M7.5 3.2 l3.4 4.5 M7.5 3.2 l4.7 -3.1'
    + ' M12.1 4 l3.3 4.3 M12.1 4 l4.5 -3 M16.8 4.8 l3.1 4.1 M16.8 4.8 l4.3 -2.8'
    + ' M21.5 5.6 l3 3.9 M21.5 5.6 l4.1 -2.7 M26.1 6.4 l2.9 3.7 M26.1 6.4 l3.9 -2.6'
    + ' M30.8 7.1 l2.7 3.5 M30.8 7.1 l3.7 -2.5 M35.5 7.9 l2.6 3.4 M35.5 7.9 l3.5 -2.3'
    + ' M40.1 8.7 l2.4 3.2 M40.1 8.7 l3.3 -2.2 M15.9 5.7 l-1.8 4.4 M15.9 5.7 l4.3 2.1'
    + ' M17.4 9.6 l-1.6 4 M17.4 9.6 l3.9 1.9 M18.9 13.5 l-1.4 3.6 M18.9 13.5 l3.5 1.7'
    + ' M20.4 17.4 l-1.3 3.2 M20.4 17.4 l3.1 1.5';

// A scalloped holly leaf, 10 long, pointing +x from its stalk.
const LEAF = 'M0 0 Q2 -2.6 4 -1.6 Q5.4 -3 7 -1.4 Q8.6 -1.8 10 0 Q8.6 1.8 7 1.4 Q5.4 3 4 1.6 Q2 2.6 0 0 Z';
const BERRIES = [[25, 12], [29.5, 13], [27, 16.2]];

// Thread length in px; delays keep the two bobbing out of phase.
const BAUBLES = [
    { x: '30%', len: 22, delay: '0s', color: '#E24B4A' },
    { x: '70%', len: 14, delay: '-2.5s', color: '#EF9F27' },
];

// Lighter greens on the dark nav, where the deep ones would sink.
const store = useMainStore();
const colors = computed(() => (store.isDarkMode
    ? { stem: '#639922', needle: '#97C459' }
    : { stem: '#3B6D11', needle: '#639922' }));
</script>

<style scoped>
/* A slow bob: the thread lengthens and shortens by a few px. */
@media (prefers-reduced-motion: no-preference) {
    .bob {
        animation: bob 5s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}
</style>
