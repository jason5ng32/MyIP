<template>
    <Garland>
        <template #default="{ i }">
            <g v-for="p in [piece(i)]" :key="i">
                <line class="text-muted-foreground" :y2="p.drop" stroke="currentColor" stroke-opacity="0.6"
                    stroke-width="0.6" />

                <!-- Lantern, 16 × 24 at scale 1: gold caps, ribbed red body, short tassel. -->
                <g v-if="p.kind === 'lantern'" :transform="`translate(0 ${p.drop}) scale(${p.scale})`">
                    <path d="M0 20.6 V24.4 M-1 21 L-1.5 24.2 M1 21 L1.5 24.2" stroke="#EF9F27" stroke-width="0.9"
                        stroke-linecap="round" />
                    <ellipse cy="10.5" rx="8" ry="8.4" fill="#E24B4A" />
                    <ellipse cy="10.5" rx="4.4" ry="8.4" fill="none" stroke="#A32D2D" stroke-width="0.6" />
                    <path d="M0 2.1 V18.9" stroke="#A32D2D" stroke-width="0.6" />
                    <rect x="-4.4" width="8.8" height="2.6" rx="0.6" fill="#EF9F27" />
                    <rect x="-4.4" y="18" width="8.8" height="2.6" rx="0.6" fill="#EF9F27" />
                </g>

                <!-- Red envelope, 12 × 16, slightly tilted: dark flap, gold seal. -->
                <g v-else :transform="`translate(0 ${p.drop}) rotate(5)`">
                    <rect x="-6" width="12" height="16" rx="1.2" fill="#E24B4A" />
                    <path d="M-6 1.2 Q-6 0 -4.8 0 H4.8 Q6 0 6 1.2 V4 Q0 9.5 -6 4 Z" fill="#A32D2D"
                        fill-opacity="0.45" />
                    <circle cy="6.8" r="2" fill="#EF9F27" />
                    <path d="M-3.4 12.8 H3.4" stroke="#EF9F27" stroke-width="0.7" stroke-linecap="round" />
                </g>
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Lunar New Year footer trim: red lanterns of varied size, and the odd red envelope, along the footer garland.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Traits cycle on coprime lengths (4 × 3 × 5).
const KINDS = ['lantern', 'lantern', 'envelope', 'lantern'];
const SCALES = [1, 0.8, 0.9];
const DROPS = [3, 9, 6, 12, 4];

const piece = (i) => ({ kind: cycle(KINDS, i), scale: cycle(SCALES, i), drop: cycle(DROPS, i) });
</script>
