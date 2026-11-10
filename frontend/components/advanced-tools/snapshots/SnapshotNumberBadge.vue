<!-- Snapshots page: a list row's position (1 at the top) as the homepage IP
     card's index badge, widening past two digits. It tells apart two
     snapshots with the same auto label. -->
<template>
    <span v-if="number"
        class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-foreground px-1 text-xs font-semibold tabular-nums text-background">
        {{ number }}
    </span>
</template>

<script setup>
defineProps({
    number: { type: Number, default: 0 },
});
</script>
