<script setup>
// shadcn-vue Separator（refactor/01 阶段 C.2）
import { Separator } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  orientation: { type: String, default: 'horizontal' },
  decorative: { type: Boolean, default: true },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <Separator
    :orientation="orientation"
    :decorative="decorative"
    :class="cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', $props.class)"
  />
</template>
