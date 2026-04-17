<script setup>
// shadcn-vue Input Group：把 Input + Button（或 Input + addon）拼成一个
// 视觉一体的输入条。wrapper 自己承担 border / rounded / shadow / focus-ring，
// 用 [&>*] 透穿选择器把内部 <input> / <button> 的独立边框/阴影/ring 扁平化。
//
// 用法：
//   <InputGroup>
//     <Input v-model="q" placeholder="..." />
//     <Button :disabled="..." @click="...">Go</Button>
//   </InputGroup>
//
// 需要分隔线时：<InputGroup class="[&>*:not(:first-child)]:border-l [&>*:not(:first-child)]:border-input" />
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <div
    :class="cn(
      'flex items-stretch w-full rounded-md border border-input bg-background shadow-sm overflow-hidden transition-colors',
      'focus-within:ring-1 focus-within:ring-ring',
      // 扁平化所有 input / button 子元素：取消它们各自的 border / shadow / ring / rounded，
      // 让整个 group 看起来是一个整体
      '[&>input]:border-0 [&>input]:shadow-none [&>input]:rounded-none [&>input]:bg-transparent',
      '[&>input]:focus-visible:ring-0 [&>input]:focus-visible:outline-none',
      '[&>button]:border-0 [&>button]:shadow-none [&>button]:rounded-none',
      '[&>button]:focus-visible:ring-0 [&>button]:focus-visible:outline-none',
      $props.class,
    )"
  >
    <slot />
  </div>
</template>
