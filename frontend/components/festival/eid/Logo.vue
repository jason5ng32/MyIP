<template>
    <!-- Brand.vue's viewBox: a crescent and star tucked into the fedora's band
         on the right of the crown. Halo layer first, so the background gap
         shows only where they meet the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(402 128) rotate(-20) scale(2.4)">
            <g v-for="layer in LAYERS" :key="layer" :class="layer" fill="#B8860B">
                <path :d="CRESCENT" />
                <path :class="{ star: layer === 'art' }" :d="STAR" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Eid al-Fitr logo part: a gold crescent and star tucked into the brand icon's hat band.
const LAYERS = ['halo', 'art'];

// ~40 × 46 crescent opening right, around the origin; the star sits in its hollow.
const CRESCENT = 'M6 -22 C-10 -22 -20 -10 -20 2 C-20 14 -10 24 4 24 C10 24 14 22 18 18'
    + ' C6 20 -6 12 -6 0 C-6 -10 0 -18 10 -21 C8 -22 7 -22 6 -22 Z';
const STAR = 'M14 -2 L16 4 L22 4 L17 8 L19 14 L14 10 L9 14 L11 8 L6 4 L12 4 Z';
</script>

<style scoped>
/* Background-colored halo keeps the moon apart from the icon (24 units after the scale). */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 10;
    stroke-linejoin: round;
}

/* The star dims and brightens gently; its halo stays put. */
@media (prefers-reduced-motion: no-preference) {
    .star {
        animation: twinkle 4s ease-in-out infinite;
    }
}

@keyframes twinkle {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
}
</style>
