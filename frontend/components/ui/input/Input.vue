<script setup>
// shadcn-vue Input（refactor/01 阶段 C.2）
import { cn } from '@/lib/utils';

defineProps({
  modelValue: { type: [String, Number], default: undefined },
  class: { type: [String, Array, Object], default: undefined },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <input
    :value="modelValue"
    :class="cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', $props.class)"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
