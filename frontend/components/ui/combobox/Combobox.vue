<script setup>
import { ComboboxRoot, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps({
  open: { type: Boolean, required: false },
  defaultOpen: { type: Boolean, required: false },
  modelValue: { type: null, required: false },
  defaultValue: { type: null, required: false },
  multiple: { type: Boolean, required: false },
  disabled: { type: Boolean, required: false },
  resetSearchTermOnBlur: { type: Boolean, required: false, default: true },
  ignoreFilter: { type: Boolean, required: false },
  class: { type: null, required: false },
});
const emits = defineEmits(['update:open', 'update:modelValue', 'highlight']);

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxRoot v-bind="forwarded" :class="cn('w-full', props.class)">
    <slot />
  </ComboboxRoot>
</template>
