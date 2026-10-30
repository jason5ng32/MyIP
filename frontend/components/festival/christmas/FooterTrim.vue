<template>
    <!-- A stocking on every scallop; colour, toe side and drop each cycle on their own. -->
    <Garland v-slot="{ i }">
        <template v-for="p in [piece(i)]" :key="i">
            <line :y2="p.drop" class="text-muted-foreground" stroke="currentColor" stroke-opacity="0.6"
                stroke-width="0.6" />
            <g :transform="`translate(0 ${p.drop})${p.flip ? ' scale(-1 1)' : ''}`">
                <defs v-if="p.striped">
                    <pattern :id="`${uid}-${i}`" patternUnits="userSpaceOnUse" width="4" height="4"
                        patternTransform="rotate(-35)">
                        <rect width="4" height="4" :fill="colors.white" />
                        <rect width="4" height="2" fill="#E24B4A" />
                    </pattern>
                </defs>
                <path :d="LEG" :fill="p.striped ? `url(#${uid}-${i})` : p.fill"
                    :stroke="p.striped ? colors.edge : null" stroke-width="0.6" />
                <path :d="HEEL" :fill="p.patch" />
                <path :d="TOE" :fill="p.patch" />
                <rect x="-5.2" width="10.4" height="4.4" rx="1.2" :fill="colors.white" :stroke="colors.edge"
                    stroke-width="0.6" />
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Christmas footer trim: stockings of mixed colours hung along the garland.
import { computed, useId } from 'vue';
import { useMainStore } from '@/store';
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (4 × 3 × 5) keep neighbours from repeating as a group.
const STOCKINGS = [
    { fill: '#E24B4A', patch: '#F09595' },
    { fill: '#3B6D11', patch: '#639922' },
    { striped: true, patch: '#E24B4A' },
    { fill: '#EF9F27', patch: '#FAC775' },
];
const FLIPS = [false, false, true];
const DROPS = [3, 9, 5, 12, 6];

// Origin = the cuff's top centre, toe pointing right; ~14 × 20.
const LEG = 'M-4.2 3.5 V13.4 Q-4.2 19.5 1.2 19.5 H5.8 Q9 19.5 9 16.3 Q9 13.4 5.8 13.2 Q4.4 13 4.2 11.4 V3.5 Z';
const HEEL = 'M-4.2 14 Q-4.2 19.5 1.2 19.5 Q-0.6 16.2 -4.2 14 Z';
const TOE = 'M5.4 13.2 Q9 13.3 9 16.3 Q9 19.5 5.8 19.5 Q4.2 16.4 5.4 13.2 Z';

const piece = (i) => ({ ...cycle(STOCKINGS, i), flip: cycle(FLIPS, i), drop: cycle(DROPS, i) });

const uid = useId();

// White needs an edge on the light page and would glare on the dark one.
const store = useMainStore();
const colors = computed(() => (store.isDarkMode
    ? { white: '#D3D1C7', edge: null }
    : { white: '#FFFFFF', edge: '#D3D1C7' }));
</script>
