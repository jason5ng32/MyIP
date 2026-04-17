<script setup>
import { TabsList } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
});
</script>

<template>
  <TabsList
    :class="cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', $props.class)"
  >
    <slot />
  </TabsList>
</template>
