<template>
    <!-- A clothesline: each piece clipped straight onto the cord by a wooden peg. -->
    <Garland :sag="4">
        <template #default="{ i }">
            <g :transform="`rotate(${cycle(TILTS, i)})`">
                <path v-if="cycle(KINDS, i) === 'red-heart'" :d="HEART" fill="#D4537E"
                    transform="translate(0 6.6) scale(0.15)" />

                <path v-else-if="cycle(KINDS, i) === 'pink-heart'" :d="HEART" fill="#ED93B1"
                    transform="translate(0 6) scale(0.13)" />

                <!-- Love letter, 16 × 11: V flap and a heart seal. -->
                <g v-else-if="cycle(KINDS, i) === 'letter'">
                    <rect x="-8" y="2.5" width="16" height="11" rx="1" :fill="paper" stroke="#B4B2A9"
                        stroke-width="0.7" />
                    <path d="M-7.6 3 L0 9 L7.6 3" fill="none" stroke="#B4B2A9" stroke-width="0.7"
                        stroke-linejoin="round" />
                    <path :d="HEART" fill="#D4537E" transform="translate(0 9.2) scale(0.045)" />
                </g>

                <!-- Polaroid, 13 × 15: a pink photo of a heart above the deep bottom margin. -->
                <g v-else>
                    <rect x="-6.5" y="2.5" width="13" height="15" rx="0.6" :fill="paper" stroke="#B4B2A9"
                        stroke-width="0.6" />
                    <rect x="-5" y="4" width="10" height="9" fill="#F4C0D1" />
                    <path :d="HEART" fill="#D4537E" transform="translate(0 8.9) scale(0.06)" />
                </g>

                <rect x="-1" y="-1.6" width="2" height="5" rx="0.4" fill="#BA7517" />
            </g>
        </template>
    </Garland>
</template>

<script setup>
// Valentine's Day footer trim: hearts, love letters and polaroids pegged along the footer garland.
import { computed } from 'vue';
import { useMainStore } from '@/store';
import Garland from '@/components/festival/Garland.vue';
import { cycle } from '@/utils/features/festival-garland.js';

// 100 × 72 heart centred on the origin; its top notch sits 26 units up.
const HEART = 'M0 30 C-10 22 -50 0 -50 -18 C-50 -32 -38 -42 -25 -42 C-12 -42 -4 -34 0 -26'
    + ' C4 -34 12 -42 25 -42 C38 -42 50 -32 50 -18 C50 0 10 22 0 30 Z';

// Traits cycle on coprime lengths (4 × 3).
const KINDS = ['red-heart', 'letter', 'pink-heart', 'polaroid'];
const TILTS = [-8, 4, 10];

// White paper would glare on the near-black page.
const store = useMainStore();
const paper = computed(() => (store.isDarkMode ? '#D3D1C7' : '#FFFFFF'));
</script>
