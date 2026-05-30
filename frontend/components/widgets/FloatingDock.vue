<template>
    <!-- Bottom-right floating action dock: stacks its slotted buttons in a
        column anchored to the content-area right edge. Owns the wide-screen
        horizontal alignment so individual buttons no longer each re-implement
        it, and the vertical stacking comes from flex gap rather than per-button
        `bottom-*` offsets (so showing/hiding a button never leaves a gap). -->
    <div class="fixed bottom-9 z-1050 flex flex-col items-end gap-2.5" :style="positionStyle">
        <slot />
    </div>
</template>

<script setup>
// FloatingDock - single fixed container for the bottom-right floating buttons
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// Wide screen (>1600px): align to the content area's right edge (max-width
// 1600px); otherwise stick 18px from the viewport's right edge.
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 18}px` };
    }
    return { right: '18px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };

onMounted(() => window.addEventListener('resize', handleResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleResize));
</script>
