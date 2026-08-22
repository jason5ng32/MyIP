<script setup>
import { reactiveOmit } from "@vueuse/core";
import { useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  class: { type: null, required: false },
});

const delegatedProps = reactiveOmit(props, "class");

const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <div
    data-slot="input-otp-group"
    v-bind="forwarded"
    :class="cn('flex items-center', props.class)"
  >
    <slot />
  </div>
</template>
