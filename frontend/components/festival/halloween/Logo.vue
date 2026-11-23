<template>
    <!-- Brand.vue's viewBox: the witch hat's brim rings the fedora's crown and
         its cone rises ~10px above the icon. Outline layer first, so the
         background gap shows only where the hat meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g class="hat">
            <g v-for="layer in LAYERS" :key="layer" :class="layer">
                <path :fill="colors.cone" d="M89 140 Q250 99 411 140 L342 -166 Q308 -248 227 -207 Q285 -166 250 -105 Z" />
                <path v-if="layer === 'fill'" fill="#EF9F27" d="M136 69 L395 69 L404 109 L109 109 Z" />
                <ellipse :fill="colors.brim" cx="250" cy="140" rx="230" ry="36" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Halloween logo part: a witch hat stacked on the brand icon's fedora.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'fill'];

const store = useMainStore();
const colors = computed(() => (store.isDarkMode
    ? { cone: '#7F77DD', brim: '#534AB7' }
    : { cone: '#534AB7', brim: '#3C3489' }));
</script>

<style scoped>
/* Background-colored outline keeps the hat apart from the icon. */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 24;
    stroke-linejoin: round;
}

.hat {
    transform-box: fill-box;
    transform-origin: 50% 100%;
}

/* A slight tilt every few seconds. */
@media (prefers-reduced-motion: no-preference) {
    .hat {
        animation: tilt 6s ease-in-out infinite;
    }
}

@keyframes tilt {
    0%, 80%, 100% { transform: rotate(0deg); }
    86% { transform: rotate(-4deg); }
    93% { transform: rotate(2deg); }
}
</style>
