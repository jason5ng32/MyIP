<script setup>
import { SelectTrigger, SelectIcon } from 'reka-ui';
import { ChevronDown } from '@lucide/vue';
import { cn } from '@/lib/utils';

defineProps({ class: { type: [String, Array, Object], default: undefined } });
</script>

<template>
  <SelectTrigger
    :class="cn('flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:overflow-hidden [&>span]:whitespace-nowrap', $props.class)"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="h-4 w-4 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
