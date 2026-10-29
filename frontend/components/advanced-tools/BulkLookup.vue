<!-- Bulk IP Lookup (advanced tool, slug `bulklookup`): IPs pasted or picked out
     of raw logs are geolocated in bulk from the server's local data
     (/api/bulk-lookup) and kept in this browser (composables/use-bulk-lookup.js).
     The overview and Clear all cover the whole stored list; the toolbar
     below them scopes both tabs, IP (the table) and Analysis (statistics
     over the scoped rows, whose entries narrow the scope by adding a token
     to the search). Its search carries free text beside exact `country:` /
     `asn:` / `block:` tokens; a row opens the QueryIP dialog or, where
     listed, the Blocklist tool. With no stored rows, the
     page ends at the input and its run notices. -->
<template>
    <div class="bulk-lookup-section my-4 space-y-4">
        <!-- Top note: what it is for, then how it works and where data comes from -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('bulklookup.Note') }}</p>
            <p>{{ t('bulklookup.Note2', { max: MAX_ROWS.toLocaleString(lang), source: sourceLabel }) }}</p>
        </div>

        <BulkLookupInput ref="inputRef" :rows="rows" :running="isRunning" :progress="progress" @run="onRun" />

        <!-- Outcome of the last run -->
        <p v-if="runError" class="text-sm text-destructive">{{ runError }}</p>
        <!-- A run cut short after part of it was stored: what landed, why it
             stopped, and the button that queries only the rest -->
        <div v-if="paused && !isRunning"
            class="flex flex-col gap-3 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning sm:flex-row sm:items-center">
            <div class="flex flex-1 min-w-0 items-start gap-2">
                <CirclePause class="size-4 mt-0.5 shrink-0" />
                <div class="min-w-0 space-y-0.5">
                    <p class="m-0">{{ t('bulklookup.Paused', pausedParams) }}</p>
                    <p class="m-0 text-xs">{{ t(paused.kind === 'rateLimited' ? 'bulklookup.PausedRateLimited' : 'bulklookup.PausedFailed') }}</p>
                </div>
            </div>
            <Button variant="action" size="sm" class="h-8 w-full shrink-0 cursor-pointer sm:w-auto" @click="onResume">
                <Play class="size-4 shrink-0" />{{ t('bulklookup.Continue', { n: pausedParams.n }) }}
            </Button>
        </div>
        <div v-if="runNotice"
            class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-sm text-warning">
            <TriangleAlert class="size-4 mt-0.5 shrink-0" />
            <span>{{ runNotice }}</span>
        </div>
        <p v-if="storageError" class="text-sm text-destructive">{{ t('bulklookup.StorageError') }}</p>

        <!-- Everything below needs stored rows: an empty list shows none of it -->
        <template v-if="rows.length">
            <!-- Overview: IPs, countries/regions, ASNs, total frequency, and how
                 concentrated it is (top-10 and once-only shares), with Clear all
                 as a secondary action -->
            <section class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                        <ListChecks class="size-4 text-muted-foreground" />{{ t('bulklookup.OverviewTitle') }}
                    </h2>
                    <Button variant="ghost" size="sm"
                        class="h-7 gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-destructive"
                        :disabled="isRunning" @click="openClear">
                        <Trash2 class="size-3.5" />{{ t('bulklookup.ClearAll') }}
                    </Button>
                </div>
                <!-- `title` repeats a value a narrow tile may truncate -->
                <div class="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                    <div v-for="stat in stats" :key="stat.key" class="rounded-md bg-muted/40 p-3 min-w-0">
                        <div class="text-lg font-semibold tabular-nums truncate" :title="stat.value">{{ stat.value }}</div>
                        <div class="text-xs text-muted-foreground">{{ t(`bulklookup.stat.${stat.key}`) }}</div>
                    </div>
                </div>
            </section>

            <!-- Scope of both tabs: fixed tracks, so no selection, language,
                 batch or star count moves it. Mobile: search on its own row. -->
            <div class="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-2 md:grid-cols-[minmax(0,1fr)_14rem_5rem_auto]">
                <div class="relative col-span-3 md:col-span-1">
                    <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <Input v-model="query" type="text" class="pl-8 pr-8 h-8 text-sm"
                        :placeholder="t('bulklookup.FilterPlaceholder')" :aria-label="t('bulklookup.FilterPlaceholder')"
                        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                        data-1p-ignore data-lpignore="true" />
                    <!-- Our clear control, in place of the browser's search one -->
                    <button v-if="query" type="button"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        :aria-label="t('bulklookup.ClearSearch')" @click="query = ''">
                        <X class="size-4" />
                    </button>
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
                <!-- Star filter; the span carries the tooltip so it still
                     shows while the toggle is disabled -->
                <JnTooltip :text="t('bulklookup.StarredOnly')" side="top">
                    <span class="flex min-w-0">
                        <Toggle v-model="starredOnly" variant="outline" size="sm" :disabled="!starredCount"
                            class="h-8 w-full min-w-0 gap-1.5 px-2 text-xs tabular-nums cursor-pointer data-[state=on]:border-warning/40 data-[state=on]:bg-warning/10 data-[state=on]:text-warning data-[state=on]:hover:bg-warning/15 data-[state=on]:hover:text-warning"
                            :aria-label="t('bulklookup.StarredOnly')">
                            <Star class="size-3.5" :class="{ 'fill-current': starredOnly }" />
                            <span class="truncate">{{ starredCount.toLocaleString(lang) }}</span>
                        </Toggle>
                    </span>
                </JnTooltip>
                <Button variant="outline" size="sm" class="h-8 cursor-pointer" :disabled="!tableRows.length"
                    @click="exportCsv">
                    <Download class="size-4" />{{ t('bulklookup.ExportCsv') }}
                </Button>
            </div>

            <Tabs v-model="activeTab">
                <TabsList class="grid w-full grid-cols-2">
                    <!-- The IP tab counts the rows the table shows -->
                    <TabsTrigger value="ips" class="min-w-0 cursor-pointer">
                        <span class="truncate">{{ t('bulklookup.tab.ips') }}<span
                            class="text-muted-foreground tabular-nums"> · {{ formatCount(tableRows.length) }}</span></span>
                    </TabsTrigger>
                    <TabsTrigger value="analysis" class="min-w-0 cursor-pointer"><span class="truncate">{{ t('bulklookup.tab.analysis') }}</span></TabsTrigger>
                </TabsList>

                <TabsContent value="ips" class="mt-3 min-w-0">
                    <BulkLookupTable :rows="tableRows" v-bind="tableProps" :reset-key="tableResetKey" v-on="tableEvents" />
                </TabsContent>

                <TabsContent value="analysis" class="mt-3">
                    <BulkLookupSummary v-model:weight="analysisWeight" :rows="scopedRows" :query="query" @pick="onPick" />
                </TabsContent>
            </Tabs>
        </template>

        <QueryIPDialog v-model:open="detailsOpen" :ip="detailsIP" />
        <BulkLookupNoteDialog v-model:open="noteOpen" :ip="noteIP" :note="noteText" @save="setNote" />

        <!-- Clear-all confirmation -->
        <Dialog :open="clearOpen" @update:open="(v) => (clearOpen = v)">
            <DialogContent :title="t('bulklookup.ClearTitle')" class="max-w-md">
                <DialogHeader class="border-b border-border pb-2" :icon="Trash2" :title="t('bulklookup.ClearTitle')" />
                <div class="space-y-4">
                    <p class="text-sm text-muted-foreground mb-2">{{ t('bulklookup.ClearBody', { n: clearCount }) }}</p>
                    <div v-if="starredCount" class="flex items-center gap-2">
                        <Checkbox id="bulkLookupKeepStarred" v-model="keepStarred" />
                        <Label for="bulkLookupKeepStarred" class="font-normal cursor-pointer">
                            {{ t('bulklookup.KeepStarred', { n: starredCount }) }}
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
    useBulkLookup, MAX_ROWS, compareRows, filterRows, summarizeRows,
    listBatches, buildCsv, downloadCsv, runFailureKind, toggleQueryPick,
} from '@/composables/use-bulk-lookup.js';
import BulkLookupInput from './bulk-lookup/BulkLookupInput.vue';
import BulkLookupTable from './bulk-lookup/BulkLookupTable.vue';
import BulkLookupSummary from './bulk-lookup/BulkLookupSummary.vue';
import BulkLookupNoteDialog from './bulk-lookup/BulkLookupNoteDialog.vue';
import QueryIPDialog from '@/components/widgets/QueryIPDialog.vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Toggle } from '@/components/ui/toggle';
import { JnTooltip } from '@/components/ui/tooltip';
import {
    CirclePause, Download, ListChecks, Play, Search, Star, Trash2, TriangleAlert, X,
} from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();
const lang = computed(() => locale.value);

