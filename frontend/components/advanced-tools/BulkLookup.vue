<!-- Bulk IP Lookup (advanced tool, slug `bulklookup`): IPs pasted or picked out
     of raw logs are geolocated in bulk from the server's local data
     (/api/bulk-lookup) and kept in this browser (composables/use-bulk-lookup.js).
     Table / Summary / Starred / Map views over the same rows; a row opens the
     QueryIP dialog or, where listed, the Blocklist tool. -->
<template>
    <div class="bulk-lookup-section my-4 space-y-4">
        <!-- Top note: what it is for, then how it works and where data comes from -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('bulklookup.Note') }}</p>
            <p>{{ t('bulklookup.Note2', { max: MAX_NEW_PER_RUN, source: sourceLabel }) }}</p>
        </div>

        <BulkLookupInput ref="inputRef" :rows="rows" :running="isRunning" @run="onRun" />

        <!-- Outcome of the last run -->
        <p v-if="runError" class="text-sm text-destructive">{{ runError }}</p>
        <div v-if="runNotice"
            class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning">
            <TriangleAlert class="size-4 mt-0.5 shrink-0" />
            <span>{{ runNotice }}</span>
        </div>
        <p v-if="storageError" class="text-sm text-destructive">{{ t('bulklookup.StorageError') }}</p>

        <!-- Overview: four stat tiles, Clear all as a secondary action. Like
             everything below, laid out before the first run, which only fills it in. -->
        <section class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
            <div class="flex items-center justify-between gap-3">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <ListChecks class="size-4 text-muted-foreground" />{{ t('bulklookup.OverviewTitle') }}
                </h2>
                <Button variant="ghost" size="sm"
                    class="h-7 gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-destructive"
                    :disabled="!rows.length" @click="openClear">
                    <Trash2 class="size-3.5" />{{ t('bulklookup.ClearAll') }}
                </Button>
            </div>
            <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <div v-for="stat in stats" :key="stat.key" class="rounded-md bg-muted/40 p-3 min-w-0">
                    <div class="text-lg font-semibold tabular-nums truncate">{{ stat.value }}</div>
                    <div class="text-xs text-muted-foreground">{{ t(`bulklookup.stat.${stat.key}`) }}</div>
                </div>
            </div>
        </section>

        <Tabs v-model="activeTab">
            <TabsList class="grid w-full grid-cols-4">
                <TabsTrigger value="table" class="min-w-0 cursor-pointer"><span class="truncate">{{ t('bulklookup.tab.table') }}</span></TabsTrigger>
                <TabsTrigger value="summary" class="min-w-0 cursor-pointer"><span class="truncate">{{ t('bulklookup.tab.summary') }}</span></TabsTrigger>
                <TabsTrigger value="starred" class="min-w-0 cursor-pointer"><span class="truncate">{{ t('bulklookup.tab.starred', { n: starredRows.length }) }}</span></TabsTrigger>
                <TabsTrigger value="map" class="min-w-0 cursor-pointer"><span class="truncate">{{ t('bulklookup.tab.map') }}</span></TabsTrigger>
            </TabsList>

            <TabsContent value="table" class="mt-3">
                <section class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
                    <h2 class="flex items-center gap-2 text-base font-semibold mb-2">
                        <TableIcon class="size-4 text-muted-foreground" />{{ t('bulklookup.TableTitle') }}
                    </h2>

                    <!-- Toolbar: fixed tracks, so no selection, language or batch
                         count moves it. Mobile: search on its own row. -->
                    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
                        <div class="relative col-span-2 md:col-span-1">
                            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                            <Input v-model="query" type="search" class="pl-8 h-8 text-sm"
                                :placeholder="t('bulklookup.FilterPlaceholder')" :aria-label="t('bulklookup.FilterPlaceholder')"
                                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                                data-1p-ignore data-lpignore="true" />
                        </div>
                        <Select v-model="batchId" :disabled="batches.length < 2">
                            <SelectTrigger class="h-8 w-full min-w-0 text-xs" :aria-label="t('bulklookup.BatchFilter')">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{{ t('bulklookup.AllBatches') }}</SelectItem>
                                <SelectItem v-for="batch in batches" :key="batch.id" :value="batch.id">
                                    {{ t('bulklookup.BatchLabel', { time: batchTime(batch.at), n: batch.size }) }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" class="h-8 cursor-pointer" :disabled="!tableRows.length"
                            @click="exportCsv">
                            <Download class="size-4" />{{ t('bulklookup.ExportCsv') }}
                        </Button>
                    </div>
                    <div v-if="chips.length" class="flex flex-wrap items-center gap-2">
                        <span v-for="chip in chips" :key="chip.field"
                            class="inline-flex items-center gap-1.5 h-7 rounded-full border bg-muted/50 px-2.5 text-xs max-w-full">
                            <span class="truncate">{{ chip.label }}</span>
                            <button type="button" class="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                                :aria-label="t('bulklookup.RemoveFilter')" @click="clearChip(chip.field)">
                                <X class="size-3.5" />
                            </button>
                        </span>
                    </div>

                    <BulkLookupTable :rows="tableRows" v-bind="tableProps" :reset-key="tableResetKey"
                        :empty-text="t(rows.length ? 'bulklookup.NoMatches' : 'bulklookup.NoRows')" v-on="tableEvents" />
                </section>
            </TabsContent>

            <TabsContent value="summary" class="mt-3">
                <BulkLookupSummary :rows="rows" @pick="onPick" />
            </TabsContent>

            <TabsContent value="starred" class="mt-3">
                <section class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
                    <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                        <Star class="size-4 text-muted-foreground" />{{ t('bulklookup.StarredTitle') }}
                    </h2>
                    <BulkLookupTable :rows="starredRows" v-bind="tableProps" :reset-key="sortResetKey"
                        :empty-text="t('bulklookup.NoStarred')" v-on="tableEvents" />
                </section>
            </TabsContent>

            <TabsContent value="map" class="mt-3">
                <BulkLookupMap :rows="rows" @pick="onPick" />
            </TabsContent>
        </Tabs>

        <QueryIPDialog v-model:open="detailsOpen" :ip="detailsIP" />
        <BulkLookupNoteDialog v-model:open="noteOpen" :ip="noteIP" :note="noteText" @save="setNote" />

        <!-- Clear-all confirmation -->
        <Dialog :open="clearOpen" @update:open="(v) => (clearOpen = v)">
            <DialogContent :title="t('bulklookup.ClearTitle')" class="max-w-md">
                <DialogHeader class="border-b border-border pb-2" :icon="Trash2" :title="t('bulklookup.ClearTitle')" />
                <div class="space-y-4">
                    <p class="text-sm text-muted-foreground mb-2">{{ t('bulklookup.ClearBody', { n: clearCount }) }}</p>
                    <div v-if="starredRows.length" class="flex items-center gap-2">
                        <Checkbox id="bulkLookupKeepStarred" v-model="keepStarred" />
                        <Label for="bulkLookupKeepStarred" class="font-normal cursor-pointer">
                            {{ t('bulklookup.KeepStarred', { n: starredRows.length }) }}
                        </Label>
                    </div>
                    <div class="flex justify-end gap-2 mt-2">
                        <Button variant="outline" class="cursor-pointer" @click="clearOpen = false">{{ t('bulklookup.Cancel') }}</Button>
                        <Button variant="destructive" class="cursor-pointer" @click="confirmClear">{{ t('bulklookup.ClearConfirm') }}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { toApiTag } from '@/utils/locale-registry.js';
import { isoToDateTime, formatIsoDate } from '@/utils/time-utils.js';
import { isToolAvailable } from '@/utils/tool-availability.js';
import { TOOL_BY_SLUG } from '@/data/tools.js';
import getCountryName from '@/data/country-name.js';
import {
    useBulkLookup, MAX_NEW_PER_RUN, compareRows, filterRows, summarizeRows, listBatches, buildCsv, downloadCsv,
    runFailureKind,
} from '@/composables/use-bulk-lookup.js';
import BulkLookupInput from './bulk-lookup/BulkLookupInput.vue';
import BulkLookupTable from './bulk-lookup/BulkLookupTable.vue';
import BulkLookupSummary from './bulk-lookup/BulkLookupSummary.vue';
import BulkLookupMap from './bulk-lookup/BulkLookupMap.vue';
import BulkLookupNoteDialog from './bulk-lookup/BulkLookupNoteDialog.vue';
import QueryIPDialog from '@/components/widgets/QueryIPDialog.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, ListChecks, Search, Star, Table as TableIcon, Trash2, TriangleAlert, X } from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();
const lang = computed(() => locale.value);

const {
    rows, source, storageError,
    run, removeRow, clearRows, toggleStar, setNote,
} = useBulkLookup();

const SOURCE_NAMES = { maxmind: 'MaxMind GeoLite2' };

const countryName = (code) => getCountryName(code, lang.value);
// Search matches a country by its UI-language name and its English one.
const countryNames = [countryName, (code) => getCountryName(code, 'en')];

// ── Run ──────────────────────────────────────────────────────────────────
const inputRef = ref(null);
const isRunning = ref(false);
const runError = ref('');
const runNotice = ref('');

const onRun = async (entries) => {
    isRunning.value = true;
    runError.value = '';
    runNotice.value = '';
    trackEvent('Section', 'StartClick', 'BulkLookup');
    try {
        const outcome = await run(entries, toApiTag(lang.value));
        // A blocked plan is already explained under the input.
        if (outcome.blocked) return;
        inputRef.value?.reset();
        if (outcome.unanswered) runNotice.value = t('bulklookup.Unanswered', { n: outcome.unanswered });
    } catch (error) {
        const kind = runFailureKind(error);
        if (kind === 'error') console.error(`Bulk lookup failed: HTTP ${error.status}`);
        else console.warn('Bulk lookup failed:', error);
        runError.value = t(kind === 'rateLimited' ? 'bulklookup.RunRateLimited' : 'bulklookup.RunFailed');
    } finally {
        isRunning.value = false;
    }
};

// ── Overview ─────────────────────────────────────────────────────────────
const stats = computed(() => {
    const summary = summarizeRows(rows.value);
    const format = (n) => n.toLocaleString(lang.value);
    return [
        { key: 'rows', value: format(summary.rows) },
        { key: 'countries', value: format(summary.countries) },
        { key: 'asns', value: format(summary.asns) },
        { key: 'occurrences', value: format(summary.occurrences) },
    ];
});

// ── Views: filters, sort, tabs ───────────────────────────────────────────
const activeTab = ref('table');
const query = ref('');
const batchId = ref('all');
const countryFilter = ref(null); // code, '' = unknown, null = any
const asnFilter = ref(null);
const sortKey = ref('count');
const sortDir = ref('desc');

const batches = computed(() => listBatches(rows.value));
const batchTime = (at) => isoToDateTime(new Date(at).toISOString(), lang.value);
// A batch whose rows are all gone stops filtering.
watch(batches, (list) => {
    if (batchId.value !== 'all' && !list.some((batch) => batch.id === batchId.value)) batchId.value = 'all';
});

const collator = computed(() => new Intl.Collator(lang.value));
const sortRows = (list) => [...list].sort(compareRows(sortKey.value, sortDir.value, {
    countryName, compareText: collator.value.compare,
}));

const tableRows = computed(() => sortRows(filterRows(rows.value, {
    query: query.value,
    batchId: batchId.value === 'all' ? null : batchId.value,
    country: countryFilter.value,
    asn: asnFilter.value,
    countryNames,
})));
const starredRows = computed(() => sortRows(rows.value.filter((row) => row.starred)));

// Back to page 1 whenever what the table shows is re-chosen.
const sortResetKey = computed(() => `${sortKey.value}|${sortDir.value}`);
const tableResetKey = computed(() => [
    sortResetKey.value, query.value, batchId.value, countryFilter.value, asnFilter.value,
].join('|'));

const onSort = (key) => {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortDir.value = key === 'count' ? 'desc' : 'asc';
    }
};

