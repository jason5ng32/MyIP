<script setup>
import { reactiveOmit } from "@vueuse/core";
import { ChevronsRight } from "@lucide/vue";
import { PaginationLast, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const props = defineProps({
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  size: { type: null, required: false, default: "default" },
  class: { type: null, required: false },
});

const delegatedProps = reactiveOmit(props, "class", "size");
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <PaginationLast
    data-slot="pagination-last"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'gap-1 px-2.5 sm:pl-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="max-sm:hidden">Last</span>
      <ChevronsRight />
    </slot>
  </PaginationLast>
</template>
