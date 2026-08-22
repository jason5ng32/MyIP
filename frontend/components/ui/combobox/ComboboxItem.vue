<script setup>
import { ComboboxItem, ComboboxItemIndicator, useForwardProps } from 'reka-ui';
import { Check } from '@lucide/vue';
import { cn } from '@/lib/utils';

const props = defineProps({
  value: { type: null, required: true },
  disabled: { type: Boolean, required: false },
  class: { type: null, required: false },
});
const forwarded = useForwardProps(props);
</script>

<template>
  <ComboboxItem
    v-bind="forwarded"
    :class="cn(
      'relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.class,
    )"
  >
    <slot />
    <ComboboxItemIndicator class="ml-auto">
      <Check class="size-4" />
    </ComboboxItemIndicator>
  </ComboboxItem>
</template>
