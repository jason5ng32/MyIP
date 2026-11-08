<template>
    <!-- Brand.vue's viewBox: a small heart tucked into the fedora's band on
         the right of the crown. Halo layer first, so the background gap shows
         only where the heart meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g class="heart">
            <path v-for="layer in LAYERS" :key="layer" :class="layer" :d="HEART" fill="#D4537E"
                transform="translate(404 130) rotate(16) scale(1.5)" />
        </g>
    </svg>
</template>

<script setup>
// Valentine's Day logo part: a heart tucked into the brand icon's hat band.
const LAYERS = ['halo', 'art'];

// 100 × 72 heart centred on the origin.
const HEART = 'M0 30 C-10 22 -50 0 -50 -18 C-50 -32 -38 -42 -25 -42 C-12 -42 -4 -34 0 -26'
    + ' C4 -34 12 -42 25 -42 C38 -42 50 -32 50 -18 C50 0 10 22 0 30 Z';
</script>

<style scoped>
/* Background-colored halo keeps the heart apart from the icon (16 units after the scale). */
.halo {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 16;
    stroke-linejoin: round;
}

.heart {
    transform-box: fill-box;
    transform-origin: 50% 50%;
}

/* A gentle beat every few seconds. */
@media (prefers-reduced-motion: no-preference) {
    .heart {
        animation: beat 4s ease-in-out infinite;
    }
}

@keyframes beat {
    0%, 70%, 100% { transform: scale(1); }
    78% { transform: scale(1.12); }
    86% { transform: scale(1); }
}
</style>
