<script setup>
import { TooltipContent, TooltipPortal } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  side: { type: String, default: 'top' },
  sideOffset: { type: Number, default: 4 },
  align: { type: String, default: 'center' },
  alignOffset: { type: Number, default: 0 },
});
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      :side="side"
      :side-offset="sideOffset"
      :align="align"
      :align-offset="alignOffset"
      :class="cn('z-[10003] overflow-hidden rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95', $props.class)"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
