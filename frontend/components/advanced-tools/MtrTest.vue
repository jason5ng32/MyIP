<template>
    <div class="mtr-test-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('mtrtest.Note') }}</p>
            <p v-if="!isMobile">{{ t('mtrtest.Note2') }}</p>
        </div>

        <!-- Input area. With stored IPs (homepage drawer) the user can pick one
             OR switch to manual entry; on the standalone page allIPs is empty,
             so it's manual entry only. -->
        <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <Label :for="manualMode ? 'mtrIPManual' : 'mtrIP'" class="font-medium">
                    {{ manualMode ? t('mtrtest.EnterIPLabel') : t('mtrtest.Note3') }}
                </Label>
                <!-- Only when stored IPs exist: switch between the dropdown and
                     manual entry (on = use a stored IP). -->
                <div v-if="allIPs.length" class="flex items-center gap-2 shrink-0">
                    <Switch id="mtrUseStored" v-model="useStored" :disabled="mtrCheckStatus === 'running'" />
                    <Label for="mtrUseStored" class="font-normal text-muted-foreground cursor-pointer">
                        {{ t('mtrtest.UseStored') }}
                    </Label>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Select v-if="!manualMode" v-model="selectedIP" :disabled="mtrCheckStatus === 'running'">
                    <SelectTrigger id="mtrIP" aria-label="Select IP to MTR" class="flex-1 min-w-0">
                        <SelectValue :placeholder="t('mtrtest.SelectIP')" class="truncate font-mono" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="item in allIPs" :key="item.ip" :value="item.ip">
                            <span class="flex items-center gap-1 min-w-0">
                                <Icon v-if="item.country" :icon="'circle-flags:' + item.country.toLowerCase()"
                                    class="size-3.5 md:size-4 shrink-0" />
                                <span class="font-mono truncate text-xs md:text-sm">{{ item.ip }}</span>
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
                <Input v-else id="mtrIPManual" v-model="manualIP" class="flex-1 font-mono"
                    :placeholder="t('mtrtest.EnterIPPlaceholder')" :disabled="mtrCheckStatus === 'running'"
                    :aria-invalid="manualIP.trim() !== '' && !isValidManualIP" autocomplete="off" autocorrect="off"
                    autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
                    @keyup.enter="startmtrCheck" />
                <Button variant="action"
                    :disabled="!canRun"
                    :title="overLimit ? t('globalping.GroupFull', { max: GLOBALPING_MAX_COUNTRIES }) : ''"
                    @click="startmtrCheck" class="cursor-pointer">
                    <Spinner v-if="mtrCheckStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
        </div>

        <!-- Error message -->
        <div v-if="mtrCheckStatus === 'error'"
            class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
            <Info class="size-4 mt-0.5 shrink-0" />
            <span class="leading-relaxed">{{ t('mtrtest.Error') }}</span>
        </div>

        <!-- Country picker (left) + results (right) -->
        <Card>
            <CardContent class="p-0">
                <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                    <!-- Left: suggested spread + full continent catalog. -->
                    <div class="col-span-1" :class="mtrResults.length > 0
                            ? 'max-h-72 overflow-y-auto md:max-h-none md:overflow-visible md:relative md:min-h-96'
                            : 'max-h-72 md:max-h-128 overflow-y-auto'">
                        <div class="px-4 py-3"
                            :class="mtrResults.length > 0 ? 'md:absolute md:inset-0 md:overflow-y-auto' : ''">
                            <GlobalpingCountryPicker v-model="selectedCountries" :sections="pickerSections"
                                :max="GLOBALPING_MAX_COUNTRIES" :disabled="mtrCheckStatus === 'running'" />
                        </div>
                    </div>

                    <!-- Right: per-probe accordion; hint / spinner before that -->
                    <div class="col-span-3" :class="mtrResults.length > 0 ? '' : 'flex items-center justify-center'">
                        <Accordion v-if="mtrResults.length > 0" type="single" collapsible default-value="0"
                            class="space-y-2 p-3">
                            <AccordionItem v-for="(result, index) in mtrResults" :key="result.country"
                                :value="String(index)"
                                class="rounded-lg border bg-card px-4 data-[state=open]:border-primary/30">
                                <AccordionTrigger class="hover:no-underline cursor-pointer my-1">
                                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                                        <Icon :icon="'circle-flags:' + result.country.toLowerCase()"
                                            class="shrink-0 size-5" />
                                        <span class="text-sm font-semibold">
                                            {{ result.country_name }}, {{ result.city }}
                                        </span>
                                        <template v-if="!isMobile">
                                            <span class="text-muted-foreground">·</span>
                                            <span class="text-sm text-muted-foreground truncate">{{ result.network
                                                }}</span>
                                            <Badge variant="success"
                                                class="font-mono font-normal shadow-none rounded-full">AS{{
                                                result.asn }}</Badge>
                                        </template>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <!-- Structured hop table parsed from the mtr raw output;
                         falls back to the raw text when nothing was parseable. -->
                                    <div v-if="result.hops.length" class="mt-2 rounded-md  overflow-x-auto">
                                        <table class="w-full text-xs">
                                            <thead>
                                                <tr class="border-b">
                                                    <th scope="col"
                                                        class="px-3 py-2.5 text-xs font-medium text-muted-foreground text-left w-8">
                                                        #
                                                    </th>
                                                    <th v-if="result.hasHost" scope="col"
                                                        class="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">
                                                        {{ t('mtrtest.ColHost') }}
                                                    </th>
                                                    <th v-if="result.hasIp" scope="col"
                                                        class="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">
                                                        {{ t('mtrtest.ColIP') }}
                                                    </th>
                                                    <th v-if="result.hasAsn" scope="col"
                                                        class="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">
                                                        {{ t('mtrtest.ColASN') }}
                                                    </th>
                                                    <th v-for="col in result.columns" :key="col.key" scope="col"
                                                        class="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide text-right text-nowrap">
                                                        {{ t('mtrtest.' + col.labelKey) }}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y">
                                                <tr v-for="hop in result.hops" :key="hop.n"
                                                    class="hover:bg-muted/50 transition-colors">
                                                    <td class="px-3 py-2 font-mono tabular-nums text-muted-foreground">
                                                        {{ hop.n
                                                        }}</td>
                                                    <td v-if="result.hasHost" class="px-3 py-2 font-mono max-w-56">
                                                        <span v-if="hop.host" class="block truncate"
                                                            :title="hop.host">{{
                                                            hop.host
                                                            }}</span>
                                                        <span v-else-if="!hop.ip"
                                                            class="text-muted-foreground italic font-sans">{{
                                                            t('mtrtest.NoReply') }}</span>
                                                        <span v-else class="text-muted-foreground">—</span>
                                                    </td>
                                                    <td v-if="result.hasIp"
                                                        class="px-3 py-2 font-mono whitespace-nowrap">
                                                        <template v-if="hop.ip">{{ hop.ip }}</template>
                                                        <span v-else-if="!result.hasHost && !hop.host"
                                                            class="text-muted-foreground italic font-sans">{{
                                                            t('mtrtest.NoReply')
                                                            }}</span>
                                                        <span v-else class="text-muted-foreground">—</span>
                                                    </td>
                                                    <td v-if="result.hasAsn"
                                                        class="px-3 py-2 font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                                                        {{ hop.asn ? 'AS' + hop.asn : '—' }}
                                                    </td>
                                                    <td v-for="col in result.columns" :key="col.key"
                                                        class="px-3 py-2 text-right font-mono tabular-nums"
                                                        :class="hopCellClass(col, hop)">
                                                        {{ formatHopCell(col, hop) }}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <pre v-else
                                        class="mt-2 p-4 rounded-md bg-muted font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word">
                                {{ result.rawOutput }}</pre>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        <div v-else-if="mtrCheckStatus === 'running'" class="px-4 py-6">
                            <Spinner class="size-5 text-info" />
                        </div>
                        <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">
                            {{ t('globalping.ResultsHint') }}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events';
