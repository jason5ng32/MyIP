<script setup>
import { SelectRoot } from 'reka-ui';

defineProps({
  modelValue: { type: String, default: undefined },
  defaultValue: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  name: { type: String, default: undefined },
  open: { type: Boolean, default: undefined },
});
defineEmits(['update:modelValue', 'update:open']);
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    :default-value="defaultValue"
    :disabled="disabled"
    :name="name"
    :open="open"
    @update:model-value="$emit('update:modelValue', $event)"
    @update:open="$emit('update:open', $event)"
  >
    <slot />
  </SelectRoot>
</template>
