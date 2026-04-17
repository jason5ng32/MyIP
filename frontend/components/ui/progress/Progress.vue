<script setup>
// shadcn-vue Progress（refactor/01 阶段 C.2）
import { ProgressRoot, ProgressIndicator } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  modelValue: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  class: { type: [String, Array, Object], default: undefined },
  // 可选：indicator bar 单独覆盖颜色（例如按质量分数走 success/warning/destructive）
  indicatorClass: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <ProgressRoot
    :model-value="modelValue"
    :max="max"
    :class="cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', $props.class)"
  >
    <ProgressIndicator
      :class="cn('h-full w-full flex-1 bg-primary transition-all', $props.indicatorClass)"
      :style="`transform: translateX(-${100 - (modelValue || 0)}%)`"
    />
  </ProgressRoot>
</template>
