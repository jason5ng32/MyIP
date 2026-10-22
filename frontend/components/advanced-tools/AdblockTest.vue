<template>
    <div class="adblock-test-section my-4 space-y-4">
        <!-- Top note: what it tests, how to read it, what leaves the browser -->
        <div class="text-sm text-muted-foreground space-y-1.5 leading-relaxed">
            <p>{{ t('adblocktest.Note') }}</p>
            <p>{{ t('adblocktest.Note2') }}</p>
            <p>{{ t('adblocktest.Note3') }}</p>
        </div>

        <!-- Probe picker (left) + results (right), GlobalLatencyTest's layout -->
        <Card>
            <CardContent class="p-0">
                <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    <!-- Left: tally + bulk actions on top (sticky, as in the
                         Globalping picker), then one section per group whose
                         header doubles as select-all. Once results exist the
                         column matches their height. -->
                    <div class="col-span-1" :class="hasResults ? 'md:relative md:min-h-96' : ''">
                        <div class="max-h-72 overflow-y-auto"
                            :class="hasResults ? 'md:max-h-none md:absolute md:inset-0' : 'md:max-h-128'">
                            <div class="px-4 py-3 space-y-4">
                                <div
                                    class="sticky top-0 z-10 -mt-3 pt-3 bg-card pb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>
                                        {{ t('adblocktest.Selected') }}
                                        <span class="tabular-nums">{{ selectedTargetCount }}</span>
                                    </span>
                                    <span class="flex items-center gap-3">
                                        <button type="button" class="cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                                            :disabled="isRunning" @click="selectAll">
                                            {{ t('adblocktest.SelectAll') }}
                                        </button>
                                        <button type="button" class="cursor-pointer hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                                            :disabled="isRunning" @click="invert">
                                            {{ t('adblocktest.Invert') }}
                                        </button>
                                    </span>
                                </div>
                                <div v-for="group in ADBLOCK_PROBE_GROUPS" :key="group.id" class="space-y-2">
                                    <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                        <Checkbox :model-value="groupState(group)" :disabled="isRunning"
                                            @update:model-value="(v) => toggleGroup(group, v)">
                                            <Minus v-if="groupState(group) === 'indeterminate'" class="size-3" />
                                            <Check v-else class="size-3.5" />
                                        </Checkbox>
                                        {{ t(`adblocktest.group.${group.id}.title`) }}
                                    </label>
                                    <div class="flex flex-col gap-1.5 pl-6">
                                        <label v-for="vendor in group.vendors" :key="vendor.id"
                                            class="flex items-center gap-2 text-sm min-w-0"
                                            :class="isRunning ? 'opacity-50' : 'cursor-pointer'">
                                            <Checkbox :model-value="isSelected(group, vendor)" :disabled="isRunning"
                                                @update:model-value="(v) => setVendor(group, vendor, v)" />
                                            <span class="truncate">{{ vendorName(group, vendor) }}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: toolbar (hint + run / run again), then results -->
                    <div class="col-span-3 min-w-0 flex flex-col">
                        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b">
                            <span class="text-sm text-muted-foreground">{{ t('adblocktest.Hint') }}</span>
                            <Button variant="action" :disabled="!canRun" class="cursor-pointer ml-auto" @click="startTest">
                                <Spinner v-if="isRunning" />
                                <RotateCw v-else-if="hasFinished" class="size-4 shrink-0" />
                                <Play v-else class="size-4 shrink-0" />
                                {{ t(hasFinished ? 'adblocktest.Rerun' : 'adblocktest.Run') }}
                            </Button>
                        </div>

                        <div v-if="hasResults" class="p-4 space-y-5">
                            <!-- Summary: score, counts, where the blocking happens -->
                            <div class="space-y-3">
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div class="rounded-md bg-muted/50 px-3 py-2">
                                        <div class="text-xs text-muted-foreground">{{ t('adblocktest.Score') }}</div>
                                        <div class="text-2xl font-semibold tabular-nums">
                                            {{ requestTally.score ?? '—' }}<span class="text-base">%</span>
                                        </div>
                                    </div>
                                    <div v-for="key in STATUS_KEYS" :key="key" class="rounded-md bg-muted/50 px-3 py-2">
                                        <div class="flex items-center gap-1.5 text-xs" :class="textClass(statusTone(key))">
                                            <component :is="STATUS_ICON[key]" class="size-3.5 shrink-0" />
                                            {{ t(`adblocktest.count.${key}`) }}
                                        </div>
                                        <div class="text-2xl font-semibold tabular-nums"
                                            :class="requestTally[key] > 0 ? textClass(statusTone(key)) : 'text-muted-foreground'">
                                            {{ requestTally[key] }}
                                        </div>
                                    </div>
                                </div>
                                <p v-if="isRunning" class="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Spinner class="size-4" />
                                    {{ t('adblocktest.Progress', { done: answeredCount, total: runPlan.length }) }}
                                </p>
                                <Alert v-else-if="layer">
                                    <Info />
                                    <AlertDescription>{{ t(`adblocktest.layer.${layer}`) }}</AlertDescription>
                                </Alert>
                            </div>

                            <!-- Filter tags -->
                            <ToggleGroup :model-value="filter" type="single" variant="outline" :spacing="2"
                                class="w-full flex-wrap justify-start"
                                @update:model-value="(v) => v && (filter = v)">
                                <ToggleGroupItem v-for="f in FILTERS" :key="f" :value="f" :class="tagClass">
                                    {{ t(`adblocktest.filter.${f}`) }}
                                </ToggleGroupItem>
                            </ToggleGroup>

                            <!-- One block per tested group -->
                            <section v-for="group in visibleGroups" :key="group.id" class="space-y-2">
                                <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                                    <h3 class="text-sm font-semibold m-0">{{ t(`adblocktest.group.${group.id}.title`) }}</h3>
                                    <span class="text-xs text-muted-foreground tabular-nums">
                                        {{ t('adblocktest.GroupCount', { blocked: group.counts.blocked, total: group.counts.total }) }}
                                    </span>
                                    <p class="basis-full text-xs text-muted-foreground m-0">
                                        {{ t(`adblocktest.group.${group.id}.desc`) }}
                                    </p>
                                </header>
                                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                    <div v-for="vendor in group.vendors" :key="vendor.key"
                                        class="rounded-lg border bg-card min-w-0">
                                        <!-- Tile header: name + a count per status (no blended
                                             color); toggles the per-address list -->
                                        <button type="button"
                                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm cursor-pointer"
                                            :aria-expanded="isExpanded(vendor)"
                                            @click="toggleExpanded(vendor)">
                                            <span class="truncate flex-1 font-medium">{{ vendor.name }}</span>
                                            <Spinner v-if="isRunning && vendor.counts.pending > 0"
                                                class="size-3.5 text-muted-foreground" />
                                            <template v-for="key in STATUS_KEYS" :key="key">
                                                <span v-if="vendor.counts[key] > 0"
                                                    class="flex items-center gap-0.5 text-xs tabular-nums shrink-0"
                                                    :class="textClass(statusTone(key))"
                                                    :title="t(`adblocktest.status.${key}`)">
                                                    <component :is="STATUS_ICON[key]" class="size-3.5" />
                                                    {{ vendor.counts[key] }}
                                                </span>
                                            </template>
                                            <ChevronDown class="size-3.5 shrink-0 text-muted-foreground transition-transform"
                                                :class="isExpanded(vendor) ? 'rotate-180' : ''" />
                                        </button>
                                        <ul v-if="isExpanded(vendor)" class="border-t px-3 py-2 space-y-1">
                                            <li v-for="item in vendor.items" :key="item.id"
                                                class="flex items-center gap-2 text-xs min-w-0"
                                                :title="item.url ? `${item.url} · ${t(`adblocktest.status.${statusOf(item)}`)}` : ''">
                                                <Spinner v-if="statusOf(item) === 'pending'" class="size-3.5 text-muted-foreground" />
                                                <component v-else :is="STATUS_ICON[statusOf(item)]" class="size-3.5 shrink-0"
                                                    :class="textClass(statusTone(statusOf(item)))" />
                                                <span v-if="item.kind === 'cosmetic'">
                                                    {{ t(`adblocktest.cosmeticStatus.${statusOf(item)}`) }}
                                                </span>
                                                <span v-else class="font-mono truncate">{{ item.target }}</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </section>

                            <p v-if="!visibleGroups.length" class="text-sm text-muted-foreground text-center py-4">
                                {{ t(filter === 'blocked' ? 'adblocktest.NothingBlocked' : 'adblocktest.NothingOpen') }}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <!-- Probe list version + what the probes cannot tell -->
        <div v-if="hasResults" class="text-xs text-muted-foreground m-0 space-y-1">
            <p class="text-xs text-muted-foreground m-0">
                {{ t('adblocktest.Version', { version: ADBLOCK_PROBES_VERSION }) }}
            </p>
            <p class="text-xs text-muted-foreground mt-1">{{ t('adblocktest.Limitation') }}</p>
        </div>

        <!-- Cosmetic baits live here during a run, off-screen but laid out -->
        <div ref="baitHost" aria-hidden="true" class="pointer-events-none fixed left-[-10000px] top-0 w-24"></div>
    </div>
