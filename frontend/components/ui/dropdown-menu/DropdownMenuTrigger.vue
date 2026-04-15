<script setup>
import { DropdownMenuTrigger } from 'reka-ui';

defineProps({
  asChild: { type: Boolean, default: true },
});
</script>

<template>
  <DropdownMenuTrigger :as-child="asChild">
    <slot />
  </DropdownMenuTrigger>
</template>
