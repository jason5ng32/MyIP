<script setup>
// shadcn-vue Drawer 面板内容：包含 overlay + handle + 自适应方向
// 默认从底部滑入，配合 vaul 的拖拽关闭手势
import { computed } from 'vue';
import { DrawerContent, DrawerOverlay, DrawerPortal, DrawerTitle, DrawerHandle } from 'vaul-vue';
import { VisuallyHidden } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  class: { type: [String, Array, Object], default: undefined },
  // a11y 标题；未给且无 #title slot 时用 VisuallyHidden 兜底
  title: { type: String, default: 'Drawer' },
  // 是否显示顶部把手（仅 bottom 方向有意义）
  showHandle: { type: Boolean, default: true },
  // 顶部是否避让 iOS safe-area；只在 drawer 贴到顶部（如 h-full / fullscreen）时打开，
  // 否则在 h-[85vh] 这类已离顶有间距的场景会白白浪费一截。
  safeAreaTop: { type: Boolean, default: false },
});
defineEmits(['close', 'escapeKeyDown']);

const contentStyle = computed(() => ({
  paddingBottom: 'env(safe-area-inset-bottom)',
  ...(props.safeAreaTop ? { paddingTop: 'env(safe-area-inset-top)' } : {}),
}));
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
      :style="contentStyle"
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
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