import { useGlobalpingMeasurement, GLOBALPING_SUGGESTED_COUNTRIES, GLOBALPING_MAX_COUNTRIES, selectableIPs } from '@/composables/use-globalping-measurement';
import GlobalpingCountryPicker from './GlobalpingCountryPicker.vue';
import { isValidIP } from '@/utils/valid-ip.js';
import { parseMtrOutput } from '@/utils/mtr-parse.js';
import getCountryName from '@/data/country-name.js';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Info, Play } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const allIPs = computed(() => selectableIPs(store.allIPs));

const selectedIP = ref('');
const mtrResults = ref([]);

// Country picker: the curated spread as a suggested section (selected by
// default, parity with the old fixed list); the picker itself appends the
// full per-continent catalog of probe-having countries. Soft cap of
// GLOBALPING_MAX_COUNTRIES gates the run button, not the checkboxes.
const selectedCountries = ref([...GLOBALPING_SUGGESTED_COUNTRIES]);
const overLimit = computed(() => selectedCountries.value.length > GLOBALPING_MAX_COUNTRIES);
const pickerSections = computed(() => [
    { key: 'suggested', label: t('globalping.Suggested'), countries: GLOBALPING_SUGGESTED_COUNTRIES },
]);

// Manual entry is forced when there are no stored IPs (the standalone page,
// where the homepage never ran). When stored IPs exist, the "use stored IP"
// switch (on by default) toggles between the dropdown and manual entry.
const useStored = ref(true);
const manualMode = computed(() => allIPs.value.length === 0 || !useStored.value);
const manualIP = ref('');
const isValidManualIP = computed(() => isValidIP(manualIP.value.trim()));
// The effective target: a picked IP, or a valid typed one ('' blocks Run).
const targetIP = computed(() =>
    manualMode.value ? (isValidManualIP.value ? manualIP.value.trim() : '') : selectedIP.value,
);
// status: 'idle' | 'running' | 'finished' | 'error' — driven by the composable
const { status: mtrCheckStatus, start: runMeasurement } = useGlobalpingMeasurement({
    pollInterval: 1000,
    maxRetries: 4,
});

