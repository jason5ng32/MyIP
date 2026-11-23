<template>
    <div class="relative">
        <!-- Curly streamers and confetti springing from the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 size-[46px] overflow-visible"
            viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
            <path v-for="s in STREAMERS" :key="s.color" :d="s.d" fill="none" :stroke="s.color" stroke-width="1.6"
                stroke-linecap="round" />
            <rect v-for="c in CONFETTI" :key="c.x" x="-1.6" y="-0.9" width="3.2" height="1.8" rx="0.4"
                :fill="c.color" :transform="`translate(${c.x} ${c.y}) rotate(${c.turn})`" />
            <circle v-for="c in DOTS" :key="c.x" :cx="c.x" :cy="c.y" r="1.1" :fill="c.color" />
        </svg>

        <!-- Stars hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(s, i) in STARS" :key="s.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: s.x }" width="24" :height="s.len + 20"
            :viewBox="`-12 0 24 ${s.len + 20}`" xmlns="http://www.w3.org/2000/svg">
            <g class="bob" :style="{ animationDelay: s.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="s.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${s.len + 7})`">
                    <path class="twinkle" :style="{ animationDelay: s.delay }" :d="STAR" fill="#EF9F27"
                        stroke="#BA7517" stroke-width="0.8" stroke-linejoin="round" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// New Year nav trim: streamer corners and two gold stars hanging below the nav bar.
const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: along the edge, diagonal, down the side.
const STREAMERS = [
    { color: '#ED93B1', d: 'M1 1 C10 1 16 3 20 6 C25 10 30 8 29 4 C28 1 23 3 25 7 C27 11 34 12 40 10' },
    { color: '#EF9F27', d: 'M1 1 C7 5 10 10 11 15 C12 20 18 22 19 18 C20 14 14 14 14 19 C14 24 20 30 26 30' },
    { color: '#7F77DD', d: 'M1 1 C2 7 2 12 3 18 C4 24 9 27 9 31 C9 35 4 35 5 31 C6 28 10 30 9 36 C8 40 6 42 4 44' },
];
const CONFETTI = [
    { x: 33, y: 18, turn: 30, color: '#EF9F27' },
    { x: 18, y: 38, turn: -20, color: '#ED93B1' },
    { x: 44, y: 3, turn: 60, color: '#7F77DD' },
];
const DOTS = [
    { x: 36, y: 26, color: '#7F77DD' },
    { x: 14, y: 26, color: '#ED93B1' },
    { x: 30, y: 40, color: '#EF9F27' },
];

// Five-point star, outer radius 7, centered on its origin.
const STAR = 'M0 -7 L1.8 -2.4 L6.7 -2.2 L2.9 0.9 L4.1 5.7 L0 3 L-4.1 5.7 L-2.9 0.9 L-6.7 -2.2 L-1.8 -2.4 Z';

// Thread length in px; delays keep the two bobbing out of phase.
const STARS = [
    { x: '30%', len: 22, delay: '0s' },
    { x: '70%', len: 14, delay: '-2.5s' },
];
</script>

<style scoped>
.twinkle {
    transform-box: fill-box;
    transform-origin: center;
}

/* A slow bob, and a twinkle on its own beat. */
@media (prefers-reduced-motion: no-preference) {
    .bob {
        animation: bob 5s ease-in-out infinite;
    }

    .twinkle {
        animation: twinkle 3s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}

@keyframes twinkle {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(0.88); opacity: 0.8; }
}
</style>
