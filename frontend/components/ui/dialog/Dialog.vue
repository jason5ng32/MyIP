<script setup>
// shadcn-vue Dialog 根组件（refactor/01 阶段 B）
import { DialogRoot } from 'reka-ui';

defineProps({
  open: { type: Boolean, default: undefined },
  modal: { type: Boolean, default: true },
});
defineEmits(['update:open']);
</script>

<template>
  <DialogRoot :open="open" :modal="modal" @update:open="$emit('update:open', $event)">
    <slot />
  </DialogRoot>
</template>
