<script setup>
import { reactiveOmit } from "@vueuse/core";
import { ChevronRight } from "@lucide/vue";
import { PaginationNext, useForwardProps } from "reka-ui";
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
  <PaginationNext
    data-slot="pagination-next"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'gap-1 px-2.5 sm:pl-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="max-sm:hidden">Next</span>
      <ChevronRight />
    </slot>
  </PaginationNext>
</template>
