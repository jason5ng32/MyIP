<script setup>
// shadcn-vue Badge（refactor/01 阶段 C.2）
import { cn } from '@/lib/utils';
import { badgeVariants } from './variants.js';

defineProps({
  variant: { type: String, default: 'default' },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), $props.class)">
    <slot />
  </div>
</template>
