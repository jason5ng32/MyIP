<template>
    <Garland :spacing="SPACING">
        <!-- Bunting: three pennants riding each scallop, each with a small crescent or star. -->
        <template #cord="{ points, at }">
            <g v-for="f in pennants(points, at)" :key="f.key"
                :transform="`translate(${f.x} ${f.y}) rotate(${f.angle})`">
                <path d="M-9 0 H9 L0 16 Z" :fill="f.color === 'teal' ? teal : '#B8860B'" />
                <path v-if="f.mark === 'crescent'" :d="CRESCENT" fill="#FEF3C7"
                    transform="translate(0.4 5) scale(0.12)" />
                <path v-else :d="STAR" fill="#FEF3C7" transform="translate(0 5.2)" />
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Eid al-Fitr footer trim: crescent-and-star bunting along the footer garland.
import { computed } from 'vue';
import { useMainStore } from '@/store';
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Wide scallops fit three 18-wide pennants with a little air between them.
const SPACING = 84;
const PENNANT_T = [0.25, 0.5, 0.75];

// Coprime trait lengths (2 × 5); the index runs on across scallops.
const COLORS = ['teal', 'gold'];
const MARKS = ['crescent', 'star', 'crescent', 'crescent', 'star'];

const pennants = (points, at) => points.flatMap((p) => PENNANT_T.map((t, k) => {
    const n = p.i * PENNANT_T.length + k;
    return { key: n, color: cycle(COLORS, n), mark: cycle(MARKS, n), ...at(p.i, t) };
}));

// ~40 × 46 crescent around the origin (scaled to ~5); a 5.6-wide star centred on it.
const CRESCENT = 'M6 -22 C-10 -22 -20 -10 -20 2 C-20 14 -10 24 4 24 C10 24 14 22 18 18'
    + ' C6 20 -6 12 -6 0 C-6 -10 0 -18 10 -21 C8 -22 7 -22 6 -22 Z';
const STAR = 'M0 -2.8 L0.68 -0.93 L2.66 -0.87 L1.09 0.36 L1.65 2.27 L0 1.15 L-1.65 2.27'
    + ' L-1.09 0.36 L-2.66 -0.87 L-0.68 -0.93 Z';

// A lighter teal on the dark page, where the deep one would sink.
const store = useMainStore();
const teal = computed(() => (store.isDarkMode ? '#0D9488' : '#0F766E'));
</script>
