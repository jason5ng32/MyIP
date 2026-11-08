<!-- Snapshots (advanced tool, slug `snapshots`): the per-visit records the
     snapshot recorder (composables/use-snapshot-recorder.js) keeps of the
     homepage tests, read-only. A list of snapshots (newest first;
     snapshots/SnapshotList.vue — the left column on ≥1024px under the save
     button, below that a Sheet opened by "All snapshots" beside the save button) beside the
     selected one, compared by default with the one before it or with one
     picked by hand: the five homepage sections as a code diff (a block per
     section, a hunk per item, a −/+ line pair per changed field; split on
     ≥1024px by default, else unified). Nothing here judges a value — −/+ mean
     removed / added, never worse / better (plan red line). Snapshots can be
     renamed (a dialog), pinned or deleted (a second click confirms), or
     saved on demand from this visit's results (running the homepage tests first when there
     are none yet; use-snapshot-save.js).

     The view rides the URL: `?q=<id>` is the snapshot shown, `?vs=<id>` a
     specific one compared (absent: the previous one); written back on every
     change. -->
<template>
  <div class="snapshots-section my-4 space-y-4">
    <!-- Top note: what it does, then how it works (privacy included) -->
    <div class="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
      <p class="m-0">{{ t('snapshots.Note') }}</p>
    </div>
    <p v-if="storageFailed" class="m-0 text-sm text-destructive">{{ t('snapshots.StorageFailed') }}</p>

    <!-- Empty state, with the manual save -->
    <Card v-if="!snapshots.length" class="jn-card">
      <CardContent class="flex flex-col items-center gap-2 p-8 text-center">
        <Camera class="size-8 text-muted-foreground" />
        <p class="m-0 font-medium">{{ t('snapshots.EmptyTitle') }}</p>
        <p class="m-0 max-w-md text-sm text-muted-foreground">{{ t('snapshots.EmptyNote') }}</p>
        <div class="mt-2 w-full max-w-xs">
          <SnapshotSaveButton :running="saving" class="w-full" @save="onSaveNow" />
        </div>
      </CardContent>
    </Card>

    <div v-else class="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <!-- Left column (≥1024px): the save button over the snapshot list -->
      <aside class="max-lg:hidden lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-3">
        <SnapshotSaveButton :running="saving" class="w-full" @save="onSaveNow" />
        <SnapshotList :snapshots="snapshots" :selected-id="selected?.id ?? null" :current-id="currentId"
          :compared-id="compared?.id ?? null" keyboard reveal-actions-on-hover
          class="jn-card rounded-xl border bg-card p-2 lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto"
          @select="select" @compare="compareWith" @pin="onKeep" />
      </aside>

      <!-- Main column: the selected snapshot -->
      <div v-if="selected" class="min-w-0 space-y-4">
        <!-- Action row (below 1024px): "All snapshots" (opens the list Sheet)
                     beside a stretching save; from 1024px the left column has both -->
        <div class="flex items-center gap-2 lg:hidden">
          <Button variant="outline" class="shrink-0 cursor-pointer" @click="listSheetOpen = true">
            <List />
            {{ t('snapshots.AllSnapshots') }}
          </Button>
          <SnapshotSaveButton :running="saving" class="flex-1" @save="onSaveNow" />
        </div>

        <!-- The snapshot card: label + actions, when, then the compare controls -->
        <section class="min-w-0 space-y-3 rounded-lg border bg-card p-4">
          <!-- Row 1: label (truncating) and the icon-only actions — pin
                         toggle (its pressed state marks a pinned one), rename, delete -->
          <div class="flex items-center gap-3">
            <h2 class="m-0 min-w-0 flex-1 truncate text-xl font-semibold tracking-tight md:text-2xl"
              :title="labels.label(selected)">
              {{ labels.label(selected) }}
            </h2>
            <div class="flex shrink-0 items-center gap-1.5">
              <JnTooltip :text="t(selected.kept ? 'snapshots.Unpin' : 'snapshots.Pin')">
                <Button variant="outline" size="icon" class="size-8 cursor-pointer"
                  :class="selected.kept ? 'bg-muted' : ''" :aria-pressed="selected.kept"
                  :aria-label="t(selected.kept ? 'snapshots.Unpin' : 'snapshots.Pin')" @click="onKeep(selected)">
                  <Pin :class="selected.kept ? 'fill-current' : ''" />
                </Button>
              </JnTooltip>
              <JnTooltip :text="t('snapshots.Rename')">
                <Button variant="outline" size="icon" class="size-8 cursor-pointer" :aria-label="t('snapshots.Rename')"
                  @click="openRename(selected.id)">
                  <Pencil />
                </Button>
              </JnTooltip>
              <!-- Two-step delete, as ConnectivityTest's remove: the first click
                                 arms "trash ?" (self-reverting), the second deletes -->
              <JnTooltip :text="t('snapshots.Delete')">
                <Button variant="outline" size="icon" class="h-8 cursor-pointer"
                  :class="deleteArmed ? 'w-auto gap-0.5 bg-muted px-2 text-destructive hover:text-destructive' : 'w-8'"
                  :aria-label="t('snapshots.Delete')" @click="onDeleteClick">
                  <Trash2 />
                  <span v-if="deleteArmed" class="text-xs font-semibold leading-none">?</span>
                </Button>
              </JnTooltip>
            </div>
          </div>

          <!-- Row 2: the auto label under a name, the date-time, the "This visit" pill -->
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground min-h-6">
            <span v-if="selected.name" class="inline-flex min-w-0 max-w-full items-center gap-1.5">
              <Icon v-if="flagOf(selected)" :icon="'circle-flags:' + flagOf(selected)" class="size-4 shrink-0" />
              <span class="truncate">{{ labels.auto(selected) }}</span>
              <span class="shrink-0" aria-hidden="true">·</span>
            </span>
            <span>{{ labels.when(selected) }}</span>
            <SnapshotVisitPill v-if="selected.id === currentId" />
          </div>

          <!-- Row 3, compare: one Select — "Previous snapshot" (no `vs`) first,
                         then every other snapshot (`vs=<id>`), label over its date-time,
                         the label alone in the trigger; capped to the screen. Full width
                         on phones with the drift switch (+ layout on ≥1024px) right-aligned
                         beneath; one wrapping row from 640px. -->
          <div v-if="others.length"
            class="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            <div class="flex min-w-0 items-center gap-2 sm:min-w-48 sm:flex-1">
              <Label for="snapshotCompare" class="shrink-0 whitespace-nowrap font-normal text-muted-foreground">
                {{ t('snapshots.CompareWith') }}
              </Label>
              <Select :model-value="compareValue" @update:model-value="onCompareChange">
                <SelectTrigger id="snapshotCompare" :aria-label="t('snapshots.CompareWith')"
                  class="w-full max-w-full min-w-0 flex-1 sm:max-w-md">
                  <SelectValue>
                    <span class="truncate">{{ compareTriggerText }}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent class="max-w-[calc(100vw-2rem)]">
                  <SelectItem :value="PREVIOUS_OPTION">{{ t('snapshots.ComparePrevious') }}</SelectItem>
                  <SelectItem v-for="snap in others" :key="snap.id" :value="snap.id"
                    class="min-w-0 [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1">
                    <span class="flex min-w-0 flex-col">
                      <span class="truncate">{{ labels.label(snap) }}</span>
                      <span class="truncate text-xs text-muted-foreground">{{ labels.when(snap) }}</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="diff" class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:justify-start">
              <div class="flex shrink-0 items-center gap-2">
                <Switch id="snapshotDrift" v-model="showDrift" />
                <Label for="snapshotDrift" class="cursor-pointer whitespace-nowrap font-normal text-muted-foreground">
                  {{ t('snapshots.ShowDrift') }}
                </Label>
              </div>
              <ToggleGroup :model-value="layout" type="single" variant="outline" size="sm"
                class="shrink-0 max-lg:hidden" :aria-label="t('snapshots.LayoutLabel')"
                @update:model-value="(v) => v && (layout = v)">
                <ToggleGroupItem value="unified" class="cursor-pointer px-2.5 text-xs">{{ t('snapshots.LayoutUnified')
                  }}</ToggleGroupItem>
                <ToggleGroupItem value="split" class="cursor-pointer px-2.5 text-xs">{{ t('snapshots.LayoutSplit') }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <p v-if="!diff" class="m-0 text-sm text-muted-foreground">{{ t('snapshots.OldestNote') }}</p>
        </section>

        <!-- The five homepage sections as diff blocks -->
        <div class="space-y-4 pt-2">
          <SnapshotDiffBlock v-for="block in blocks" :key="block.id" :section-id="block.id" :hunks="block.hunks"
            :notice="block.notice" :comparing="!!diff" :split="split" :view-key="viewKey" />
        </div>
      </div>
    </div>

    <SnapshotRenameDialog v-model:open="renameOpen" :name="renameTarget?.name ?? ''"
      :placeholder="renameTarget ? labels.auto(renameTarget) : ''" @save="onRename" />

    <!-- Below 1024px: the snapshot list in a Sheet, from the right (the Nav
             menu and Preferences open from the left). Picking a row or a
             compare target closes it. -->
    <Sheet v-model:open="listSheetOpen">
      <SheetContent side="right" :title="t('snapshots.AllSnapshots')"
        class="flex w-full max-w-full flex-col gap-0 p-0 sm:w-96 sm:max-w-96">
        <header class="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
          <h2 class="m-0 flex items-center gap-2 text-base font-semibold">
            <List class="size-4 text-muted-foreground" />
            {{ t('snapshots.AllSnapshots') }}
          </h2>
          <SheetClose
            class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        </header>
        <div class="flex-1 overflow-y-auto p-2">
          <SnapshotList :snapshots="snapshots" :selected-id="selected?.id ?? null" :current-id="currentId"
            :compared-id="compared?.id ?? null" id-prefix="snapshot-sheet-row-" @select="onSheetSelect"
            @compare="onSheetCompare" @pin="onKeep" />
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import {
  Camera, Pin, Pencil, Trash2, List,
} from '@lucide/vue';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { JnTooltip } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useActiveValue, useRouteActive } from '@/composables/use-route-active.js';
import { useSnapshots } from '@/composables/use-snapshot-recorder.js';
import { useSnapshotLabels } from '@/composables/use-snapshot-labels.js';
import { useSnapshotSave } from '@/composables/use-snapshot-save.js';
import { HOME_SECTION_IDS, MAX_KEPT_SNAPSHOTS, labelCardOf } from '@/utils/features/snapshots.js';
import { diffSnapshots } from '@/utils/features/snapshot-diff.js';
import {
  COMPARE_PREVIOUS, COMPARE_SPECIFIC, resolveSnapshotView, snapshotViewQuery,
} from '@/utils/features/snapshot-view.js';
import { buildHunks, blockNotice } from '@/utils/features/snapshot-diff-format.js';
import SnapshotDiffBlock from './snapshots/SnapshotDiffBlock.vue';
import SnapshotRenameDialog from './snapshots/SnapshotRenameDialog.vue';
import SnapshotList from './snapshots/SnapshotList.vue';
import SnapshotVisitPill from './snapshots/SnapshotVisitPill.vue';
import SnapshotSaveButton from './snapshots/SnapshotSaveButton.vue';

