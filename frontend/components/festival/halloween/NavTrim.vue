<template>
    <div class="relative">
        <!-- Quarter cobwebs anchored at the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side"
            class="absolute top-0 size-[46px] overflow-visible text-muted-foreground" viewBox="0 0 46 46"
            xmlns="http://www.w3.org/2000/svg">
            <path :d="WEB" fill="none" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.6"
                stroke-linecap="round" />
        </svg>

        <!-- Spiders hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(s, i) in SPIDERS" :key="s.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2 text-foreground" :style="{ left: s.x }" width="24"
            :height="s.len + 20" :viewBox="`-12 0 24 ${s.len + 20}`" xmlns="http://www.w3.org/2000/svg">
            <g class="spider" :style="{ animationDelay: s.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="s.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${s.len + 6})`">
                    <path v-for="dir in [1, -1]" :key="dir" :transform="`scale(${dir} 1)`" :d="LEGS" fill="none"
                        stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" />
                    <ellipse rx="5" ry="6" fill="currentColor" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Halloween nav trim: corner cobwebs and two spiders hanging below the nav bar.
const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: four spokes, three sagging threads.
const WEB = 'M0 0 L46 0 M0 0 L40 23 M0 0 L23 40 M0 0 L0 46'
    + ' M15 0 Q12 6 13 8 Q9 12 7.5 14 Q4 15 0 15'
    + ' M30 0 Q25 10 26 15 Q19 24 15 26 Q8 29 0 30'
    + ' M44 0 Q37 14 38 22 Q28 34 22 38 Q12 42 0 44';

// Three bent legs on one side, relative to the body's center.
const LEGS = 'M3.5 -3 L8 -7 L10.5 -4 M4.5 0 L9.5 -2 L11.5 2 M3.5 3 L8 5 L9.5 9';

// Thread length in px; delays keep the two bobbing out of phase.
const SPIDERS = [
    { x: '30%', len: 28, delay: '0s' },
    { x: '70%', len: 18, delay: '-2.5s' },
];
</script>

<style scoped>
/* A slow bob: the thread lengthens and shortens by a few px. */
@media (prefers-reduced-motion: no-preference) {
    .spider {
        animation: bob 5s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}
</style>
