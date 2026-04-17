<script setup>
// shadcn-vue Drawer 根组件：薄包装 vaul-vue DrawerRoot
// 与 Sheet 不同：vaul 自带拖拽手势 + body scale（需配合 index.html 的 [vaul-drawer-wrapper]）
// 用法：<Drawer :open="..." @update:open="..."> 或 v-model:open
import { DrawerRoot } from 'vaul-vue';

defineProps({
  open: { type: Boolean, default: undefined },
  modal: { type: Boolean, default: true },
  // 'top' | 'bottom' | 'left' | 'right'，默认 bottom
  direction: { type: String, default: 'bottom' },
  // 拖拽是否带回弹（vaul 默认 true）
  shouldScaleBackground: { type: Boolean, default: true },
  // vaul 默认 true 时会把 body.background 强制改成黑色（iOS 风格），
  // 但它是硬编码黑，不读主题，白天模式下会出现黑底。这里默认关闭。
  setBackgroundColorOnScale: { type: Boolean, default: false },
  // 关闭时是否处理 body 滚动锁
  dismissible: { type: Boolean, default: true },
  // snap 点（数组，0~1 之间或 px 字符串）；不传则自由高度
  snapPoints: { type: Array, default: undefined },
  activeSnapPoint: { type: [Number, String], default: undefined },
  // vaul 默认整个 drawer body 都可以按下拖拽，为了不跟文字选择冲突，
  // 桌面下还强制注入 user-select:none（见 style.css 里的覆盖）。
  // 我们项目里 drawer 是长内容阅读场景，默认 true——只有顶部把手能拖，
  // 正文不响应拖拽，配合 CSS 覆盖就能正常选中文字。
  handleOnly: { type: Boolean, default: true },
});
defineEmits(['update:open', 'update:activeSnapPoint']);
</script>

<template>
  <DrawerRoot
    :open="open"
    :modal="modal"
    :direction="direction"
    :should-scale-background="shouldScaleBackground"
    :set-background-color-on-scale="setBackgroundColorOnScale"
    :dismissible="dismissible"
    :snap-points="snapPoints"
    :active-snap-point="activeSnapPoint"
    :handle-only="handleOnly"
    @update:open="$emit('update:open', $event)"
    @update:active-snap-point="$emit('update:activeSnapPoint', $event)"
  >
    <slot />
  </DrawerRoot>
</template>
