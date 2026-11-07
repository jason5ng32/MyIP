<template>
    <Garland>
        <!-- Bunting: pennants riding the cord, colours flowing across scallops. -->
        <template #cord="{ points, at }">
            <path v-for="f in pennants(points, at)" :key="f.key" d="M-5 0 H5 L0 12 Z" :fill="f.color"
                :transform="`translate(${f.x} ${f.y}) rotate(${f.angle})`" />
        </template>

        <!-- Some scallops also hang a party piece below the pennants. -->
        <template #default="{ i }">
            <g v-if="cycle(HANGS, i)">
                <line class="text-muted-foreground" :y2="cycle(DROPS, i)" stroke="currentColor"
                    stroke-opacity="0.6" stroke-width="0.6" />
                <g :transform="`translate(0 ${cycle(DROPS, i)})`">
                    <!-- Party hat, 13 × 17, hung by its pompom. -->
                    <g v-if="cycle(KINDS, i) === 'hat'">
                        <path d="M0 2.4 L6 16 H-6 Z" fill="#7F77DD" />
                        <circle v-for="d in HAT_DOTS" :key="d[1]" :cx="d[0]" :cy="d[1]" r="0.8" fill="#FAC775" />
                        <rect x="-6.6" y="15.2" width="13.2" height="1.8" rx="0.9" fill="#EF9F27" />
                        <circle cy="1.6" r="1.8" fill="#EF9F27" />
                    </g>

                    <!-- Gift box, 12 × 15: lid, body, ribbon and bow. -->
                    <g v-else-if="cycle(KINDS, i) === 'gift'">
                        <rect x="-5.2" y="6.8" width="10.4" height="8.4" rx="0.5" fill="#1D9E75" />
                        <rect x="-5.8" y="4" width="11.6" height="3" rx="0.5" fill="#0F6E56" />
                        <rect x="-1" y="4" width="2" height="11.2" fill="#FAC775" />
                        <ellipse cx="-2.2" cy="2.2" rx="2.4" ry="1.3" fill="#EF9F27" transform="rotate(-25 -2.2 2.2)" />
                        <ellipse cx="2.2" cy="2.2" rx="2.4" ry="1.3" fill="#EF9F27" transform="rotate(25 2.2 2.2)" />
                        <circle cy="3" r="1" fill="#EF9F27" />
                    </g>

                    <!-- Curled streamer with a few bits of confetti. -->
                    <g v-else>
                        <path d="M0 0 C4 2 4 6 0 6 C-4 6 -4 10 0 10 C4 10 4 14 0 14 C-3 14 -3 17 0 18" fill="none"
                            stroke="#D4537E" stroke-width="1.6" stroke-linecap="round" />
                        <rect x="-1.5" y="-0.9" width="3" height="1.8" rx="0.4" fill="#378ADD"
                            transform="translate(-4.4 8) rotate(30)" />
                        <rect x="-1.5" y="-0.9" width="3" height="1.8" rx="0.4" fill="#EF9F27"
                            transform="translate(4.4 13) rotate(-20)" />
                        <circle cx="-3.6" cy="16" r="0.9" fill="#7F77DD" />
                    </g>
                </g>
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Founder's-birthday footer trim: bunting along the footer garland, with party pieces hung from some scallops.
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// Four pennants per scallop; the colour index runs on across scallops.
const PENNANT_T = [0.15, 0.38, 0.62, 0.85];
const PENNANT_COLORS = ['#7F77DD', '#EF9F27', '#1D9E75', '#D4537E', '#378ADD'];
const pennants = (points, at) => points.flatMap((p) => PENNANT_T.map((t, k) => {
    const n = p.i * PENNANT_T.length + k;
    return { key: n, color: cycle(PENNANT_COLORS, n), ...at(p.i, t) };
}));

// Hanging pieces: traits cycle on coprime lengths (2 × 3 × 5), so every
// other scallop still sees every kind and drop.
const HANGS = [true, false];
const KINDS = ['hat', 'gift', 'streamer'];
const DROPS = [6, 12, 8, 14, 10];

// Polka dots inside the hat's cone.
const HAT_DOTS = [[0.4, 5.6], [-1, 8], [1.8, 11.5], [-2.8, 13.6]];
</script>
