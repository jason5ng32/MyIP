<!-- Section wrapper for the IP Calculator result cards: lucide icon + title
     header with an optional right-aligned actions slot (copy-all, a Select),
     then the section body. -->
<template>
    <section class="space-y-3">
        <header class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <component :is="icon" class="size-5 shrink-0 text-muted-foreground" />
                <h3 class="text-base font-semibold tracking-tight m-0 truncate">{{ title }}</h3>
            </div>
            <slot name="actions" />
        </header>
        <slot />
    </section>
</template>

<script setup>
defineProps({
    icon: { type: [Object, Function], required: true },
    title: { type: String, required: true },
});
</script>