// Single source of truth for "may this measurement start", shared by the run
// button and the Enter-key path so the two can't drift apart.
const canRun = computed(() => mtrCheckStatus.value !== 'running'
    && !!targetIP.value
    && selectedCountries.value.length > 0
    && !overLimit.value);

const startmtrCheck = () => {
    // Enter on the target input reaches this handler directly, so a disabled
    // run button alone wouldn't stop an over-limit submission.
    if (!canRun.value) return;
    trackEvent('Section', 'StartClick', 'MTRTest');
    mtrResults.value = [];

    runMeasurement({
        limit: selectedCountries.value.length,
        locations: selectedCountries.value.map((cc) => ({ country: cc })),
        target: targetIP.value,
        type: 'mtr',
        measurementOptions: { port: 80, protocol: 'ICMP' },
    }, {
        onResults: (data) => {
            processmtrResults(data);
            return mtrResults.value.length > 0;
        },
        onFinish: () => {
            // Domain event: final probes with parsed hops for the report
            // collector (rawOutput stays local — only the structured hops
            // belong in a shareable report).
            emitAppEvent('mtrtest:finished', {
                target: targetIP.value,
                probes: mtrResults.value.map((result) => ({
                    country: result.country,
                    city: result.city,
                    network: result.network,
                    asn: result.asn,
                    hops: result.hops,
                })),
            });
        },
    });
};

// Column catalog for the hop table. mtr builds differ in their numeric
// columns, so each probe's table only shows the columns its parsed hops
// actually carry. `kind` drives formatting and tone.
const HOP_COLUMNS = [
    { key: 'lossPct', labelKey: 'ColLoss', kind: 'loss' },
    { key: 'sntCount', labelKey: 'ColSent', kind: 'count' },
    { key: 'drop', labelKey: 'ColDrop', kind: 'count' },
    { key: 'rcv', labelKey: 'ColRecv', kind: 'count' },
    { key: 'lastMs', labelKey: 'ColLast', kind: 'ms' },
    { key: 'avgMs', labelKey: 'ColAvg', kind: 'ms' },
    { key: 'bestMs', labelKey: 'ColBest', kind: 'ms' },
    { key: 'worstMs', labelKey: 'ColWorst', kind: 'ms' },
    { key: 'stdevMs', labelKey: 'ColStDev', kind: 'ms' },
    { key: 'javgMs', labelKey: 'ColJitter', kind: 'ms' },
];

const hopColumnsFor = (hops) =>
    HOP_COLUMNS.filter((col) => hops.some((hop) => hop[col.key] !== undefined));

const formatHopCell = (col, hop) => {
    const value = hop[col.key];
    if (value === undefined) return '—';
    if (col.kind === 'loss') return `${value.toFixed(1)}%`;
    if (col.kind === 'ms') return value.toFixed(1);
    return String(value);
};

// Loss draws attention, counts stay quiet, latencies keep the default
// foreground (per-hop latency grows along the path — absolute thresholds
// like the ping table's would mislead here).
const hopCellClass = (col, hop) => {
    if (col.kind === 'loss') return hop[col.key] > 0 ? 'text-warning' : 'text-muted-foreground';
    if (col.kind === 'count') return 'text-muted-foreground';
    return '';
};

const processmtrResults = (data) => {
    const cleanedData = data.results
        .filter(item => item.result.status === 'finished')
        .filter(item => item.result.rawOutput !== null)
        .map(item => {
            const hops = parseMtrOutput(item.result.rawOutput);
            return {
                country: item.probe.country,
                country_name: getCountryName(item.probe.country, lang.value),
                city: item.probe.city,
                network: item.probe.network,
                asn: item.probe.asn,
                rawOutput: item.result.rawOutput,
                hops,
                columns: hopColumnsFor(hops),
                // Identity columns are adaptive too: a probe whose hops carry
                // no hostname (or no per-hop ASN) drops that column entirely.
                hasHost: hops.some((hop) => hop.host !== undefined),
                hasIp: hops.some((hop) => hop.ip !== undefined),
                hasAsn: hops.some((hop) => hop.asn != null),
            };
        });

    mtrResults.value = cleanedData;
};
</script>