const {
    rows, source, storageError, progress, paused,
    run, resume, removeRow, clearRows, toggleStar, setNote,
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

// A failed request: logged by kind (only our own defects as errors).
const logFailure = (error, kind) => {
    if (kind === 'error') console.error(`Bulk lookup failed: HTTP ${error.status}`);
    else console.warn('Bulk lookup failed:', error);
};

// The outcome of a run or a resume that stored something.
const settle = (outcome) => {
    if (outcome.paused) logFailure(outcome.error, outcome.paused.kind);
    if (outcome.unanswered) runNotice.value = t('bulklookup.Unanswered', { n: outcome.unanswered });
};

const startRun = async (task) => {
    isRunning.value = true;
    runError.value = '';
    runNotice.value = '';
    try {
        return await task();
    } catch (error) {
        const kind = runFailureKind(error);
        logFailure(error, kind);
        runError.value = t(kind === 'rateLimited' ? 'bulklookup.RunRateLimited' : 'bulklookup.RunFailed');
        return null;
    } finally {
        isRunning.value = false;
    }
};

// A run that stored anything clears the input: pasting it again would count
// its frequency twice. A paused remainder continues from the notice.
const onRun = async (entries) => {
    trackEvent('Section', 'StartClick', 'BulkLookup');
    const outcome = await startRun(() => run(entries, toApiTag(lang.value)));
    // A blocked plan is already explained under the input; a cancelled run
    // (Clear all meanwhile) has nothing to report.
    if (!outcome || outcome.blocked || outcome.cancelled) return;
    inputRef.value?.reset();
    settle(outcome);
};

const onResume = async () => {
    const outcome = await startRun(() => resume(toApiTag(lang.value)));
    if (!outcome || outcome.cancelled) return;
    if (outcome.blocked) {
        runNotice.value = t('bulklookup.status.noRoom', {
            n: outcome.fresh.toLocaleString(lang.value), room: outcome.room.toLocaleString(lang.value), max: MAX_ROWS.toLocaleString(lang.value),
        });
        return;
    }
    settle(outcome);
};

const pausedParams = computed(() => ({
    done: (paused.value?.done ?? 0).toLocaleString(lang.value),
    total: (paused.value?.total ?? 0).toLocaleString(lang.value),
    n: (paused.value?.remaining.length ?? 0).toLocaleString(lang.value),
}));

// ── Overview ─────────────────────────────────────────────────────────────
const formatCount = (n) => n.toLocaleString(lang.value);
// A share in the UI locale; "—" where it isn't meaningful (null).
const formatShare = (share) => {
    if (share === null) return '—';
    try {
        return new Intl.NumberFormat(lang.value, { style: 'percent', maximumFractionDigits: 1 }).format(share);
    } catch {
        return `${(share * 100).toFixed(1)}%`;
    }
};

const STAT_FORMATS = {
    rows: formatCount, countries: formatCount, asns: formatCount, frequency: formatCount,
    topShare: formatShare, onceShare: formatShare,
};
const stats = computed(() => {
    const summary = summarizeRows(rows.value);
    return Object.entries(STAT_FORMATS).map(([key, format]) => ({ key, value: format(summary[key]) }));
});

// ── Views: filters, sort, tabs ───────────────────────────────────────────
const activeTab = ref('ips');
const analysisWeight = ref('ips'); // the Analysis toggle: 'ips' | 'hits'
// The scope's search: free text plus the structured filters (see parseQuery).
const query = ref('');
const batchId = ref('all');
const starredOnly = ref(false);
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

// What both tabs show: the stored rows the toolbar keeps.
const scopedRows = computed(() => filterRows(rows.value, {
    query: query.value,
    batchId: batchId.value === 'all' ? null : batchId.value,
    starredOnly: starredOnly.value,
    countryNames,
}));
const tableRows = computed(() => sortRows(scopedRows.value));

// An Analysis entry drills the shared scope down through the query's
// tokens, so the user's own words and the other filters stay.
const onPick = ({ field, key }) => {
    query.value = toggleQueryPick(query.value, field, key);
};

const starredCount = computed(() => rows.value.filter((row) => row.starred).length);
// The last star gone: a filter left on would show nothing behind a disabled toggle.
watch(starredCount, (n) => {
    if (!n) starredOnly.value = false;
});

// Back to page 1 whenever what the table shows is re-chosen.
const tableResetKey = computed(() => [
    sortKey.value, sortDir.value, query.value, batchId.value, starredOnly.value,
].join('|'));

const onSort = (key) => {
    if (sortKey.value === key) {
        sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortDir.value = key === 'count' ? 'desc' : 'asc';
    }
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
const clearCount = computed(() => rows.value.length - (keepStarred.value ? starredCount.value : 0));
const confirmClear = () => {
    clearRows({ keepStarred: keepStarred.value && starredCount.value > 0 });
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
