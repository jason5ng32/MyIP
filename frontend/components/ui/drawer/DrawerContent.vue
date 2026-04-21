<script setup>
// shadcn-vue Drawer 面板内容：包含 overlay + handle + 自适应方向
// 默认从底部滑入，配合 vaul 的拖拽关闭手势
import { DrawerContent, DrawerDescription, DrawerOverlay, DrawerPortal, DrawerTitle, DrawerHandle } from 'vaul-vue';
import { VisuallyHidden } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  class: { type: [String, Array, Object], default: undefined },
  // a11y 标题；未给且无 #title slot 时用 VisuallyHidden 兜底
  title: { type: String, default: 'Drawer' },
  // a11y description; falls back to title when neither the prop nor a
  // #description slot is provided. Without this fallback reka-ui logs
  // "Missing Description or aria-describedby" in the console — same
  // pattern as DialogContent.vue.
  description: { type: String, default: '' },
  // 是否显示顶部把手（仅 bottom 方向有意义）
  showHandle: { type: Boolean, default: true },
});
defineEmits(['close', 'escapeKeyDown']);
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay
      class="fixed inset-0 z-[10000] bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DrawerContent
      :class="cn(
        'fixed inset-x-0 bottom-0 z-[10001] mt-24 flex h-auto flex-col rounded-t-[14px] border bg-background shadow-lg outline-none',
        props.class,
      )"
      @escape-key-down="$emit('escapeKeyDown', $event)"
    >
      <DrawerHandle
        v-if="showHandle"
        class="mx-auto mt-2 h-1.5 w-[64px] shrink-0 rounded-full bg-muted-foreground/30"
      />
      <VisuallyHidden v-if="!$slots.title">
        <DrawerTitle>{{ title }}</DrawerTitle>
      </VisuallyHidden>
      <slot name="title" />
      <VisuallyHidden v-if="!$slots.description">
        <DrawerDescription>{{ description || title }}</DrawerDescription>
      </VisuallyHidden>
      <slot name="description" />
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