const { t } = useI18n();
const store = useMainStore();
const route = useRoute();
const router = useRouter();
const labels = useSnapshotLabels();
const {
  snapshots, currentId, storageFailed, rename, keep, remove,
} = useSnapshots();
const { saving, save } = useSnapshotSave({ store, router });

// --- view state (the URL) ---------------------------------------------------

const active = useRouteActive();
const isOwnRoute = () => route.name === 'tool' && route.params.slug === 'snapshots';
const routeQuery = useActiveValue(() => route.query, { pathOf: () => route.path });

const ids = computed(() => snapshots.value.map((snap) => snap.id));
const view = computed(() => resolveSnapshotView(ids.value, routeQuery.value ?? {}, currentId.value));
const byId = (id) => snapshots.value.find((snap) => snap.id === id) ?? null;
const selected = computed(() => byId(view.value.selectedId));
const compared = computed(() => byId(view.value.comparedId));

// `vs` is written only for a specific snapshot; other query keys stay.
const goTo = (next) => {
  const query = snapshotViewQuery(next);
  if (!query.q || !isOwnRoute()) return;
  if (route.query.q === query.q && route.query.vs === query.vs) return;
  const rest = { ...route.query };
  delete rest.q;
  delete rest.vs;
  router.replace({ query: { ...rest, ...query } });
};

