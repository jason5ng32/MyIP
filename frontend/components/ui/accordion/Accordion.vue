<script setup>
// shadcn-vue Accordion 根组件（refactor/01 阶段 C commit 1）
// 与 Bootstrap 的 accordion (+ data-bs-parent) 语义对齐：默认 type="single"，允许全部折叠
import { AccordionRoot } from 'reka-ui';

defineProps({
  type: { type: String, default: 'single' }, // 'single' | 'multiple'
  collapsible: { type: Boolean, default: true }, // type="single" 时允许全部收起
  defaultValue: { type: [String, Array], default: undefined },
  modelValue: { type: [String, Array], default: undefined },
  disabled: { type: Boolean, default: false },
  class: { type: [String, Array, Object], default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <AccordionRoot
    :type="type"
    :collapsible="collapsible"
    :default-value="defaultValue"
    :model-value="modelValue"
    :disabled="disabled"
    :class="$props.class"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <slot />
  </AccordionRoot>
</template>
