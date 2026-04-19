<script setup>
import { CollapsibleTrigger } from 'reka-ui';

defineProps({
  asChild: { type: Boolean, default: true },
});
</script>

<template>
  <CollapsibleTrigger :as-child="asChild">
    <slot />
  </CollapsibleTrigger>
</template>
