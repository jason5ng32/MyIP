<script setup>
import { DropdownMenuLabel } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <DropdownMenuLabel :class="cn('px-2 py-1.5 text-sm font-semibold', $props.class)">
    <slot />
  </DropdownMenuLabel>
</template>