</template>

<script setup>
// Ad & Tracker Blocking Test (/tools/adblocktest): checks what the visitor's
// blocker — extension, browser, DNS service, VPN or router — lets through.
// Nothing runs on open; every probe group starts selected. Pure logic lives
// in utils/features/adblock-test.js, the probe list in data/adblock-probes.js.
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { ADBLOCK_PROBE_GROUPS, ADBLOCK_PROBES_VERSION } from '@/data/adblock-probes.js';
import {
    COSMETIC_BAITS, COSMETIC_POLL_MS, COSMETIC_WAIT_MS,
    allVendorKeys, blockingLayer, buildPlan, invertSelection, isBaitHidden,
    probeLimits, probeRequest, runWithConcurrency, statusTone, tally, vendorKey,
} from '@/utils/features/adblock-test.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Ban, Check, ChevronDown, CircleArrowRight, CircleQuestionMark, Info, Minus, Play, RotateCw,
} from '@lucide/vue';

const { t } = useI18n();
const { textClass } = useStatusTone();

const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';
const FILTERS = ['all', 'open', 'blocked'];
// Answered statuses, in display order (tiles, tile counts).
const STATUS_KEYS = ['blocked', 'open', 'unknown'];
const STATUS_ICON = { blocked: Ban, open: CircleArrowRight, unknown: CircleQuestionMark };

