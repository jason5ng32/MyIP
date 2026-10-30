<template>
    <!-- Full-width cord in the footer's top padding. The default slot draws
         one piece per scallop, with its hang point at (0, 0); `cord` draws
         anything riding the cord itself (bunting). -->
    <div ref="root" class="relative h-12 w-full">
        <svg v-if="width" class="absolute inset-0" :width="width" height="48" xmlns="http://www.w3.org/2000/svg">
            <path :d="layout.path" class="text-muted-foreground" fill="none" stroke="currentColor"
                stroke-opacity="0.6" stroke-width="0.8" />
            <slot name="cord" :points="layout.points" :at="at" />
            <g v-for="p in layout.points" :key="p.i" :transform="`translate(${p.x} ${p.y})`">
                <g>
                    <!-- SMIL keeps the pivot on the hang point; no CSS transform-origin guesswork. -->
                    <animateTransform v-if="sway" attributeName="transform" type="rotate" values="-3;3;-3"
                        :dur="`${SWAY_S}s`" :begin="`${-((p.i * 1.7) % SWAY_S)}s`" repeatCount="indefinite"
                        calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" />
                    <slot :i="p.i" />
                </g>
            </g>
        </svg>
    </div>
</template>

<script setup>
// Footer garland host shared by every skin's FooterTrim.vue: measures the
// footer width and lays out the cord (utils/features/festival-garland.js).
import { computed, ref } from 'vue';
import { useElementSize, usePreferredReducedMotion } from '@vueuse/core';
import { GARLAND_DEFAULTS, garlandLayout, scallopPoint } from '@/utils/features/festival-garland.js';

const props = defineProps({
    spacing: { type: Number, default: GARLAND_DEFAULTS.spacing },
    sag: { type: Number, default: GARLAND_DEFAULTS.sag },
    // Pieces sway gently unless the skin opts out or the visitor reduces motion.
    swaying: { type: Boolean, default: true },
});

const SWAY_S = 6;

const root = ref(null);
const { width } = useElementSize(root);
const motion = usePreferredReducedMotion();

const opts = computed(() => ({ spacing: props.spacing, sag: props.sag, top: GARLAND_DEFAULTS.top }));
const layout = computed(() => garlandLayout(width.value, opts.value));
const at = (i, t) => scallopPoint(i, t, opts.value);
const sway = computed(() => props.swaying && motion.value !== 'reduce');
</script>
