<template>
    <!-- The cord dusted with powder: specks riding on and just under each
         scallop, and a faint puff below every low point. -->
    <Garland :swaying="false">
        <template #cord="{ points, at }">
            <circle v-for="d in dust(points, at)" :key="d.n" :cx="d.x" :cy="d.y" :r="d.r" :fill="d.fill"
                :fill-opacity="d.o" />
        </template>
        <template #default="{ i }">
            <circle cy="4" r="7" :fill="cycle(PALETTE, i + 2)" fill-opacity="0.18" />
        </template>
    </Garland>
</template>

<script setup>
// Holi footer trim: coloured powder settled along the footer garland.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (6 × 5 × 7, jitter 11 × 13) keep specks from repeating as a group.
const PALETTE = ['#db2777', '#7c3aed', '#0ea5e9', '#22c55e', '#facc15', '#f97316'];
const RADII = [2.5, 1.5, 4, 2, 5];
const OPACITIES = [0.7, 0.5, 0.85, 0.6, 0.45, 0.8, 0.55];
const JITTER_X = [0, 2.5, -1.5, 3, -3, 1, -2, 2, -0.5, 1.5, -2.5];
const JITTER_Y = [0.5, 2, -0.5, 3.5, 1, 0, 2.5, -1, 1.5, 3, 0, 2, 1];

const PER_SCALLOP = 9;

// Specks spread evenly along each scallop (`at` gives the cord point), nudged by the jitter lists.
const dust = (points, at) => points.flatMap((p) => Array.from({ length: PER_SCALLOP }, (_, k) => {
    const n = p.i * PER_SCALLOP + k;
    const { x, y } = at(p.i, (k + 0.5) / PER_SCALLOP);
    return {
        n,
        x: x + cycle(JITTER_X, n),
        y: y + cycle(JITTER_Y, n),
        r: cycle(RADII, n),
        fill: cycle(PALETTE, n),
        o: cycle(OPACITIES, n),
    };
}));
</script>
