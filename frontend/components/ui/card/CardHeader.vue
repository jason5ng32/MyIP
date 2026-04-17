<script setup>
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div :class="cn('flex flex-col space-y-1.5 p-6', $props.class)">
    <slot />
  </div>
</template>
