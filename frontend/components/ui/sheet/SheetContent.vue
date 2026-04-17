<script setup>
// shadcn-vue Sheet 面板：四向滑入，包含 overlay
// 见 refactor/01 阶段 B
import { DialogContent, DialogOverlay, DialogPortal, DialogTitle, VisuallyHidden } from 'reka-ui';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const sheetVariants = cva(
  'fixed z-[10001] gap-4 bg-background shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom: 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-lg border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        right: 'inset-y-0 right-0 h-full w-3/4 max-w-lg border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
      },
    },
    defaultVariants: { side: 'right' },
  }
);

const props = defineProps({
  side: { type: String, default: 'right' },
  class: { type: [String, Array, Object], default: undefined },
  // 可选 a11y 标题；如果未给且没有 #title slot，用 VisuallyHidden 兜底以满足 reka-ui 的 a11y 警告
  title: { type: String, default: 'Panel' },
  // 透传给 DialogContent，比如 onPointerDownOutside
  onPointerDownOutside: { type: Function, default: undefined },
  onInteractOutside: { type: Function, default: undefined },
});
defineEmits(['close', 'escapeKeyDown']);
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-[10000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogContent
      :class="cn(sheetVariants({ side }), props.class)"
      :on-pointer-down-outside="onPointerDownOutside"
      :on-interact-outside="onInteractOutside"
      @escape-key-down="$emit('escapeKeyDown', $event)"
      @close-auto-focus="(e) => e.preventDefault()"
    >
      <VisuallyHidden v-if="!$slots.title">
        <DialogTitle>{{ title }}</DialogTitle>
      </VisuallyHidden>
      <slot name="title" />
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
