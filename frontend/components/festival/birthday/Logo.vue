<template>
    <!-- Brand.vue's viewBox: a tilted cone party hat seated on the fedora's
         crown, its pompom ~10px above the icon. Halo layer first, so the
         background gap shows only where the hat meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g class="party-hat">
            <g v-for="layer in LAYERS" :key="layer" :class="layer" transform="translate(0 -10) rotate(12 255 50)">
                <path :fill="cone" d="M165 45 Q255 72 345 45 L263 -168 Q255 -180 247 -168 Z" />
                <template v-if="layer === 'art'">
                    <circle v-for="d in DOTS" :key="d.x" :cx="d.x" :cy="d.y" :r="d.r" fill="#FAC775" />
                </template>
                <circle fill="#ED93B1" cx="255" cy="-180" r="30" />
            </g>
        </g>
    </svg>
</template>

<script setup>
// Site-birthday logo part: a party hat stacked on the brand icon's fedora.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'art'];

// Polka dots inside the upright cone (the group tilts it).
const DOTS = [
    { x: 212, y: 22, r: 15 },
    { x: 296, y: 14, r: 15 },
    { x: 252, y: -40, r: 14 },
    { x: 234, y: -88, r: 11 },
    { x: 272, y: -112, r: 10 },
];

const store = useMainStore();
const cone = computed(() => (store.isDarkMode ? '#9F99E8' : '#7F77DD'));
</script>

<style scoped>
/* Background-colored halo keeps the hat apart from the icon. */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 24;
    stroke-linejoin: round;
}

.party-hat {
    transform-box: fill-box;
    transform-origin: 50% 100%;
}

/* A little wobble every few seconds. */
@media (prefers-reduced-motion: no-preference) {
    .party-hat {
        animation: wobble 6s ease-in-out infinite;
    }
}

@keyframes wobble {
    0%, 80%, 100% { transform: rotate(0deg); }
    86% { transform: rotate(5deg); }
    93% { transform: rotate(-3deg); }
}
</style>
