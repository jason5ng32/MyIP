<script setup>
// shadcn-vue DropdownMenu 根组件（refactor/01 阶段 C commit 2）
import { DropdownMenuRoot } from 'reka-ui';

defineProps({
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: undefined },
  modal: { type: Boolean, default: true },
});
defineEmits(['update:open']);
</script>

<template>
  <DropdownMenuRoot
    :open="open"
    :default-open="defaultOpen"
    :modal="modal"
    @update:open="$emit('update:open', $event)"
  >
    <slot />
  </DropdownMenuRoot>
</template>