// Summary / Map entry → filter chip, then the table.
const onPick = ({ field, key }) => {
    if (field === 'country') countryFilter.value = key;
    else asnFilter.value = key;
    activeTab.value = 'table';
};

const chips = computed(() => [
    countryFilter.value !== null && {
        field: 'country',
        label: t('bulklookup.FilterCountry', {
            name: countryFilter.value ? countryName(countryFilter.value) || countryFilter.value : t('bulklookup.Unknown'),
        }),
    },
    asnFilter.value !== null && {
        field: 'asn',
        label: t('bulklookup.FilterAsn', { asn: asnFilter.value || t('bulklookup.Unknown') }),
    },
].filter(Boolean));
const clearChip = (field) => {
    if (field === 'country') countryFilter.value = null;
    else asnFilter.value = null;
};

// ── Row actions ──────────────────────────────────────────────────────────
const detailsOpen = ref(false);
const detailsIP = ref('');
const openDetails = (ip) => {
    detailsIP.value = ip;
    detailsOpen.value = true;
};

// The Blocklist tool's own registry gate (original site only).
const blocklistAvailable = computed(() => isToolAvailable(TOOL_BY_SLUG.get('blocklist'), store.configs));

const tableProps = computed(() => ({
    sortKey: sortKey.value,
    sortDir: sortDir.value,
    blocklistAvailable: blocklistAvailable.value,
}));
const noteOpen = ref(false);
const noteIP = ref('');
const noteText = computed(() => rows.value.find((row) => row.ip === noteIP.value)?.note ?? '');
const editNote = (ip) => {
    noteIP.value = ip;
    noteOpen.value = true;
};

