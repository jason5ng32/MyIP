<!-- FitText — auto-fit text span. Wrapping it as a component lets each
     v-for iteration own its observer. Use `:max-lines="2"` together
     with a `#prefix` slot to keep an inline icon riding the first line. -->
<template>
    <span ref="el" :class="[cls, layoutClass]"><slot name="prefix" />{{ text }}</span>
</template>

<script setup>
import { ref, toRef, computed } from 'vue';
import { useFitText } from '@/composables/use-fit-text.js';

const props = defineProps({
    text: { type: String, default: '' },
    tiers: { type: Array, required: true },
    maxLines: {
        type: Number,
        default: 1,
        validator: (v) => v === 1 || v === 2,
    },
});

const el = ref(null);
const cls = useFitText(el, toRef(props, 'text'), props.tiers, {
    maxLines: props.maxLines,
});

// break-all lets a full IPv6 wrap mid-string in 2-line mode.
// leading-tight keeps line-height compact so sibling icons line up
// across tiers.
const layoutClass = computed(() => props.maxLines > 1
    ? 'line-clamp-2 break-all leading-tight'
    : 'whitespace-nowrap truncate leading-tight');
</script>
