<!-- Snapshots page: the snapshot list — list rows only (the save button
     lives in the page's action row), one per snapshot (newest first): its
     position (1 at the top), this visit's live dot, label, full date-time,
     a static pinned marker beside the label and a text compare slot beside
     the time (a highlighted marker on the snapshot being compared against;
     a ghost button on other rows, not on the viewed row). Pinning lives in
     the detail panel. The viewed row carries a solid border + muted
     fill, the compared row a dashed border. Shown as the left column on
     ≥1024px and inside the list Sheet below that; `keyboard` lets ↑ / ↓ move
     the selection while the list has focus, `revealActionsOnHover` shows the
     actions only on row hover / focus (the compare
     marker stays on the compared row). The selected row is kept in view. No
     chrome of its own: a caller's class (card, height cap, scrolling) lands
     on the root. -->
<template>
    <div>
        <ul ref="listEl" role="listbox" :tabindex="keyboard ? 0 : undefined" :aria-label="t('snapshots.ListLabel')"
            :aria-activedescendant="keyboard && selectedId ? `${idPrefix}${selectedId}` : undefined"
            class="m-0 flex list-none flex-col gap-1 rounded-md p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @keydown="onKeydown">
            <li v-for="(snap, index) in snapshots" :id="`${idPrefix}${snap.id}`" :key="snap.id" role="option"
                :aria-selected="snap.id === selectedId" :data-id="snap.id"
                class="group cursor-pointer rounded-lg border px-2.5 py-2 transition-colors"
                :class="rowClass(snap)"
                @click="emit('select', snap.id)">
                <div class="flex items-start gap-2">
                    <!-- Number, label, time -->
                    <SnapshotNumberBadge :number="index + 1" class="mt-px" />
                    <div class="min-w-0 flex-1">
                        <!-- Label, after this visit's live dot (rows stay two lines) -->
                        <div class="flex min-w-0 items-center gap-1.5">
                            <span v-if="snap.id === currentId" role="img" class="inline-flex shrink-0"
                                :aria-label="t('snapshots.ThisVisit')" :title="t('snapshots.ThisVisit')">
                                <SnapshotLiveDot />
                            </span>
                            <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ labels.label(snap) }}</span>
                            <span v-if="snap.kept" role="img" class="inline-flex shrink-0 text-muted-foreground"
                                :aria-label="t('snapshots.Pinned')" :title="t('snapshots.Pinned')">
                                <Pin class="size-3.5 fill-current" aria-hidden="true" />
                            </span>
                        </div>
                        <!-- Time and compare share a fixed-height row, including on the viewed snapshot. -->
                        <div class="mt-0.5 flex min-h-6 items-center justify-between gap-2">
                            <span class="min-w-0 truncate text-xs text-muted-foreground"
                                :title="labels.when(snap)">{{ labels.when(snap) }}</span>
                            <JnTooltip v-if="snap.id === comparedId" :text="t('snapshots.SideCompared')" side="left">
                                <span role="img" :aria-label="t('snapshots.Comparing')"
                                    class="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md bg-muted px-2 text-xs font-medium text-foreground">
                                    {{ t('snapshots.Comparing') }}
                                </span>
                            </JnTooltip>
                            <div v-else-if="snap.id !== selectedId" class="flex shrink-0 transition-opacity"
                                :class="revealClass(false)" @click.stop>
                                <JnTooltip :text="t('snapshots.CompareWithThis')" side="left">
                                    <Button variant="ghost" size="sm"
                                        class="h-6 cursor-pointer px-2 text-xs text-muted-foreground hover:text-foreground"
                                        :aria-label="t('snapshots.CompareWithThis')" @click="emit('compare', snap.id)">
                                        {{ t('snapshots.Compare') }}
                                    </Button>
                                </JnTooltip>
                            </div>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pin } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { useSnapshotLabels } from '@/composables/use-snapshot-labels.js';
import SnapshotLiveDot from './SnapshotLiveDot.vue';
import SnapshotNumberBadge from './SnapshotNumberBadge.vue';

const props = defineProps({
    snapshots: { type: Array, required: true },
    selectedId: { type: String, default: null },
    currentId: { type: String, default: null },
    keyboard: { type: Boolean, default: false },
    // The snapshot being compared against: marked, no compare button.
    comparedId: { type: String, default: null },
    // Pointer layouts: actions appear on row hover / focus only.
    revealActionsOnHover: { type: Boolean, default: false },
    // Row ids stay unique while two copies are mounted (column + Sheet).
    idPrefix: { type: String, default: 'snapshot-row-' },
});
const emit = defineEmits(['select', 'compare']);

const { t } = useI18n();
const labels = useSnapshotLabels();

const listEl = ref(null);

const rowClass = (snap) => {
    if (snap.id === props.selectedId) return 'border-foreground/30 bg-muted';
    if (snap.id === props.comparedId) return 'border-dashed border-muted-foreground/50 bg-muted/30 hover:bg-muted/60';
    return 'border-transparent hover:bg-muted/60';
};

// Hidden by opacity, not v-if: the row keeps its size and the button its tab stop.
const revealClass = (alwaysShown) => (props.revealActionsOnHover && !alwaysShown
    ? 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
    : '');

const onKeydown = (event) => {
    if (!props.keyboard || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    event.preventDefault();
    const ids = props.snapshots.map((snap) => snap.id);
    const next = ids[ids.indexOf(props.selectedId) + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) emit('select', next);
};

const revealSelected = () => {
    const id = props.selectedId;
    if (!id) return;
    nextTick(() => listEl.value?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }));
};
onMounted(revealSelected);
watch(() => props.selectedId, revealSelected);
</script>
