<script setup>
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { inputGroupButtonVariants } from ".";

const props = defineProps({
  variant: { type: null, required: false, default: "ghost" },
  size: { type: null, required: false, default: "xs" },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <Button
    :data-size="props.size"
    :variant="props.variant"
    :class="cn(inputGroupButtonVariants({ size: props.size }), props.class)"
  >
    <slot />
  </Button>
</template>
