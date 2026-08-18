<script setup>
import { ComboboxTrigger } from 'reka-ui';
import { ChevronsUpDown } from '@lucide/vue';
import { cn } from '@/lib/utils';

const props = defineProps({ class: { type: null, required: false } });
</script>

<template>
  <ComboboxTrigger
    :class="cn(
      'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
  >
    <slot />
    <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
  </ComboboxTrigger>
</template>
