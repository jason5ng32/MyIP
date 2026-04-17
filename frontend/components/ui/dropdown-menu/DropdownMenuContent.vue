<script setup>
import { DropdownMenuContent, DropdownMenuPortal } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  align: { type: String, default: 'end' }, // start | center | end
  sideOffset: { type: Number, default: 4 },
});
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :align="align"
      :side-offset="sideOffset"
      :class="cn('z-[10003] min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95', $props.class)"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
