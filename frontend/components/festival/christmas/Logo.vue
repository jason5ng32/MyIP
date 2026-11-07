<template>
    <!-- Brand.vue's viewBox: a Santa hat sits on the fedora's crown, its fur
         band on the brim line, slumping right so the pompom hangs just past
         the icon's edge. Halo layer first, so the background gap shows only
         where the hat meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g class="hat">
            <g v-for="layer in LAYERS" :key="layer" :class="layer">
                <path fill="#E24B4A" d="M96 172 C100 -20 206 -170 326 -176 C426 -180 488 -96 492 14
                    C464 -50 418 -86 374 -70 C394 0 408 90 414 172 Z" />
                <path fill="#FFFFFF" :stroke="furEdge" stroke-width="12" stroke-linejoin="round"
                    d="M72 156 Q250 130 428 156 L434 210 Q250 196 66 210 Z" />
                <circle fill="#FFFFFF" :stroke="furEdge" stroke-width="12" cx="490" cy="44" r="48" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Christmas logo part: a Santa hat stacked on the brand icon's fedora.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'art'];

// The fur's edge is what outlines it on the light nav.
const store = useMainStore();
const furEdge = computed(() => (store.isDarkMode ? '#D3D1C7' : '#B4B2A9'));
</script>

<style scoped>
/* Background-colored halo keeps the hat apart from the icon. */
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

/* A slight sway every few seconds. */
@media (prefers-reduced-motion: no-preference) {
    .hat {
        animation: sway 6s ease-in-out infinite;
    }
}

@keyframes sway {
    0%, 80%, 100% { transform: rotate(0deg); }
    86% { transform: rotate(3deg); }
    93% { transform: rotate(-2deg); }
}
</style>
