<template>
    <!-- Toasts sit in the bottom-right corner (wrapper default) but *to the
         left* of the FAB column — stacked above them would vary with screen
         height, and only-offset-from-bottom wouldn't track the FAB column's
         shift on wide screens. The CSS rule below handles both. -->
    <Sonner />
</template>

<script setup>
import { computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { Sonner, toast } from '@/components/ui/sonner';

const store = useMainStore();
const alert = computed(() => store.alert);

// Map old alertStyle (Bootstrap text-* class names) to sonner methods
const STYLE_TO_TOAST = {
    'text-success': toast.success,
    'text-warning': toast.warning,
    'text-danger': toast.error,
    'text-info': toast.info,
};

watch(alert, (newVal) => {
    if (!newVal || !newVal.alertToShow) {
        return;
    }
    const fn = STYLE_TO_TOAST[newVal.alertStyle] || toast.message;
    fn(newVal.alertTitle, {
        description: newVal.alertMessage,
        duration: newVal.alertDuration || 2000,
    });
}, { deep: true });
</script>

<!--
  Global (unscoped) because sonner renders its own root to document.body,
  so scoped styles wouldn't reach it.

  Positioning goal: Toast lives to the LEFT of the FAB column on every
  screen size, not above it. The FAB column (InfoMask + QueryIP) sits at
  20px from the content-area's right edge (content area is max-width
  1600px, centered) and is 36px wide, so the left edge of the FAB column
  is at "content-edge + 20 + 36 = content-edge + 56" from viewport right.
  We push toasts another 10px beyond that, giving a clean 10px gap.

    right-offset = max(0, (viewport - 1600) / 2)   ← tracks content edge
                 + 66                               ← 20 + 36 + 10 gap

  On narrow screens `(viewport - 1600) / 2` goes negative and max() clamps
  it to 0, collapsing to a flat 66px — just the FAB width + gap from the
  viewport edge.

  If the FAB dimensions change (different button size, 3rd FAB added, or
  the content-max-width constant moves off 1600px), revisit these numbers.
-->
<style>
[data-sonner-toaster] {
    right: calc(max(0px, (100vw - 1600px) / 2) + 66px) !important;
}
</style>
