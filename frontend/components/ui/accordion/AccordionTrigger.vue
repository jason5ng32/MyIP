<script setup>
import { AccordionTrigger, AccordionHeader } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <AccordionHeader class="flex m-0 text-base font-normal leading-normal">
    <!-- reka-ui renders AccordionHeader as <h3>; neutralize the project's
         global base h3 styles (margin-bottom / font-size / line-height /
         font-weight from style.css @layer base) so the trigger row isn't
         pushed down by the heading reset. -->

    <AccordionTrigger
      :class="cn('flex flex-1 items-center justify-between py-3 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180', $props.class)"
    >
      <slot />
      <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionTrigger>
  </AccordionHeader>
</template>
