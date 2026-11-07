<template>
    <!-- Brand.vue's viewBox: a two-colour gulal splat over the fedora's left
         brim tip. Halo layer first, so the background gap shows only where
         the splat meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(74 238) scale(2.2)">
            <path v-for="layer in LAYERS" :key="layer" :class="layer" :d="SPLAT" fill="#db2777" />
            <path :d="INNER" fill="#facc15" />
        </g>
    </svg>
</template>

<script setup>
// Holi logo part: a magenta-and-yellow powder splat on the brand icon's brim.
const LAYERS = ['halo', 'art'];

// ~54 × 46 lobed blob centred on the origin, and a smaller one inside it.
const SPLAT = 'M0 -22 C8 -22 14 -16 18 -10 C26 -8 28 2 22 6 C24 14 16 20 8 16 C2 24 -10 22 -12 14'
    + ' C-24 14 -26 2 -18 -4 C-20 -14 -12 -20 -4 -18 C-3 -20 -2 -22 0 -22 Z';
const INNER = 'M-2 -4 C6 -8 12 -2 10 4 C12 10 4 14 0 10 C-8 12 -10 2 -2 -4 Z';
</script>

<style scoped>
/* Background-colored halo keeps the splat apart from the icon (24 units after the scale). */
.halo {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 11;
    stroke-linejoin: round;
}
</style>
