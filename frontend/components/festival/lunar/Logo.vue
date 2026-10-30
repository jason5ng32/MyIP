<template>
    <!-- Brand.vue's viewBox: a plum sprig tucked into the fedora's band on the
         right, rising up and out past the crown. Halo layer first, so the
         background gap shows only where the sprig meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g class="sprig">
            <g v-for="layer in LAYERS" :key="layer" :class="layer">
                <path v-for="limb in LIMBS" :key="limb.d" :d="limb.d" :stroke="branch"
                    :stroke-width="layer === 'halo' ? limb.w + 24 : limb.w"
                    fill="none" stroke-linecap="round" />
                <circle v-for="p in PETALS" :key="`${p.cx} ${p.cy}`" :cx="p.cx" :cy="p.cy" :r="p.r" fill="#ED93B1" />
                <circle v-for="b in BLOSSOMS" :key="b.x" :cx="b.x" :cy="b.y" :r="b.r * 0.3" fill="#EF9F27" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Lunar New Year logo part: a plum-blossom sprig in the brand icon's hat band.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'art'];

// Main limb from the band, plus one twig.
const LIMBS = [
    { d: 'M372 160 C402 92 438 24 468 -36 C484 -68 502 -98 522 -126', w: 26 },
    { d: 'M450 0 C484 -14 520 -24 560 -22', w: 18 },
];

// Blossom centres and radii; five round petals each.
const BLOSSOMS = [
    { x: 462, y: -30, r: 64, rot: 10 },
    { x: 524, y: -140, r: 54, rot: -14 },
    { x: 566, y: -24, r: 44, rot: 30 },
];

const PETALS = BLOSSOMS.flatMap((b) => [0, 1, 2, 3, 4].map((k) => {
    const a = ((b.rot + k * 72 - 90) * Math.PI) / 180;
    return { cx: b.x + Math.cos(a) * b.r * 0.56, cy: b.y + Math.sin(a) * b.r * 0.56, r: b.r * 0.46 };
}));

const store = useMainStore();
const branch = computed(() => (store.isDarkMode ? '#888780' : '#5F5E5A'));
</script>

<style scoped>
/* Background-colored halo keeps the sprig apart from the icon. */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
}

.halo > circle {
    stroke-width: 24;
}

.halo > path {
    fill: none;
}

.sprig {
    transform-box: fill-box;
    transform-origin: 0% 100%;
}

/* A gentle sway from the band. */
@media (prefers-reduced-motion: no-preference) {
    .sprig {
        animation: sway 7s ease-in-out infinite;
    }
}

@keyframes sway {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(-3deg); }
}
</style>
