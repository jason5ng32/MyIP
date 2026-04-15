<script setup>
import { AccordionItem } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  value: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <AccordionItem
    :value="value"
    :disabled="disabled"
    :class="cn('border-b', $props.class)"
  >
    <slot />
  </AccordionItem>
</template>
