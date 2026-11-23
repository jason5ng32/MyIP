<template>
    <Garland :spacing="64" :sag="4">
        <!-- Marigold petals riding the cord; a banner covers its own scallop's cord. -->
        <template #cord="{ points, at }">
            <template v-for="p in points.filter((q) => cycle(KINDS, q.i) === 'marigolds')" :key="p.i">
                <ellipse v-for="f in petals(at, p.i)" :key="f.t" rx="2.5" ry="1.5" fill="#f97316"
                    :transform="`translate(${f.x} ${f.y}) rotate(${f.angle})`" />
            </template>
        </template>

        <!-- Papel picado banners alternating with marigold strings; colour,
             centre cut and blossom shades each cycle on their own. -->
        <template #default="{ i }">
            <template v-for="p in [piece(i)]" :key="i">
                <g v-if="p.kind === 'banner'">
                    <path :d="BANNER" :fill="p.fill" />
                    <g class="cut">
                        <circle v-if="p.cut === 'circle'" cy="10" r="4.5" />
                        <path v-else-if="p.cut === 'diamond'" d="M0 5 L4.5 10 L0 15 L-4.5 10 Z" />
                        <template v-else>
                            <circle v-for="[cx, cy] in FLOWER" :key="`${cx} ${cy}`" :cx="cx" :cy="cy" r="2" />
                        </template>
                        <circle cx="-14" cy="9" r="2.2" />
                        <circle cx="14" cy="9" r="2.2" />
                        <rect x="-24" y="16" width="48" height="1.8" />
                    </g>
                </g>

                <!-- Three blossoms strung down a short thread. -->
                <g v-else>
                    <line y2="21" class="text-muted-foreground" stroke="currentColor" stroke-opacity="0.6"
                        stroke-width="0.6" />
                    <g v-for="(fill, k) in p.shades" :key="k" :transform="`translate(0 ${5 + k * 8}) scale(0.14)`">
                        <path :d="PETALS" :fill="fill" />
                        <circle r="11" :fill="CENTRE" />
                    </g>
                </g>
            </template>
        </template>
    </Garland>
</template>

<script setup>
// Día de los Muertos footer trim: papel picado banners and marigold strings along the garland.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Coprime trait lengths (2 × 5 × 3) keep neighbours from repeating as a group;
// banners land on every other scallop, so each still meets all five colours.
const KINDS = ['banner', 'marigolds'];
const PALETTE = ['#db2777', '#7c3aed', '#0d9488', '#f97316', '#eab308'];
const CUTS = ['circle', 'diamond', 'flower'];
const SHADES = [
    ['#f97316', '#ea580c', '#f97316'],
    ['#ea580c', '#f97316', '#eab308'],
    ['#f97316', '#eab308', '#ea580c'],
];
const CENTRE = '#facc15';

const piece = (i) => ({
    kind: cycle(KINDS, i),
    fill: cycle(PALETTE, i),
    cut: cycle(CUTS, i),
    shades: cycle(SHADES, i),
});

// Where the cord petals sit along each scallop, laid along the cord.
const PETAL_TS = [0.2, 0.5, 0.8];
const petals = (at, i) => PETAL_TS.map((t) => ({ t, ...at(i, t) }));

// Origin = the banner's top centre at the hang point; 68 × 26, zig-zag cut bottom edge.
const BANNER = 'M-34 0 H34 V26 L28.3 21 L22.7 26 L17 21 L11.3 26 L5.7 21 L0 26'
    + ' L-5.7 21 L-11.3 26 L-17 21 L-22.7 26 L-28.3 21 L-34 26 Z';
const FLOWER = [[0, 7], [3, 10], [0, 13], [-3, 10]];

// Eight touching lobes, ~56 across; drawn at 0.14 for r ≈ 4.
const PETALS = Array.from({ length: 8 }, (_, k) => {
    const a = (k * Math.PI) / 4;
    const at = (r, t) => `${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`;
    return `M0 0 L${at(22, a - Math.PI / 8)} Q${at(36, a)} ${at(22, a + Math.PI / 8)} Z`;
}).join(' ');
</script>

<style scoped>
/* Cut-outs show the page through them. */
.cut {
    fill: var(--background);
}
</style>
