<script setup>
import { reactiveOmit } from "@vueuse/core";
import { PaginationRoot, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  page: { type: Number, required: false },
  defaultPage: { type: Number, required: false },
  itemsPerPage: { type: Number, required: true },
  total: { type: Number, required: false },
  siblingCount: { type: Number, required: false },
  disabled: { type: Boolean, required: false },
  showEdges: { type: Boolean, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: { type: null, required: false },
});
const emits = defineEmits(["update:page"]);

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <PaginationRoot
    v-slot="slotProps"
    data-slot="pagination"
    v-bind="forwarded"
    :class="cn('mx-auto flex w-full justify-center', props.class)"
  >
    <slot v-bind="slotProps" />
  </PaginationRoot>
</template>
