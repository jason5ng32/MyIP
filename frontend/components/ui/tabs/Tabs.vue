<script setup>
// shadcn-vue Tabs 根组件（refactor/01 阶段 C commit 2）
import { TabsRoot } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  modelValue: { type: String, default: undefined },
  defaultValue: { type: String, default: undefined },
  class: { type: [String, Array, Object], default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :class="$props.class"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <slot />
  </TabsRoot>
</template>
