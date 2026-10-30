<template>
    <div class="relative">
        <!-- Curling ribbons anchored at the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 size-[46px] overflow-visible"
            viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
            <path :d="RIBBON" fill="none" stroke="#ED93B1" stroke-width="1.6" stroke-linecap="round"
                stroke-linejoin="round" />
            <path :d="HEART" fill="#D4537E" transform="translate(37 37.4) rotate(-8) scale(0.075)" />
        </svg>

        <!-- Hearts hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(h, i) in HEARTS" :key="h.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: h.x }" width="18" :height="h.len + 14"
            :viewBox="`-9 0 18 ${h.len + 14}`" xmlns="http://www.w3.org/2000/svg">
            <g class="heart" :style="{ animationDelay: h.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="h.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <path :d="HEART" :fill="h.color" :transform="`translate(0 ${h.len + 3.6}) scale(0.14)`" />
            </g>
        </svg>
    </div>
</template>

<script setup>
// Valentine's Day nav trim: corner ribbons and two hearts hanging below the nav bar.
const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: one loop, then a tail ending in the heart.
const RIBBON = 'M0 1 C9 2 17 3 21 9 C25 15 22 21 17 20 C12 19 13 11 20 11'
    + ' C27 11 30 18 33 24 C35 28 37 31 37 35';

// 100 × 72 heart centred on the origin; its top notch sits 26 units up.
const HEART = 'M0 30 C-10 22 -50 0 -50 -18 C-50 -32 -38 -42 -25 -42 C-12 -42 -4 -34 0 -26'
    + ' C4 -34 12 -42 25 -42 C38 -42 50 -32 50 -18 C50 0 10 22 0 30 Z';

// Thread length in px; delays keep the two bobbing out of phase.
const HEARTS = [
    { x: '30%', len: 20, color: '#D4537E', delay: '0s' },
    { x: '70%', len: 12, color: '#ED93B1', delay: '-2.5s' },
];
</script>

<style scoped>
/* A slow bob: the thread lengthens and shortens by a few px. */
@media (prefers-reduced-motion: no-preference) {
    .heart {
        animation: bob 5s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}
</style>
