<template>
    <!-- A laurel garland: leaves ride the cord on alternating sides, angled
         along its slope; a leaf pair hangs at each scallop's low point. -->
    <Garland>
        <template #cord="{ points, at }">
            <template v-for="p in points" :key="p.i">
                <path v-for="(t, k) in CORD_TS" :key="k" :d="LEAF" :fill="cycle(CORD_GREENS, p.i * 4 + k)"
                    :transform="cordLeaf(at(p.i, t), k, p.i * 4 + k)" />
            </template>
        </template>

        <template #default="{ i }">
            <path v-for="(turn, j) in cycle(SPREADS, i)" :key="turn" :d="LEAF" :fill="cycle(PAIR_GREENS, i + j)"
                :transform="`rotate(${turn})`" />
        </template>
    </Garland>
</template>

<script setup>
// Earth Day footer trim: a laurel-style leaf garland along the footer cord.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// A 10 × 6 leaf pointing +x from its stalk at the origin.
const LEAF = 'M0 0 C3 -4.2 7.5 -4.2 10 0 C7.5 4.2 3 4.2 0 0 Z';

// Four leaves per scallop, off the low point the pair hangs from. ±30° off
// the cord keeps the upward ones inside the garland's top edge.
const CORD_TS = [0.1, 0.3, 0.7, 0.9];
const OFFSET = 30;

// Coprime lengths (3 and 5 against 4 per scallop; 4 × 3 for the pairs)
// keep neighbours from repeating as a group.
const CORD_GREENS = ['#16a34a', '#22c55e', '#15803d'];
const SIZES = [1, 0.85, 1.05, 0.9, 0.95];
const PAIR_GREENS = ['#4ade80', '#16a34a', '#22c55e', '#15803d'];
const SPREADS = [[60, 120], [70, 110], [55, 115]];

const cordLeaf = ({ x, y, angle }, k, n) =>
    `translate(${x} ${y}) rotate(${angle + (k % 2 ? OFFSET : -OFFSET)}) scale(${cycle(SIZES, n)})`;
</script>
