<script setup>
import { ComboboxEmpty } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({ class: { type: null, required: false } });
</script>

<template>
  <ComboboxEmpty :class="cn('py-6 text-center text-sm text-muted-foreground', props.class)">
    <slot />
  </ComboboxEmpty>
</template>
