<script setup>
// shadcn-vue Sheet 根组件：薄包装 reka-ui DialogRoot
// 用法：<Sheet :open="..." @update:open="..."> 或 v-model:open
// 见 refactor/01 阶段 B Offcanvas 迁移
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
