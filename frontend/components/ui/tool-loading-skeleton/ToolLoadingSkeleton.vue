<template>
    <!-- w-screen gives the skeleton intrinsic width — the drawer canvas is
         width:fit-content and would collapse to zero without it; max-w-full
         clamps it back inside any container. -->
    <div class="w-screen max-w-full space-y-4 py-4 animate-pulse" role="status" aria-label="Loading">
        <div class="space-y-2">
            <div class="h-4 w-2/3 rounded bg-muted"></div>
            <div class="h-4 w-4/5 rounded bg-muted"></div>
            <div class="h-4 w-4/7 rounded bg-muted"></div>
            <div class="h-4 w-1/2 rounded bg-muted"></div>
        </div>
        <div class="h-30 rounded-xl bg-muted"></div>
    </div>
</template>

<script setup>
// Chunk-download placeholder for lazy tool components (Advanced.vue drawer
// + StandaloneTool.vue). A skeleton, not a spinner: tools run their own
// spinners after mount, and two near-identical spinners read as a glitch.
</script>
