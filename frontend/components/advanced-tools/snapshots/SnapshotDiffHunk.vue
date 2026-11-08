<!-- Snapshots diff view: one keyed item (an IP card, a connectivity target,
     a STUN server, a DNS provider, or the speed test) as a hunk — a muted
     monospace header naming it, then its field lines. Closed, the header
     says why: no changes, or the item is on one side only (shown plain, not
     compared). Split puts the compared snapshot on the left and the viewed
     one on the right, aligned per field. -->
<template>
    <div class="border-t first:border-t-0">
        <!-- Header: toggles the hunk -->
        <button type="button"
            class="flex w-full cursor-pointer items-center gap-2 bg-muted/60 px-3 py-1 text-left font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
            :aria-expanded="open" @click="emit('update:open', !open)">
            <ChevronRight class="size-3.5 shrink-0 transition-transform" :class="open ? 'rotate-90' : ''" />
            <span class="min-w-0 truncate"><span aria-hidden="true">@@ </span>{{ hunk.name }}<span aria-hidden="true"> @@</span></span>
            <span v-if="note" class="ml-auto min-w-0 truncate pl-2 font-sans">{{ note }}</span>
        </button>

        <!-- Lines -->
        <div v-if="open && split" class="py-0.5">
            <div v-for="row in rows" :key="row.field" class="grid grid-cols-2 divide-x">
                <SnapshotDiffLine :line="row.left" compact />
                <SnapshotDiffLine :line="row.right" compact />
            </div>
        </div>
        <div v-else-if="open" class="py-0.5">
            <SnapshotDiffLine v-for="(line, index) in hunk.lines" :key="`${line.field}:${index}`" :line="line"
                :plain="hunk.status === 'single' && !comparing" />
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRight } from '@lucide/vue';
import { splitRows } from '@/utils/features/snapshot-diff-format.js';
import SnapshotDiffLine from './SnapshotDiffLine.vue';

const props = defineProps({
    hunk: { type: Object, required: true },
    open: { type: Boolean, default: false },
    split: { type: Boolean, default: false },
    comparing: { type: Boolean, default: false },
});
const emit = defineEmits(['update:open']);

const { t } = useI18n();

const rows = computed(() => splitRows(props.hunk));

// The header's own fact: one side only, or nothing changed.
const note = computed(() => {
    if (props.hunk.status === 'onlyViewed') return t('snapshots.OnlyHere');
    if (props.hunk.status === 'onlyCompared') return t('snapshots.OnlyThere');
    if (props.hunk.status === 'both' && props.hunk.changedCount === 0) return t('snapshots.NoChanges');
    return '';
});
</script>
