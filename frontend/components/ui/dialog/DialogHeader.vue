<script setup>
// 项目通用 Dialog 头部：lucide 图标 + 标题 + 右侧关闭
// 跟 Sheet / Drawer 的 header 观感对齐（icon text-muted-foreground + h2 font-semibold + close hover bg-muted）
// 用法：
//   <DialogHeader :icon="Terminal" :title="t('curl.Title')" />
// 或（自定义标题内容）：
//   <DialogHeader :icon="Terminal">
//     <template #title>自定义节点</template>
//   </DialogHeader>
import { DialogTitle } from 'reka-ui';
import DialogClose from './DialogClose.vue';
import { cn } from '@/lib/utils';

defineProps({
  icon: { type: [Object, Function], default: null },
  title: { type: String, default: '' },
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <header
    :class="cn('flex items-center justify-between gap-2 pb-3 border-b shrink-0', $props.class)"
  >
    <DialogTitle as-child>
      <h2 class="flex items-center gap-2 text-base font-semibold m-0">
        <component :is="icon" v-if="icon" class="size-4 text-muted-foreground" />
        <slot name="title">{{ title }}</slot>
      </h2>
    </DialogTitle>
    <DialogClose
      class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
  </header>
</template>
