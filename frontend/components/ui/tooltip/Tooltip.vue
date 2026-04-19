<script setup>
// shadcn-vue Tooltip 根组件（refactor/01 阶段 B 修正）
import { TooltipRoot } from 'reka-ui';

defineProps({
  defaultOpen: { type: Boolean, default: undefined },
  open: { type: Boolean, default: undefined },
  delayDuration: { type: Number, default: 150 },
  disableClosingTrigger: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: undefined },
  ignoreNonKeyboardFocus: { type: Boolean, default: undefined },
});
defineEmits(['update:open']);
</script>

<template>
  <TooltipRoot
    :default-open="defaultOpen"
    :open="open"
    :delay-duration="delayDuration"
    :disable-closing-trigger="disableClosingTrigger"
    :disabled="disabled"
    :ignore-non-keyboard-focus="ignoreNonKeyboardFocus"
    @update:open="$emit('update:open', $event)"
  >
    <slot />
  </TooltipRoot>
</template>
