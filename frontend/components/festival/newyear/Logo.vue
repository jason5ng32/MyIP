<template>
    <!-- Brand.vue's viewBox: three sparkles over the fedora's crown, a pink
         streamer along the brim and a gold one over the crown, both curling
         off the ends. Halo layer first, so the background gap shows only
         where they meet the icon. -->
    <svg class="size-full overflow-visible" viewBox="0 0 511 512.35" xmlns="http://www.w3.org/2000/svg">
        <g v-for="layer in LAYERS" :key="layer" :class="layer">
            <path v-for="s in SPARKS" :key="s.d" class="spark" :style="{ animationDelay: s.delay }" :d="s.d"
                :fill="colors[s.tone]" />
            <path v-for="r in RIBBONS" :key="r.d" class="ribbon" :d="r.d" fill="none" :stroke="colors[r.tone]"
                stroke-width="22" stroke-linecap="round" stroke-linejoin="round" />
        </g>
    </svg>
</template>

<script setup>
// New Year logo part: sparkles and confetti streamers on the brand icon's fedora.
import { computed } from 'vue';
import { useMainStore } from '@/store';

const LAYERS = ['halo', 'art'];

// Four-point sparkles (centers 96,-40 · 392,-120 · 250,-160); delays stagger the twinkle.
const SPARKS = [
    { tone: 'gold', delay: '0s',
        d: 'M96 -132 Q112.6 -56.6 188 -40 Q112.6 -23.4 96 52 Q79.4 -23.4 4 -40 Q79.4 -56.6 96 -132 Z' },
    { tone: 'deep', delay: '-1.4s',
        d: 'M392 -196 Q405.7 -133.7 468 -120 Q405.7 -106.3 392 -44 Q378.3 -106.3 316 -120 Q378.3 -133.7 392 -196 Z' },
    { tone: 'gold', delay: '-2.6s',
        d: 'M250 -206 Q258.3 -168.3 296 -160 Q258.3 -151.7 250 -114 Q241.7 -151.7 204 -160 Q241.7 -168.3 250 -206 Z' },
];

// Gold over the crown's right side, pink along the brim; each ends in a curl.
const RIBBONS = [
    { tone: 'ribbon',
        d: 'M300 150 C360 168 420 150 478 176 C520 194 500 236 478 226 C456 214 490 186 512 206 C534 226 520 262 500 280' },
    { tone: 'pink',
        d: 'M-6 300 C-30 262 26 240 30 272 C34 300 -10 296 4 258 C18 222 90 250 150 236 C230 218 300 256 370 236'
            + ' C410 224 440 214 470 222' },
];

// Paler golds and pink on the dark nav; deeper ones keep contrast on the light one.
const store = useMainStore();
const colors = computed(() => (store.isDarkMode
    ? { gold: '#FAC775', deep: '#EF9F27', ribbon: '#FAC775', pink: '#ED93B1' }
    : { gold: '#EF9F27', deep: '#BA7517', ribbon: '#BA7517', pink: '#D4537E' }));
</script>

<style scoped>
/* Background-colored halo keeps the decorations apart from the icon. */
.halo > * {
    fill: var(--background);
    stroke: var(--background);
    stroke-width: 24;
    stroke-linejoin: round;
}

.halo > .ribbon {
    fill: none;
    stroke-width: 46;
}

.spark {
    transform-box: fill-box;
    transform-origin: center;
}

/* Each sparkle briefly shrinks and returns, out of step with the others. */
@media (prefers-reduced-motion: no-preference) {
    .spark {
        animation: twinkle 4s ease-in-out infinite;
    }
}

@keyframes twinkle {
    0%, 70%, 100% { transform: scale(1); }
    85% { transform: scale(0.55); }
}
</style>
