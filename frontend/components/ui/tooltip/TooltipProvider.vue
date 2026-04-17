<script setup>
import { TooltipProvider } from 'reka-ui';

defineProps({
  delayDuration: { type: Number, default: 150 },
  skipDelayDuration: { type: Number, default: 300 },
  disableHoverableContent: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});
</script>

<template>
  <TooltipProvider
    :delay-duration="delayDuration"
    :skip-delay-duration="skipDelayDuration"
    :disable-hoverable-content="disableHoverableContent"
    :disabled="disabled"
  >
    <slot />
  </TooltipProvider>
</template>
