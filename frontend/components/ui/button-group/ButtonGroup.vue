<script setup>
import { cn } from "@/lib/utils";
import { buttonGroupVariants } from ".";

const props = defineProps({
  class: { type: null, required: false },
  orientation: { type: null, required: false },
});
</script>

<template>
  <div
    role="group"
    data-slot="button-group"
    :data-orientation="props.orientation"
    :class="
      cn(buttonGroupVariants({ orientation: props.orientation }), props.class)
    "
  >
    <slot />
  </div>
</template>
