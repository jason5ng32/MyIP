<template>
    <!-- A marigold garland: beads riding the cord, a diya hung from every other scallop. -->
    <Garland>
        <template #cord="{ points, at }">
            <template v-for="p in points" :key="p.i">
                <circle v-for="(t, k) in BEAD_TS" :key="t" v-bind="beadAt(at(p.i, t), p.i * BEAD_TS.length + k)" />
            </template>
        </template>

        <!-- Hanging diya: chains from the hang point to the bowl's rim, flame between them. -->
        <template #default="{ i }">
            <g v-if="i % 2 === 0" :transform="`translate(0 ${cycle(DROPS, i / 2)})`">
                <line class="text-muted-foreground" :y1="-cycle(DROPS, i / 2)" stroke="currentColor"
                    stroke-opacity="0.6" stroke-width="0.6" />
                <path class="text-muted-foreground" d="M0 0 L-6 9 M0 0 L6 9" fill="none" stroke="currentColor"
                    stroke-opacity="0.6" stroke-width="0.6" />
                <g transform="translate(0 9)">
                    <path :d="FLAME" fill="#f59e0b" />
                    <path :d="LAMP" fill="#c2410c" />
                </g>
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Diwali footer trim: marigold beads along the garland cord and diyas hung below it.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Three beads per scallop, at these fractions of its span.
const BEAD_TS = [0.25, 0.5, 0.75];

// Coprime trait lengths (2 × 5 for beads, 3 for lamp drops) keep runs from repeating.
const BEAD_COLORS = ['#ea580c', '#f59e0b'];
const BEAD_RADII = [3.2, 2.7, 3, 3.4, 2.8];
const DROPS = [2, 7, 4];

const beadAt = ({ x, y }, j) => ({ cx: x, cy: y, r: cycle(BEAD_RADII, j), fill: cycle(BEAD_COLORS, j) });

// Origin = the bowl's rim centre: a 14 × 10 bowl below, the flame above.
const LAMP = 'M-7 0 C-7 7 -3 10 0 10 C3 10 7 7 7 0 Z';
const FLAME = 'M0 -7 C2.6 -3.6 2.6 -1 0 1 C-2.6 -1 -2.6 -3.6 0 -7 Z';
</script>
