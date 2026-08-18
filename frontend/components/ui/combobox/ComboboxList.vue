<script setup>
import { ComboboxContent, ComboboxPortal, ComboboxViewport } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  class: { type: null, required: false },
  position: { type: String, required: false, default: 'popper' },
  align: { type: String, required: false, default: 'start' },
});
</script>

<template>
  <!-- Portalled for the same reason the Select content is: the Advanced Tools
       drawer is overflow-hidden, and an in-flow list gets clipped. -->
  <ComboboxPortal>
    <ComboboxContent
      :position="position"
      :align="align"
      :side-offset="4"
      :class="cn(
        'z-[10003] max-h-72 min-w-[8rem] w-[var(--reka-combobox-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        props.class,
      )"
    >
      <slot />
      <ComboboxViewport class="max-h-64 overflow-y-auto p-1">
        <slot name="items" />
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxPortal>
</template>
