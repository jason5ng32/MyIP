<script setup>
import { SelectContent, SelectPortal, SelectViewport } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  position: { type: String, default: 'popper' },
});
</script>

<template>
  <SelectPortal>
    <SelectContent
      :position="position"
      :class="cn(
        'relative z-[10003] max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        $props.class
      )"
    >
      <SelectViewport
        class="p-1"
        :class="position === 'popper' && 'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)]'"
      >
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
