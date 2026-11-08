<!-- Snapshots diff view: one homepage section as a "file" block — a header
     with the section's homepage emoji and test name, its counts (changed /
     only here / only there) or which side did not run it, and an expand /
     collapse-all control; then one hunk per keyed item. Hunks open
     by their own rule (utils/features/snapshot-diff-format.js) until toggled;
     toggles reset when the viewed pair (`viewKey`) changes. -->
<template>
    <section class="overflow-hidden rounded-lg border bg-card">
        <!-- Header -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/40 px-3 py-2">
            <h3 class="m-0 flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span aria-hidden="true">{{ SECTION_EMOJIS[sectionId] }}</span>
                <span class="min-w-0 truncate">{{ labels.sectionTitle(sectionId) }}</span>
            </h3>
            <span v-if="summary" class="min-w-0 text-xs text-muted-foreground">{{ summary }}</span>
            <Button v-if="hunks.length" variant="ghost" size="sm"
                class="ml-auto h-7 cursor-pointer px-2 text-xs font-normal text-muted-foreground"
                @click="toggleAll">
                <component :is="allOpen ? ChevronsDownUp : ChevronsUpDown" class="size-3.5" />
                {{ t(allOpen ? 'snapshots.CollapseAll' : 'snapshots.ExpandAll') }}
            </Button>
        </div>

        <!-- Not run in the viewed snapshot -->
        <p v-if="notice === 'notRunHere'" class="m-0 px-3 py-3 text-sm text-muted-foreground">
            {{ t(sectionId === 'speedtest' ? 'snapshots.NotRunSpeedNote' : 'snapshots.NotRunNote') }}
        </p>

        <template v-else>
            <!-- Split column heads -->
            <div v-if="split" class="grid grid-cols-2 divide-x border-b text-xs text-muted-foreground">
                <span class="truncate px-3 py-1">{{ t('snapshots.SideCompared') }}</span>
                <span class="truncate px-3 py-1">{{ t('snapshots.SideViewed') }}</span>
            </div>
            <SnapshotDiffHunk v-for="hunk in hunks" :key="hunk.key" :hunk="hunk" :open="isOpen(hunk)"
                :split="split" :comparing="comparing" @update:open="(value) => setOpen(hunk, value)" />
        </template>
    </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronsDownUp, ChevronsUpDown } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useSnapshotLabels } from '@/composables/use-snapshot-labels.js';
import { hunkCounts } from '@/utils/features/snapshot-diff-format.js';
import SnapshotDiffHunk from './SnapshotDiffHunk.vue';

const props = defineProps({
    sectionId: { type: String, required: true },
    hunks: { type: Array, default: () => [] },
    // 'notRunHere' | 'notRunThere' | null (blockNotice()).
    notice: { type: String, default: null },
    comparing: { type: Boolean, default: false },
    split: { type: Boolean, default: false },
    viewKey: { type: String, default: '' },
});

// The homepage sections' own heading emojis.
const SECTION_EMOJIS = { ipinfo: '🔦', connectivity: '🚦', webrtc: '🚱', dnsleak: '🛑', speedtest: '🚀' };

const { t } = useI18n();
const labels = useSnapshotLabels();

// --- header -----------------------------------------------------------------

// "2 changed · 1 only here", zero parts left out; or which side did not run.
const summary = computed(() => {
    if (props.notice === 'notRunHere') return t('snapshots.NotRun');
    if (props.notice === 'notRunThere') return t('snapshots.NotRunThere');
    if (!props.comparing) return '';
    const counts = hunkCounts(props.hunks);
    return [
        counts.changed && t('snapshots.CountChanged', { n: counts.changed }),
        counts.onlyViewed && t('snapshots.CountOnlyHere', { n: counts.onlyViewed }),
        counts.onlyCompared && t('snapshots.CountOnlyThere', { n: counts.onlyCompared }),
    ].filter(Boolean).join(' · ') || t('snapshots.NoChanges');
});

// --- open state -------------------------------------------------------------

const toggled = ref(new Map()); // hunk key → open, past its own rule
watch(() => props.viewKey, () => { toggled.value = new Map(); });

const isOpen = (hunk) => (toggled.value.has(hunk.key) ? toggled.value.get(hunk.key) : hunk.open);
const setOpen = (hunk, value) => {
    const next = new Map(toggled.value);
    next.set(hunk.key, value);
    toggled.value = next;
};

const allOpen = computed(() => props.hunks.length > 0 && props.hunks.every(isOpen));
const toggleAll = () => {
    const value = !allOpen.value;
    toggled.value = new Map(props.hunks.map((hunk) => [hunk.key, value]));
};
</script>