const tableEvents = {
    sort: onSort,
    star: toggleStar,
    remove: removeRow,
    details: openDetails,
    'edit-note': editNote,
};

// ── Clear all ────────────────────────────────────────────────────────────
const clearOpen = ref(false);
const keepStarred = ref(true);
const openClear = () => {
    keepStarred.value = true;
    clearOpen.value = true;
};
const clearCount = computed(() => rows.value.length - (keepStarred.value ? starredRows.value.length : 0));
const confirmClear = () => {
    clearRows({ keepStarred: keepStarred.value && starredRows.value.length > 0 });
    clearOpen.value = false;
};

// ── CSV export of the filtered table ─────────────────────────────────────
const exportCsv = () => {
    downloadCsv(buildCsv(tableRows.value, { countryName }), `bulk-ip-lookup-${new Date().toISOString().slice(0, 10)}.csv`);
    trackEvent('BulkLookup', 'ExportClick', 'CSV');
};

// ── Data source, named in Note 2 ─────────────────────────────────────────
const sourceLabel = computed(() => {
    const id = store.configs?.bulkLookupSource || source.value?.id;
    const name = id ? SOURCE_NAMES[id] ?? id : '';
    if (!name) return t('bulklookup.SourceFallback');
    const build = source.value?.build ? formatIsoDate(source.value.build, lang.value) : '';
    return build ? t('bulklookup.SourceWithBuild', { source: name, date: build }) : name;
});
</script>
