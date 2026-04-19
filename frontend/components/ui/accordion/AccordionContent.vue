<script setup>
import { AccordionContent } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  forceMount: { type: Boolean, default: false },
});
</script>

<template>
  <AccordionContent
    :force-mount="forceMount"
    class="jn-accordion-content overflow-hidden text-sm"
  >
    <div :class="cn('pb-3 pt-0', $props.class)">
      <slot />
    </div>
  </AccordionContent>
</template>
