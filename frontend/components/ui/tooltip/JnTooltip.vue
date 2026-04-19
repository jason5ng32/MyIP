<script setup>
// 项目专用的便利 tooltip 组件，避免每个 v-tooltip 调用点都写 4 层 shadcn-vue 组件
// 用法：
//   <JnTooltip :text="t('Tooltips.Foo')" side="top">
//     <button>...</button>
//   </JnTooltip>
//
// 移动端（store.isMobile）自动跳过，保持与旧指令同样的行为（触屏上没有 hover）
import { computed } from 'vue';
import { useMainStore } from '@/store';
import { Tooltip, TooltipTrigger, TooltipContent } from '.';

defineProps({
  text: { type: String, required: true },
  side: { type: String, default: 'top' },
  sideOffset: { type: Number, default: 4 },
  disabled: { type: Boolean, default: false },
});

const store = useMainStore();
const shouldDisable = computed(() => store.isMobile);
</script>

<template>
  <span v-if="shouldDisable || disabled || !text" class="contents">
    <slot />
  </span>
  <Tooltip v-else>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent :side="side" :side-offset="sideOffset">
      <span>{{ text }}</span>
    </TooltipContent>
  </Tooltip>
</template>
