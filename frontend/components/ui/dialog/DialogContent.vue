<script setup>
// shadcn-vue Dialog 内容面板（refactor/01 阶段 B）
import { DialogContent, DialogOverlay, DialogPortal, DialogTitle, VisuallyHidden } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  title: { type: String, default: 'Dialog' },
  onPointerDownOutside: { type: Function, default: undefined },
  onInteractOutside: { type: Function, default: undefined },
});
defineEmits(['escapeKeyDown']);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-[10000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      :class="cn('fixed left-1/2 top-1/2 z-[10001] -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg max-h-[90vh] overflow-y-auto', $props.class)"
      :on-pointer-down-outside="onPointerDownOutside"
      :on-interact-outside="onInteractOutside"
      @escape-key-down="$emit('escapeKeyDown', $event)"
    >
      <VisuallyHidden v-if="!$slots.title">
        <DialogTitle>{{ title }}</DialogTitle>
      </VisuallyHidden>
      <slot name="title" />
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
