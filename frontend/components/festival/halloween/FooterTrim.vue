<template>
    <!-- Pumpkins, bats and ghosts along the garland; kind and drop cycle on their own. -->
    <Garland v-slot="{ i }">
        <template v-for="p in [piece(i)]" :key="i">
            <line :y2="p.drop" class="text-muted-foreground" stroke="currentColor" stroke-opacity="0.6"
                stroke-width="0.6" />
            <g :transform="`translate(0 ${p.drop})`">
                <!-- Jack-o'-lantern hung by its stem. -->
                <g v-if="p.kind === 'pumpkin'">
                    <path d="M-0.9 3.2 Q-1.1 1.2 -0.2 0 L1 0.4 Q0.4 1.6 0.9 3.2 Z" fill="#3B6D11" />
                    <path d="M0.6 1.2 Q2.8 0 3.4 1.8" fill="none" stroke="#3B6D11" stroke-width="0.6"
                        stroke-linecap="round" />
                    <ellipse v-for="l in LOBES" :key="l.cx" :cx="l.cx" cy="9.2" rx="4.4" :ry="l.ry"
                        fill="#EF9F27" stroke="#BA7517" stroke-width="0.5" />
                    <path :d="PUMPKIN_FACE" fill="#633806" />
                </g>

                <!-- Bat hanging upside down by its feet, wings half open. -->
                <g v-else-if="p.kind === 'bat'" :fill="colors.bat">
                    <path d="M-0.9 0 V1.8 M0.9 0 V1.8" :stroke="colors.bat" stroke-width="0.7"
                        stroke-linecap="round" />
                    <path :d="WING" />
                    <path :d="WING" transform="scale(-1 1)" />
                    <ellipse cy="4.6" rx="2.3" ry="3.4" />
                    <circle cy="9.2" r="2.3" />
                    <path d="M-2 10 L-1.6 12.6 L-0.6 11.2 Z M2 10 L1.6 12.6 L0.6 11.2 Z" />
                    <circle cx="-0.8" cy="8.8" r="0.45" fill="#FAC775" />
                    <circle cx="0.8" cy="8.8" r="0.45" fill="#FAC775" />
                </g>

                <!-- Ghost held by the top of its head. -->
                <g v-else>
                    <path :d="GHOST" :fill="colors.ghost" :stroke="colors.ghostEdge" stroke-width="0.6"
                        stroke-linejoin="round" />
                    <ellipse cx="-2" cy="5.6" rx="0.9" ry="1.3" fill="#2C2C2A" />
                    <ellipse cx="2" cy="5.6" rx="0.9" ry="1.3" fill="#2C2C2A" />
                    <ellipse cy="8.8" rx="0.8" ry="1.1" fill="#2C2C2A" />
                </g>
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Halloween footer trim: jack-o'-lanterns, bats and ghosts hung along the garland.
import { computed } from 'vue';
import { useMainStore } from '@/store';
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (3 × 4) keep neighbours from repeating as a group.
const KINDS = ['pumpkin', 'bat', 'ghost'];
const DROPS = [4, 10, 6, 13];

const piece = (i) => ({ kind: cycle(KINDS, i), drop: cycle(DROPS, i) });

// Origin = each piece's hang point; every piece is ≤ 17 × 16.
const LOBES = [{ cx: -3.6, ry: 6.2 }, { cx: 3.6, ry: 6.2 }, { cx: 0, ry: 6.6 }];
const PUMPKIN_FACE = 'M-4.2 8 L-1.8 8 L-3 5.8 Z M4.2 8 L1.8 8 L3 5.8 Z'
    + ' M-4.4 10.4 L-3 11.4 L-1.5 10.6 L0 11.6 L1.5 10.6 L3 11.4 L4.4 10.4 Q2.4 14.4 0 14.2 Q-2.4 14.4 -4.4 10.4 Z';
// The right wing: from the hip out to its tip, scalloped back to the shoulder.
const WING = 'M1.6 3 Q5 1.4 8.4 3.2 Q8.6 6 6.6 9.2 Q5.8 7.6 4.6 8.4 Q4 6.8 2.4 7.6 Z';
const GHOST = 'M-6 7 Q-6 0 0 0 Q6 0 6 7 V15.5 Q5 14 4 15.5 Q3 17 2 15.5 Q1 14 0 15.5'
    + ' Q-1 17 -2 15.5 Q-3 14 -4 15.5 Q-5 17 -6 15.5 Z';

// The bat would vanish and the ghost glare on the dark page.
const store = useMainStore();
const colors = computed(() => (store.isDarkMode
    ? { bat: '#AFA9EC', ghost: '#D3D1C7', ghostEdge: null }
    : { bat: '#534AB7', ghost: '#FFFFFF', ghostEdge: '#B4B2A9' }));
</script>
