<template>
    <div class="relative">
        <!-- Fanous lanterns hanging from the nav's bottom edge: two per corner
             (a short outer one, a longer inner one) and two across the middle.
             Each sways from its thread's top. Phones keep the outer pair and
             the first middle one. -->
        <svg v-for="l in LANTERNS" :key="l.x" :class="{ 'max-sm:hidden': l.wideOnly }"
            class="absolute top-0 -translate-x-1/2 overflow-visible" :style="{ left: l.x }" width="24"
            :height="l.len + 28" :viewBox="`-12 0 24 ${l.len + 28}`" xmlns="http://www.w3.org/2000/svg">
            <g class="sway" :style="{ animationDelay: l.delay }">
                <line class="text-muted-foreground" :y2="l.len" stroke="currentColor" stroke-width="0.6"
                    stroke-opacity="0.7" />
                <g :transform="`translate(0 ${l.len})`">
                    <circle cy="1.3" r="1.3" fill="none" stroke="#B8860B" stroke-width="0.8" />
                    <path d="M0 2.6 Q5 3.4 7 7.4 H-7 Q-5 3.4 0 2.6 Z" fill="#B8860B" />
                    <path d="M-7 7.4 H7 L8 20 H-8 Z" :fill="teal" />
                    <path d="M-5 9.4 H5 L5.8 18 H-5.8 Z" fill="#FEF3C7" />
                    <line y1="9.4" y2="18" :stroke="teal" stroke-width="0.9" />
                    <path d="M-8.5 20 H8.5 L5 23.5 H-5 Z" fill="#B8860B" />
                    <circle cy="25" r="1.1" fill="#B8860B" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Eid al-Fitr nav trim: fanous lanterns hanging below the nav bar's corners and middle.
import { computed } from 'vue';
import { useMainStore } from '@/store';

// Thread length in px (the lantern below is ~18 × 26); delays keep them swaying out of phase.
const LANTERNS = [
    { x: '14px', len: 22, delay: '0s' },
    { x: '44px', len: 36, delay: '-2s', wideOnly: true },
    { x: '30%', len: 22, delay: '-3s' },
    { x: '70%', len: 14, delay: '-5s', wideOnly: true },
    { x: 'calc(100% - 44px)', len: 36, delay: '-4s', wideOnly: true },
    { x: 'calc(100% - 14px)', len: 22, delay: '-1s' },
];

// A lighter teal on the dark nav, where the deep one would sink.
const store = useMainStore();
const teal = computed(() => (store.isDarkMode ? '#0D9488' : '#0F766E'));
</script>

<style scoped>
/* Pivot on the thread's top: the group's box starts there, centred on it. */
.sway {
    transform-box: fill-box;
    transform-origin: 50% 0;
}

/* A slow sway of a few degrees. */
@media (prefers-reduced-motion: no-preference) {
    .sway {
        animation: sway 6s ease-in-out infinite;
    }
}

@keyframes sway {
    0%, 100% { transform: rotate(-3deg); }
    50% { transform: rotate(3deg); }
}
</style>
