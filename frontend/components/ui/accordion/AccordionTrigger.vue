<script setup>
import { AccordionTrigger, AccordionHeader } from 'reka-ui';
import { ChevronDown } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      :class="cn('flex flex-1 items-center justify-between py-3 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180', $props.class)"
    >
      <slot />
      <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionTrigger>
  </AccordionHeader>
</template>
