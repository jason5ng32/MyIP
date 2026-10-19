<script setup>
import { cn } from "@/lib/utils";

const props = defineProps({
  class: { type: null, required: false },
});
</script>

<template>
  <div
    data-slot="alert-description"
    :class="
      cn(
        'text-muted-foreground col-start-2 text-sm [&_p]:leading-relaxed',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
