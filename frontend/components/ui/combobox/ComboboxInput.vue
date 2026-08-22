<script setup>
import { ComboboxInput } from 'reka-ui';
import { useVModel } from '@vueuse/core';
import { Search } from '@lucide/vue';
import { cn } from '@/lib/utils';

const props = defineProps({
  modelValue: { type: String, required: false },
  defaultValue: { type: String, required: false },
  placeholder: { type: String, required: false },
  class: { type: null, required: false },
});
const emits = defineEmits(['update:modelValue']);

// reka-ui's ComboboxInput owns the search term via its own v-model; this
// wrapper has to forward it or the consumer never sees what was typed.
const searchTerm = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
});
</script>

<template>
  <div class="flex items-center border-b px-3">
    <Search class="mr-2 size-4 shrink-0 opacity-50" />
    <ComboboxInput
      v-model="searchTerm"
      :placeholder="placeholder"
      auto-focus
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      data-1p-ignore
      data-lpignore="true"
      :class="cn(
        'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )"
    />
  </div>
</template>
