<script setup>
import { ToggleGroupItem } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  value: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <ToggleGroupItem
    :value="value"
    :disabled="disabled"
    :class="cn('inline-flex h-9 items-center justify-center rounded-md border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground data-[state=on]:font-bold', $props.class)"
  >
    <slot />
  </ToggleGroupItem>
</template>
