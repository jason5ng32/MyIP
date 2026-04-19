<script setup>
import { DropdownMenuItem } from 'reka-ui';
import { cn } from '@/lib/utils';

defineProps({
  class: { type: [String, Array, Object], default: undefined },
  disabled: { type: Boolean, default: false },
  asChild: { type: Boolean, default: false },
});
defineEmits(['select']);
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled"
    :as-child="asChild"
    :class="cn('relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0', $props.class)"
    @select="$emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>