/* ---------- Selection (left column) ---------- */

const ALL_KEYS = allVendorKeys(ADBLOCK_PROBE_GROUPS);
const selected = ref(new Set(ALL_KEYS));

const isSelected = (group, vendor) => selected.value.has(vendorKey(group.id, vendor.id));
const setVendor = (group, vendor, checked) => {
    const next = new Set(selected.value);
    if (checked) next.add(vendorKey(group.id, vendor.id));
    else next.delete(vendorKey(group.id, vendor.id));
    selected.value = next;
};
const groupState = (group) => {
    const on = group.vendors.filter((v) => isSelected(group, v)).length;
    if (on === group.vendors.length) return true;
    return on > 0 ? 'indeterminate' : false;
};
const toggleGroup = (group, checked) => {
    const next = new Set(selected.value);
    for (const v of group.vendors) {
        if (checked === true) next.add(vendorKey(group.id, v.id));
        else next.delete(vendorKey(group.id, v.id));
    }
    selected.value = next;
};
const selectAll = () => { selected.value = new Set(ALL_KEYS); };
const invert = () => { selected.value = new Set(invertSelection(ALL_KEYS, selected.value)); };

const vendorName = (group, vendor) => (group.kind === 'cosmetic'
    ? t(`adblocktest.cosmetic.${vendor.id}`)
    : vendor.name);

const selectedTargetCount = computed(() => buildPlan(ADBLOCK_PROBE_GROUPS, selected.value).length);

/* ---------- Run state ---------- */

// 'idle' | 'running' | 'finished'
const status = ref('idle');
const isRunning = computed(() => status.value === 'running');
const canRun = computed(() => !isRunning.value && selectedTargetCount.value > 0);
const runPlan = ref([]);
// Set by the first completed run; the run button then reads "run again".
const hasFinished = ref(false);
const statuses = ref({}); // plan item id → probe status
const hasResults = computed(() => runPlan.value.length > 0);

const statusOf = (item) => statuses.value[item.id] ?? 'pending';

