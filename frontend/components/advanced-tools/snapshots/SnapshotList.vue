<!-- Snapshots page: the snapshot list — list rows only (the save button
     lives in the page's action row), one per snapshot (newest first): its
     position (1 at the top), this visit's live dot, a compared marker on
     the snapshot being compared against, label, full date-time, a Pin
     toggle (its pressed state is the only pinned marker) and "Compare with
     this" (not on the viewed or compared row). Shown as the left column on
     ≥1024px and inside the list Sheet below that; `keyboard` lets ↑ / ↓
     move the selection while the list has focus, `revealActionsOnHover`
     shows the actions only on row hover / focus (Pin stays while pinned).
     The selected row is kept in view. No chrome of its own: a caller's
     class (card, height cap, scrolling) lands on the root. -->
<template>
    <div>
        <ul ref="listEl" role="listbox" :tabindex="keyboard ? 0 : undefined" :aria-label="t('snapshots.ListLabel')"
            :aria-activedescendant="keyboard && selectedId ? `${idPrefix}${selectedId}` : undefined"
            class="m-0 flex list-none flex-col gap-0.5 rounded-md p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @keydown="onKeydown">
            <li v-for="(snap, index) in snapshots" :id="`${idPrefix}${snap.id}`" :key="snap.id" role="option"
                :aria-selected="snap.id === selectedId" :data-id="snap.id"
                class="group cursor-pointer rounded-lg px-2.5 py-2 transition-colors"
                :class="snap.id === selectedId ? 'bg-muted' : 'hover:bg-muted/60'"
                @click="emit('select', snap.id)">
                <div class="flex items-start gap-2">
                    <!-- Number, label, time -->
                    <SnapshotNumberBadge :number="index + 1" class="mt-px" />
                    <div class="min-w-0 flex-1">
                        <!-- Label, after this visit's live dot and the compared marker
                             (no text: rows stay two lines) -->
                        <div class="flex min-w-0 items-center gap-1.5">
                            <span v-if="snap.id === currentId" role="img" class="inline-flex shrink-0"
                                :aria-label="t('snapshots.ThisVisit')" :title="t('snapshots.ThisVisit')">
                                <SnapshotLiveDot />
                            </span>
                            <span v-if="snap.id === comparedId" role="img" class="inline-flex shrink-0"
                                :aria-label="t('snapshots.SideCompared')" :title="t('snapshots.SideCompared')">
                                <GitCompare class="size-3.5 text-muted-foreground" />
                            </span>
                            <span class="min-w-0 truncate text-sm font-semibold">{{ labels.label(snap) }}</span>
                        </div>
                        <div class="mt-1 truncate text-xs text-muted-foreground">{{ labels.when(snap) }}</div>
                    </div>

                    <!-- Row actions: pin toggle, compare with this; faded out (still
                         focusable) until hover / focus with revealActionsOnHover -->
                    <div class="flex shrink-0 flex-col items-center gap-0.5" @click.stop>
                        <div class="flex transition-opacity" :class="revealClass(snap.kept)">
                            <JnTooltip :text="t('snapshots.Pin')" side="left">
                                <Button variant="ghost" size="icon" class="size-7 cursor-pointer"
                                    :class="snap.kept ? 'text-foreground' : 'text-muted-foreground'"
                                    :aria-label="t(snap.kept ? 'snapshots.Unpin' : 'snapshots.Pin')"
                                    :aria-pressed="snap.kept" @click="emit('pin', snap)">
                                    <Pin :class="snap.kept ? 'fill-current' : ''" />
                                </Button>
                            </JnTooltip>
                        </div>
                        <div v-if="snap.id !== selectedId && snap.id !== comparedId" class="flex transition-opacity"
                            :class="revealClass(false)">
                            <JnTooltip :text="t('snapshots.CompareWithThis')" side="left">
                                <Button variant="ghost" size="icon" class="size-7 cursor-pointer text-muted-foreground"
                                    :aria-label="t('snapshots.CompareWithThis')" @click="emit('compare', snap.id)">
                                    <GitCompare />
                                </Button>
                            </JnTooltip>
                        </div>
                        <span v-else class="size-7" aria-hidden="true" />
                    </div>
                </div>
            </li>
        </ul>
    </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pin, GitCompare } from '@lucide/vue';
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
const emit = defineEmits(['select', 'compare', 'pin']);

const { t } = useI18n();
const labels = useSnapshotLabels();

const listEl = ref(null);

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
