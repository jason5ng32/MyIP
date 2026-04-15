<script setup>
import { TabsTrigger } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  value: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <TabsTrigger
    :value="value"
    :disabled="disabled"
    :class="cn('inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm', $props.class)"
  >
    <slot />
  </TabsTrigger>
</template>
