<script setup>
import { ComboboxAnchor } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({ class: { type: null, required: false } });
</script>

<template>
  <ComboboxAnchor :class="cn('w-full', props.class)">
    <slot />
  </ComboboxAnchor>
</template>
