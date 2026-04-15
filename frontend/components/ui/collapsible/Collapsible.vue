<script setup>
// shadcn-vue Collapsible 根组件（refactor/01 阶段 C commit 1）
import { CollapsibleRoot } from 'reka-ui';

defineProps({
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: false },
});
defineEmits(['update:open']);
</script>

<template>
  <CollapsibleRoot
    :open="open"
    :default-open="defaultOpen"
    :disabled="disabled"
    @update:open="$emit('update:open', $event)"
  >
    <slot />
  </CollapsibleRoot>
</template>
