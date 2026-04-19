<script setup>
// shadcn-vue ToggleGroup 根（refactor/01 阶段 C.2）
import { ToggleGroupRoot } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  modelValue: { type: [String, Array], default: undefined },
  defaultValue: { type: [String, Array], default: undefined },
  type: { type: String, default: 'single' },
  disabled: { type: Boolean, default: false },
  rovingFocus: { type: Boolean, default: true },
  loop: { type: Boolean, default: true },
  class: { type: [String, Array, Object], default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <ToggleGroupRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :type="type"
    :disabled="disabled"
    :roving-focus="rovingFocus"
    :loop="loop"
    :class="cn('inline-flex items-center justify-center gap-1', $props.class)"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <slot />
  </ToggleGroupRoot>
</template>
