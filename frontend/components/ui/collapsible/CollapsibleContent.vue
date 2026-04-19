<script setup>
// 展开/收起使用 CSS 关键帧过渡 height，关键帧定义在 style.css
// （不依赖 tw-animate-css，因为项目里 bootstrap CSS 与 tw 共存期需要自定义稳定方案）
import { CollapsibleContent } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  forceMount: { type: Boolean, default: false },
});
</script>

<template>
  <CollapsibleContent
    :force-mount="forceMount"
    :class="cn('jn-collapsible-content overflow-hidden', $props.class)"
  >
    <slot />
  </CollapsibleContent>
</template>
