<script setup>
// shadcn-vue Dialog 根组件（refactor/01 阶段 B）
import { DialogRoot } from 'reka-ui';
import { useOverlayShortcuts } from '@/composables/use-overlay-shortcuts.js';

const props = defineProps({
  open: { type: Boolean, default: undefined },
  modal: { type: Boolean, default: true },
});
defineEmits(['update:open']);

// Overlays suspend the page's keyboard shortcuts while open — see
// composables/use-overlay-shortcuts.js.
useOverlayShortcuts(() => props.open);
</script>

<template>
  <DialogRoot :open="open" :modal="modal" @update:open="$emit('update:open', $event)">
    <slot />
  </DialogRoot>
</template>
