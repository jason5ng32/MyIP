<script setup>
// shadcn-vue Switch（refactor/01 阶段 C.2）
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  modelValue: { type: Boolean, default: undefined },
  defaultValue: { type: Boolean, default: undefined },
  disabled: { type: Boolean, default: false },
  id: { type: String, default: undefined },
  class: { type: [String, Array, Object], default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :disabled="disabled"
    :id="id"
    :class="cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', $props.class)"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <SwitchThumb class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchRoot>
</template>
