<template>
    <!-- Brand.vue's viewBox: a small clay diya tucked into the fedora's band
         on the right of the crown. Halo layer first, so the background gap
         shows only where the lamp meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(400 132) rotate(14) scale(1.7)">
            <g v-for="layer in LAYERS" :key="layer" :class="layer">
                <path :d="LAMP" fill="#c2410c" />
                <path :class="{ flame: layer === 'art' }" :d="FLAME" fill="#f59e0b" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Diwali logo part: a lit diya tucked into the brand icon's hat band.
const LAYERS = ['halo', 'art'];

// 60 × 26 lamp bowl, its rim on the origin; the flame rises 26 above it.
const LAMP = 'M-30 0 C-30 18 -14 26 0 26 C14 26 30 18 30 0 Z';
const FLAME = 'M0 -26 C10 -14 10 -4 0 2 C-10 -4 -10 -14 0 -26 Z';
</script>

<style scoped>
/* Background-colored halo keeps the lamp apart from the icon (14 units after the scale). */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 14;
    stroke-linejoin: round;
}

.flame {
    transform-box: fill-box;
    transform-origin: 50% 100%;
}

/* A gentle flicker, stretching and dimming from the wick. */
@media (prefers-reduced-motion: no-preference) {
    .flame {
        animation: flicker 3.5s ease-in-out infinite;
    }
}

@keyframes flicker {
    0%, 100% { transform: scale(1); opacity: 1; }
    30% { transform: scale(0.94, 1.06); opacity: 0.9; }
    55% { transform: scale(1.03, 0.95); opacity: 1; }
    80% { transform: scale(0.97, 1.03); opacity: 0.85; }
}
</style>
