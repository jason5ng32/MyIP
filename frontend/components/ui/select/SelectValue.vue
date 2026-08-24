<script setup>
import { SelectValue } from 'reka-ui';

defineProps({ placeholder: { type: String, default: undefined } });
</script>

<template>
  <!-- The trigger lays this span out as a flex row, so the default text needs
       an element of its own to truncate against. -->
  <SelectValue v-slot="{ selectedLabel, modelValue }" :placeholder="placeholder">
    <slot :selected-label="selectedLabel" :model-value="modelValue">
      <span class="truncate">{{ selectedLabel.length ? selectedLabel.join(', ') : placeholder }}</span>
    </slot>
  </SelectValue>
</template>