const requestItems = computed(() => runPlan.value.filter((p) => p.kind !== 'cosmetic'));
const cosmeticItems = computed(() => runPlan.value.filter((p) => p.kind === 'cosmetic'));
const requestTally = computed(() => tally(requestItems.value.map(statusOf)));
const cosmeticTally = computed(() => tally(cosmeticItems.value.map(statusOf)));
const answeredCount = computed(() => runPlan.value.length
    - requestTally.value.pending - cosmeticTally.value.pending);

const layer = computed(() => (status.value === 'finished'
    ? blockingLayer({ requests: requestTally.value, cosmetic: cosmeticTally.value })
    : null));

/* ---------- Results (right column) ---------- */

const filter = ref('all');
const expanded = ref(new Set());
const isExpanded = (vendor) => filter.value !== 'all' || expanded.value.has(vendor.key);
const toggleExpanded = (vendor) => {
    const next = new Set(expanded.value);
    if (next.has(vendor.key)) next.delete(vendor.key);
    else next.add(vendor.key);
    expanded.value = next;
};

// Groups → vendors → items of the last run, with counts; the "open" /
// "blocked" filters keep only items of that status (and drop what is left empty).
const visibleGroups = computed(() => ADBLOCK_PROBE_GROUPS.map((group) => {
    const vendors = group.vendors.map((vendor) => {
        const all = runPlan.value.filter((p) => p.groupId === group.id && p.vendorId === vendor.id);
        const items = filter.value === 'all' ? all : all.filter((p) => statusOf(p) === filter.value);
        return {
            key: vendorKey(group.id, vendor.id),
            name: vendorName(group, vendor),
            items,
            counts: tally(all.map(statusOf)),
        };
    }).filter((v) => v.items.length > 0);
    const all = runPlan.value.filter((p) => p.groupId === group.id);
    return { id: group.id, vendors, counts: tally(all.map(statusOf)) };
}).filter((g) => g.vendors.length > 0));

/* ---------- Probes ---------- */

const baitHost = ref(null);

// Place every selected bait, then watch until each is hidden or the wait
// runs out. A host no longer in the document (the page was left mid-run)
// proves nothing, so its baits read unknown.
const runCosmetic = async (items) => {
    const host = baitHost.value;
    if (!items.length || !host) return;
    const baits = items.map((item) => {
        const spec = COSMETIC_BAITS[item.target];
        const el = document.createElement(spec.tag);
        el.className = spec.className;
        for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
        el.style.cssText = 'display:block;width:80px;height:20px;';
        el.innerHTML = '&nbsp;';
        host.appendChild(el);
        return { item, el };
    });
    const hidden = (el) => {
        const style = getComputedStyle(el);
        return isBaitHidden({
            connected: el.isConnected,
            offsetHeight: el.offsetHeight,
            display: style.display,
            visibility: style.visibility,
        });
    };
    const started = Date.now();
    let pending = baits;
    while (pending.length && Date.now() - started < COSMETIC_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, COSMETIC_POLL_MS));
        if (!host.isConnected) break;
        pending = pending.filter(({ item, el }) => {
            if (!hidden(el)) return true;
            statuses.value[item.id] = 'blocked';
            return false;
        });
    }
    for (const { item } of pending) statuses.value[item.id] = host.isConnected ? 'open' : 'unknown';
    host.replaceChildren();
};

const startTest = async () => {
    if (!canRun.value) return;
    trackEvent('Section', 'StartClick', 'AdblockTest');
    status.value = 'running';
    filter.value = 'all';
    expanded.value = new Set();
    const plan = buildPlan(ADBLOCK_PROBE_GROUPS, selected.value);
    runPlan.value = plan;
    statuses.value = {};

    const { timeoutMs, concurrency } = probeLimits(navigator.userAgent, navigator.platform);
    const tasks = plan.filter((p) => p.kind !== 'cosmetic').map((item) => async () => {
        statuses.value[item.id] = await probeRequest(item.url, { timeoutMs });
    });
    await Promise.all([
        runCosmetic(plan.filter((p) => p.kind === 'cosmetic')),
        runWithConcurrency(tasks, concurrency),
    ]);
    status.value = 'finished';
    hasFinished.value = true;
    // Domain event: per-address outcome for the report collector.
    emitAppEvent('adblocktest:finished', {
        items: plan.map((p) => ({ groupId: p.groupId, kind: p.kind, status: statusOf(p) })),
    });
};
</script>
