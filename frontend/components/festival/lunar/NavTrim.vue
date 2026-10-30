<template>
    <div class="relative">
        <!-- Plum branches anchored at the nav's bottom corners; the right one mirrored. -->
        <svg v-for="side in SIDES" :key="side" :class="side" class="absolute top-0 size-[46px] overflow-visible"
            viewBox="0 0 46 46" xmlns="http://www.w3.org/2000/svg">
            <path v-for="limb in LIMBS" :key="limb.d" :d="limb.d" :stroke-width="limb.w" :stroke="branch" fill="none"
                stroke-linecap="round" />
            <circle v-for="b in BUDS" :key="b.x" :cx="b.x" :cy="b.y" r="1.3" fill="#ED93B1" />
            <circle v-for="p in PETALS" :key="`${p.cx} ${p.cy}`" :cx="p.cx" :cy="p.cy" :r="p.r" fill="#ED93B1" />
            <circle v-for="b in BLOSSOMS" :key="b.x" :cx="b.x" :cy="b.y" :r="b.r * 0.3" fill="#EF9F27" />
        </svg>

        <!-- Lanterns hanging from the nav's bottom edge; the svg viewport clips
             the thread's spare top as they bob. Phones keep only the first. -->
        <svg v-for="(l, i) in LANTERNS" :key="l.x" :class="{ 'max-sm:hidden': i > 0 }"
            class="absolute top-0 -translate-x-1/2" :style="{ left: l.x }" width="20" :height="l.len + 32"
            :viewBox="`-10 0 20 ${l.len + 32}`" xmlns="http://www.w3.org/2000/svg">
            <g class="lantern" :style="{ animationDelay: l.delay }">
                <line class="text-muted-foreground" y1="-8" :y2="l.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${l.len})`">
                    <path d="M0 21 V28 M-1.6 21.5 L-2 27 M1.6 21.5 L2 27" stroke="#EF9F27" stroke-width="0.8"
                        stroke-linecap="round" />
                    <ellipse cy="11.5" rx="8" ry="9" fill="#E24B4A" />
                    <path d="M0 3 V20" stroke="#A32D2D" stroke-width="0.7" />
                    <ellipse cy="11.5" rx="4.2" ry="8.6" fill="none" stroke="#A32D2D" stroke-width="0.7" />
                    <rect x="-4" width="8" height="2.6" rx="0.6" fill="#EF9F27" />
                    <rect x="-4" y="19.4" width="8" height="2.6" rx="0.6" fill="#EF9F27" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Lunar New Year nav trim: corner plum branches and two red lanterns below the nav bar.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const SIDES = ['left-0', 'right-0 -scale-x-100'];

// Origin = the nav's bottom-left corner, y down: a main limb and one twig.
const LIMBS = [
    { d: 'M0 1 C9 3 17 8 23 15 C29 22 33 30 37 41', w: 2 },
    { d: 'M14 6.5 C20 4 27 3 36 3.5', w: 1.3 },
];

const BLOSSOMS = [
    { x: 9, y: 3.6, r: 3.2, rot: 20 },
    { x: 29, y: 4, r: 3.5, rot: -10 },
    { x: 22.5, y: 14.5, r: 3.8, rot: 5 },
    { x: 35, y: 34, r: 3.4, rot: 35 },
];

const BUDS = [
    { x: 38, y: 3.8 },
    { x: 30.5, y: 24 },
];

// Five round petals around each blossom centre.
const PETALS = BLOSSOMS.flatMap((b) => [0, 1, 2, 3, 4].map((k) => {
    const a = ((b.rot + k * 72 - 90) * Math.PI) / 180;
    return { cx: b.x + Math.cos(a) * b.r * 0.56, cy: b.y + Math.sin(a) * b.r * 0.56, r: b.r * 0.46 };
}));

// Thread length in px; delays keep the two bobbing out of phase.
const LANTERNS = [
    { x: '30%', len: 16, delay: '0s' },
    { x: '70%', len: 8, delay: '-2.5s' },
];

const store = useMainStore();
const branch = computed(() => (store.isDarkMode ? '#888780' : '#5F5E5A'));
</script>

<style scoped>
/* A slow bob: the thread lengthens and shortens by a few px. */
@media (prefers-reduced-motion: no-preference) {
    .lantern {
        animation: bob 5s ease-in-out infinite;
    }
}

@keyframes bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(4px); }
}
</style>
