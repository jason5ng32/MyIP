<script setup>
import { cn } from "@/lib/utils";
import { inputGroupAddonVariants } from ".";

const props = defineProps({
  align: { type: null, required: false, default: "inline-start" },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

function handleInputGroupAddonClick(e) {
  const currentTarget = e.currentTarget;
  const target = e.target;
  if (target && target.closest("button")) {
    return;
  }
  if (currentTarget && currentTarget?.parentElement) {
    currentTarget.parentElement?.querySelector("input")?.focus();
  }
}
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="handleInputGroupAddonClick"
  >
    <slot />
  </div>
</template>
