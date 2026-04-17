<script setup>
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div :class="cn('p-6 pt-0', $props.class)">
    <slot />
  </div>
</template>
