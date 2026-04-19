<script setup>
import { cn } from "@/lib/utils";
import { Textarea } from '@/components/ui/textarea';

const props = defineProps({
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <Textarea
    data-slot="input-group-control"
    :class="
      cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
        props.class,
      )
    "
  />
</template>
