<script setup>
// shadcn-vue Spinner：lucide 的 Loader2 + animate-spin + a11y role
// 用法：
//   <Button :disabled="loading" variant="action">
//     <Spinner v-if="loading" />
//     {{ loading ? '' : 'Submit' }}
//   </Button>
// Button 的 cva 里有 [&_svg]:size-4 [&_svg]:shrink-0，所以直接 slot 进 Button 就会对齐
import { Loader2 } from 'lucide-vue-next';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <Loader2
    role="status"
    aria-label="Loading"
    :class="cn('size-4 animate-spin', $props.class)"
  />
</template>
