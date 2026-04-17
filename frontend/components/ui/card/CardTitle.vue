<script setup>
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <h3 :class="cn('text-2xl font-semibold leading-none tracking-tight', $props.class)">
    <slot />
  </h3>
</template>
