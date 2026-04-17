<script setup>
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <p :class="cn('text-sm text-muted-foreground', $props.class)">
    <slot />
  </p>
</template>