// Spells the resolved view out in the URL: a missing, unknown or deleted id
// lands on its fallback.
watch(() => [view.value.selectedId, view.value.comparedId, view.value.mode, active.value], () => {
  if (active.value) goTo(view.value);
}, { immediate: true });

// A newly selected snapshot is compared with the one before it.
const select = (id) => {
  if (id === view.value.selectedId) return;
  goTo({ selectedId: id, mode: COMPARE_PREVIOUS });
};
const compareWith = (id) => goTo({ selectedId: view.value.selectedId, comparedId: id, mode: COMPARE_SPECIFIC });

// The compare Select: "Previous snapshot" (a value no snapshot id can take,
// see ID_PATTERN in snapshots.js) drops `vs`; a snapshot id sets it.
const PREVIOUS_OPTION = ':previous';
const compareValue = computed(() => (view.value.mode === COMPARE_SPECIFIC ? view.value.comparedId : PREVIOUS_OPTION));
const compareTriggerText = computed(() => (view.value.mode === COMPARE_SPECIFIC && compared.value
  ? labels.label(compared.value) : t('snapshots.ComparePrevious')));
const onCompareChange = (value) => {
  if (!value || value === compareValue.value) return;
  if (value === PREVIOUS_OPTION) goTo({ selectedId: view.value.selectedId, mode: COMPARE_PREVIOUS });
  else compareWith(value);
};

