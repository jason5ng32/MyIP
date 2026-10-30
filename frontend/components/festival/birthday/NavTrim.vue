<template>
    <div class="relative">
        <!-- Pennant strings sagging at the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 h-[30px] w-[56px] overflow-visible"
            viewBox="0 0 56 30" xmlns="http://www.w3.org/2000/svg">
            <path class="text-muted-foreground" :d="STRING" fill="none" stroke="currentColor" stroke-width="0.8"
                stroke-opacity="0.7" stroke-linecap="round" />
            <path v-for="p in PENNANTS" :key="p.color" :transform="p.transform" :fill="p.color"
                d="M-3.6 0 L3.6 0 L0 8.5 Z" stroke-linejoin="round" />
        </svg>

        <!-- Gift boxes hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(g, i) in GIFTS" :key="g.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: g.x }" width="18" :height="g.len + 20"
            :viewBox="`-9 0 18 ${g.len + 20}`" xmlns="http://www.w3.org/2000/svg">
            <g class="gift" :style="{ animationDelay: g.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="g.len + 1" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${g.len})`">
                    <rect x="-5.6" y="5.6" width="11.2" height="8" rx="0.5" :fill="g.color" />
                    <rect x="-6.5" y="2.4" width="13" height="3.4" rx="0.5" :fill="g.color" />
                    <path d="M-5.6 5.9 H5.6" stroke="#000" stroke-opacity="0.2" stroke-width="0.6" />
                    <rect x="-1" y="2.4" width="2" height="11.2" fill="#FAC775" />
                    <path v-for="dir in [1, -1]" :key="dir" :transform="`scale(${dir} 1)`" fill="#FAC775"
                        d="M0 1.6 C-1.8 -1.4 -4.8 -0.8 -4.2 1.2 C-3.8 2.6 -1.6 2.6 0 1.6 Z" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Site-birthday nav trim: corner pennant strings and two gift boxes below the nav bar.
const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: a string sagging between two points on the nav's edge.
const P0 = [0, 0.5];
const P1 = [28, 26];
const P2 = [56, 0.5];
const STRING = `M${P0} Q${P1} ${P2}`;

// Pennants hang from evenly spaced points on the string, square to its slope.
const PENNANTS = ['#7F77DD', '#EF9F27', '#1D9E75', '#D4537E'].map((color, i) => {
    const t = (i + 1) / 5;
    const at = (k) => (1 - t) ** 2 * P0[k] + 2 * t * (1 - t) * P1[k] + t ** 2 * P2[k];
    const slope = (k) => 2 * (1 - t) * (P1[k] - P0[k]) + 2 * t * (P2[k] - P1[k]);
    const deg = (Math.atan2(slope(1), slope(0)) * 180) / Math.PI;
    return { color, transform: `translate(${at(0)} ${at(1)}) rotate(${deg})` };
});

// Thread length in px; delays keep the two bobbing out of phase.
const GIFTS = [
    { x: '30%', len: 18, color: '#1D9E75', delay: '0s' },
    { x: '70%', len: 10, color: '#D4537E', delay: '-2.5s' },
];
</script>

<style scoped>
/* A slow bob: the thread lengthens and shortens by a few px. */
@media (prefers-reduced-motion: no-preference) {
    .gift {
        animation: bob 5s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}
</style>
