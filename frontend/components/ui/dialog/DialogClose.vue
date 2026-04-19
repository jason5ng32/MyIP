<script setup>
// shadcn-vue Dialog 关闭按钮
import { DialogClose } from 'reka-ui';
import { X } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  asChild: { type: Boolean, default: false },
});
</script>

<template>
  <DialogClose
    :as-child="asChild"
    :class="cn('rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none', $props.class)"
  >
    <slot>
      <X class="h-4 w-4" />
      <span class="sr-only">Close</span>
    </slot>
  </DialogClose>
</template>