// --- list -------------------------------------------------------------------

const flagOf = (snap) => labelCardOf(snap)?.countryCode?.toLowerCase() ?? '';

// The list Sheet (below 1024px). The `ui/` Sheet root closes it when the page
// is left (kept alive: use-overlay-shortcuts.js); widening past 1024px,
// where the column shows, closes it too.
const listSheetOpen = ref(false);
const onSheetSelect = (id) => {
  select(id);
  listSheetOpen.value = false;
};
const onSheetCompare = (id) => {
  compareWith(id);
  listSheetOpen.value = false;
};

// --- actions ----------------------------------------------------------------

// Saved here → select it; 'returned' came back through the URL already.
const onSaveNow = async () => {
  trackEvent('Snapshots', 'SaveClick', 'Manual');
  const { status, id } = await save();
  if (status === 'saved') select(id);
  else if (status === 'failed') store.setAlert(true, '', '', t('snapshots.SaveNowFailed'), 5000);
};

const onKeep = (snap) => {
  if (keep(snap.id, !snap.kept)) return;
  store.setAlert(true, 'text-warning', t('snapshots.PinLimit', { max: MAX_KEPT_SNAPSHOTS }),
    t('snapshots.PinLimitTitle'), 5000);
};

// Rename dialog: empty restores the auto label.
const renameOpen = ref(false);
const renameId = ref(null);
const renameTarget = computed(() => byId(renameId.value));
const openRename = (id) => {
  renameId.value = id;
  renameOpen.value = true;
};
const onRename = (name) => {
  if (renameId.value) rename(renameId.value, name);
};

// Two-step delete, as ConnectivityTest's remove: the first click shows "?"
// beside the trash icon, a second within 3 s deletes; it reverts after that,
// on another snapshot or when the page is left.
const DELETE_CONFIRM_MS = 3000;
const deleteArmed = ref(false);
let deleteRevertTimer = null;
const disarmDelete = () => {
  clearTimeout(deleteRevertTimer);
  deleteArmed.value = false;
};
const onDeleteClick = () => {
  const id = selected.value?.id;
  if (!id) return;
  if (deleteArmed.value) {
    disarmDelete();
    remove(id);
    return;
  }
  clearTimeout(deleteRevertTimer);
  deleteArmed.value = true;
  deleteRevertTimer = setTimeout(() => { deleteArmed.value = false; }, DELETE_CONFIRM_MS);
};
watch(() => selected.value?.id, disarmDelete);
watch(active, (isActive) => { if (!isActive) disarmDelete(); });
onBeforeUnmount(() => clearTimeout(deleteRevertTimer));

// --- comparison -------------------------------------------------------------

// Every snapshot but the shown one: the compare Select's snapshot options.
const others = computed(() => snapshots.value.filter((snap) => snap.id !== selected.value?.id));

const diff = computed(() => (selected.value && compared.value ? diffSnapshots(compared.value, selected.value) : null));

// --- diff view --------------------------------------------------------------

// Remembered for this page's life only; split applies on ≥1024px.
const layout = ref('split'); // 'unified' | 'split'
const showDrift = ref(true);
const isWide = useMediaQuery('(min-width: 1024px)');
watch(isWide, (wide) => { if (wide) listSheetOpen.value = false; });
const split = computed(() => !!diff.value && isWide.value && layout.value === 'split');
const viewKey = computed(() => `${selected.value?.id ?? ''}:${compared.value?.id ?? ''}`);

const blocks = computed(() => (selected.value ? HOME_SECTION_IDS.map((id) => {
  const viewedSection = selected.value.sections?.[id];
  const comparedSection = diff.value ? compared.value?.sections?.[id] : undefined;
  return {
    id,
    notice: blockNotice(viewedSection, comparedSection, !!diff.value),
    hunks: buildHunks(id, diff.value?.sections[id] ?? null, viewedSection, comparedSection, { showDrift: showDrift.value }),
  };
}) : []));
</script>
