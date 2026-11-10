<template>
    <!-- Brand.vue's viewBox: a sugar skull with a marigold on its crown,
         tucked into the fedora's band on the right. Halo layer first, so the
         background gap shows only where the skull meets the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(404 128) scale(1.9)">
            <g v-for="layer in LAYERS" :key="layer" :class="layer">
                <path :d="SKULL" fill="#fafafa" :stroke="layer === 'art' ? skullEdge : null" stroke-width="5"
                    stroke-linejoin="round" />
                <template v-if="layer === 'art'">
                    <ellipse v-for="dir in [-1, 1]" :key="dir" :cx="dir * 11" cy="-2" rx="9" ry="10"
                        fill="#312e81" />
                    <path d="M0 9 L-3.5 15 H3.5 Z" fill="#312e81" />
                    <circle cx="-19" cy="11" r="3.5" fill="#db2777" />
                    <circle cx="19" cy="11" r="3.5" fill="#0d9488" />
                </template>
                <g transform="translate(0 -28) scale(0.55)">
                    <path class="petals" :d="PETALS" fill="#f97316" />
                    <circle v-if="layer === 'art'" r="11" fill="#facc15" />
                </g>
            </g>
        </g>
    </svg>
</template>

<script setup>
// Día de los Muertos logo part: a sugar skull crowned with a marigold on the brand icon's hat band.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'art'];

// 52 × 58 skull centred on the origin: round cranium over a narrower jaw.
const SKULL = 'M-26 -2 C-26 -22 -14 -30 0 -30 C14 -30 26 -22 26 -2 C26 8 20 12 16 14 V24'
    + ' Q16 28 12 28 H-12 Q-16 28 -16 24 V14 C-20 12 -26 8 -26 -2 Z';

// Eight touching lobes around the origin, ~56 across.
const PETALS = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    const at = (r, t) => `${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`;
    return `M0 0 L${at(22, a - Math.PI / 8)} Q${at(36, a)} ${at(22, a + Math.PI / 8)} Z`;
}).join(' ');

// The white skull needs an edge on the light nav only.
const store = useMainStore();
const skullEdge = computed(() => (store.isDarkMode ? null : '#B4B2A9'));
</script>

<style scoped>
/* Background-colored halo keeps the skull apart from the icon. */
.halo path {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 14;
    stroke-linejoin: round;
}

/* The marigold is drawn at 0.55, so its halo stroke is wider to match. */
.halo .petals {
    stroke-width: 26;
}

.petals {
    transform-box: fill-box;
    transform-origin: 50% 50%;
}

/* The marigold turns very slowly. */
@media (prefers-reduced-motion: no-preference) {
    .petals {
        animation: turn 20s linear infinite;
    }
}

@keyframes turn {
    to { transform: rotate(360deg); }
}
</style>
