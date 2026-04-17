<script setup>
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div
    :class="cn('rounded-lg border bg-card text-card-foreground shadow-[0_0_13px_rgb(0_0_0_/_0.11)]', $props.class)"
  >
    <slot />
  </div>
</template>
