<template>
    <div class="censorship-check-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('censorshipcheck.Note') }}</p>

        <!-- Input area -->
        <div class="space-y-2">
            <Label for="queryURL">{{ t('censorshipcheck.Note2') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="queryURL" name="queryURL" data-1p-ignore data-lpignore="true" class="font-mono"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" :disabled="isBusy"
                    :placeholder="t('censorshipcheck.Placeholder')" v-model="queryURL" @keyup.enter="onSubmit"
                    :aria-invalid="errorMsg !== ''" />
                <Button variant="action" class="cursor-pointer" :disabled="isBusy || !queryURL" @click="onSubmit">
                    <Spinner v-if="ooniStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>
        </div>

        <!-- Module 1: OONI history -->
        <template v-if="ooniStatus === 'finished' && ooniData">
            <div v-if="hasData" class="space-y-3">
                <!-- Summary banner -->
                <div class="flex items-start gap-2 p-3 rounded-md border text-sm" :class="historyBannerClass">
                    <ShieldAlert v-if="flagged.length > 0" class="size-4 mt-0.5 shrink-0" />
                    <Meh v-else-if="isSparse" class="size-4 mt-0.5 shrink-0" />
                    <ShieldCheck v-else class="size-4 mt-0.5 shrink-0" />
                    <span class="leading-relaxed">{{ summaryText }}</span>
                </div>

                <!-- Flagged countries: fixed two-line rows so mobile stays tidy -->
                <Card v-if="flagged.length > 0">
                    <CardContent class="p-0">
                        <header class="flex items-center justify-between gap-2 px-4 py-3 border-b">
                            <h3 class="text-sm font-semibold m-0">{{ t('censorshipcheck.HistoryTitle') }}</h3>
                            <span class="text-xs text-muted-foreground font-mono">{{ ooniData.since }} → {{
                                ooniData.until }}</span>
                        </header>
                        <ul class="divide-y">
                            <li v-for="c in flagged" :key="c.country" class="px-4 py-2.5 space-y-1.5">
                                <!-- Line 1: country + tier, share/sample pinned right -->
                                <div class="flex items-center gap-2 text-sm">
                                    <Icon :icon="'circle-flags:' + c.country.toLowerCase()" class="shrink-0 size-4" />
                                    <span class="font-medium truncate">{{ countryName(c.country) }}</span>
                                    <Badge variant="outline" :class="'shrink-0 ' + TIER_META[c.tier].badgeClass">
                                        {{ t('censorshipcheck.' + TIER_META[c.tier].labelKey) }}
                                    </Badge>
                                    <span class="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                                        {{ t('censorshipcheck.AnomalyShare', { pct: blockedPct(c) }) }}
                                        · {{ t('censorshipcheck.Measurements', { n: c.measurements }) }}
                                    </span>
                                </div>
                                <!-- Line 2: blocking methods -->
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <Badge v-for="m in methodList(c)" :key="m" variant="secondary" class="font-normal">
                                        {{ t('censorshipcheck.' + METHOD_KEYS[m]) }}
                                    </Badge>
                                </div>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>

            <!-- No OONI data: presets below take over -->
            <div v-else
                class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-info text-sm">
                <Meh class="size-4 mt-0.5 shrink-0" />
                <span class="leading-relaxed">{{ t('censorshipcheck.NoData') }}</span>
            </div>
        </template>

        <!-- OONI upstream failure: degrade gracefully — say so, keep the
             realtime module below fully usable -->
        <div v-if="ooniStatus === 'error'"
            class="flex items-start gap-2 p-3 rounded-md border border-warning/30 bg-warning/10 text-warning text-sm">
            <TriangleAlert class="size-4 mt-0.5 shrink-0" />
            <span class="leading-relaxed">{{ t('censorshipcheck.OoniError') }}</span>
        </div>

        <!-- Module 2: Globalping realtime test — pick freely from three
             sections; the cap only gates the run button, not the checkboxes.
             Stays available when OONI itself is down. -->
        <template v-if="ooniStatus === 'finished' || ooniStatus === 'error'">
            <p class="text-sm text-muted-foreground leading-relaxed">{{ t('censorshipcheck.RealtimeNote') }}</p>
            <Card>
                <CardContent class="p-0">
                    <header class="flex items-center gap-2 px-4 py-3 border-b">
                        <Activity class="size-4 text-action shrink-0" />
                        <h3 class="text-sm font-semibold m-0">{{ t('censorshipcheck.RealtimeTitle') }}</h3>
                        <Button variant="action" size="sm" class="ml-auto cursor-pointer"
                            :disabled="selectedCountries.length === 0 || overLimit || running"
                            :title="overLimit ? t('globalping.GroupFull', { max: MAX_TEST_COUNTRIES }) : ''"
                            @click="runTest">
                            <Spinner v-if="censorshipCheckStatus === 'running'" />
                            <Play v-else class="size-4 shrink-0" />
                            {{ t('censorshipcheck.RunVerify') }}
                        </Button>
                    </header>

                    <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x">
                        <!-- Left: suggestion sections (flagged / high-risk / open) +
                             the picker's own continent catalog. -->
                        <div class="col-span-1" :class="runStarted
                                ? 'max-h-72 overflow-y-auto md:max-h-none md:overflow-visible md:relative md:min-h-96'
                                : 'max-h-72 md:max-h-128 overflow-y-auto'">
                            <div class="px-4 py-3"
                                :class="runStarted ? 'md:absolute md:inset-0 md:overflow-y-auto' : ''">
                                <GlobalpingCountryPicker v-model="selectedCountries" :sections="pickerSections"
                                    :max="MAX_TEST_COUNTRIES" :disabled="running" />
                            </div>
                        </div>

                        <!-- Right: raw results only, no verdict. The pre-run hint
                             centers on both axes of the column -->
                        <div class="col-span-3 shadow-inner md:shadow-none"
                            :class="runStarted ? '' : 'flex items-center justify-center'">
                            <div v-if="runStarted" class="overflow-x-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr class="border-b">
                                            <th v-for="key in ['Country', 'Status', 'City', 'Network']" :key="key"
                                                scope="col"
                                                class="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide text-nowrap">
                                                {{ t('censorshipcheck.' + key) }}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y">
                                        <tr v-for="(result, idx) in testRows"
                                            :key="result.country + '-' + result.city + '-' + idx"
                                            class="hover:bg-muted/50 transition-colors">
                                            <td class="px-3 py-2 whitespace-nowrap">
                                                <div class="flex items-center gap-1.5">
                                                    <Icon :icon="'circle-flags:' + result.country.toLowerCase()"
                                                        class="shrink-0 size-4" />
                                                    <span>{{ result.country_name }}</span>
                                                </div>
                                            </td>
                                            <!-- finished → check; failed → cross; in-progress →
                                                 spinner; pre-run placeholder → muted dash -->
                                            <td class="px-3 py-2">
                                                <CircleCheck v-if="result.status === 'finished'"
                                                    class="size-4 text-success" />
                                                <CircleX v-else-if="result.status === 'failed'"
                                                    class="size-4 text-destructive" />
                                                <Spinner v-else-if="result.status === 'in-progress'"
                                                    class="size-4 text-info" />
                                                <span v-else class="text-muted-foreground">—</span>
                                            </td>
                                            <td class="px-3 py-2 text-muted-foreground">{{ result.city }}</td>
                                            <td class="px-3 py-2 text-muted-foreground truncate max-w-100"
                                                :title="result.network">{{ result.network }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p v-else class="px-4 py-6 text-sm text-muted-foreground text-center">
                                {{ t('censorshipcheck.ResultsHint') }}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- Datacenter caveat — context, not a verdict -->
            <p v-if="censorshipCheckStatus === 'finished' && hasData"
                class="text-xs text-muted-foreground leading-relaxed">
                {{ t('censorshipcheck.RealtimeFooterNote') }}
            </p>
        </template>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { emitAppEvent } from '@/utils/app-events.js';
import { useGlobalpingMeasurement } from '@/composables/use-globalping-measurement';
import GlobalpingCountryPicker from './GlobalpingCountryPicker.vue';
import { isValidDomain } from '@/utils/valid-ip.js';
import getCountryName from '@/data/country-name.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import {
    Activity, CircleCheck, CircleX, Meh, ShieldAlert, ShieldCheck, Play, TriangleAlert,
} from '@lucide/vue';
import { Label } from '@/components/ui/label';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);

// The two fixed picker sections next to the OONI-flagged one. All three
// share one selection and one cap: MAX_TEST_COUNTRIES.
const HIGH_RISK_COUNTRIES = ['CN', 'RU', 'TR', 'SA', 'IR'];
const OPEN_COUNTRIES = ['US', 'DE', 'JP', 'SG'];
const MAX_TEST_COUNTRIES = 15;
const PROBES_PER_COUNTRY = 2;

// OONI tier / blocking-method display maps (tiers computed by the backend,
// see common/ooni-blocking.js).
const TIER_META = {
    confirmed: { labelKey: 'TierConfirmed', badgeClass: 'bg-destructive/15 text-destructive border-transparent' },
    likely: { labelKey: 'TierLikely', badgeClass: 'bg-warning/15 text-warning border-transparent' },
    signs: { labelKey: 'TierSigns', badgeClass: 'bg-info/15 text-info border-transparent' },
};
const METHOD_KEYS = {
    dns: 'MethodDns',
    tcp_ip: 'MethodTcpIp',
    'http-failure': 'MethodHttpFailure',
    'http-diff': 'MethodHttpDiff',
};

const queryURL = ref('');
const errorMsg = ref('');
const currentHostname = ref('');

// —— OONI history state ——
const ooniStatus = ref('idle');  // 'idle' | 'running' | 'finished' | 'error'
const ooniData = ref(null);

// —— realtime test state ——
const selectedCountries = ref([]);   // checked countries across all sections
// Country order of the active/last run, frozen at run start for sorting.
const activeTestCountries = ref([]);
const censorshipResults = ref([]);
const { status: censorshipCheckStatus, start: runMeasurement } = useGlobalpingMeasurement({
    pollInterval: 3000,
    maxRetries: 5,
});

const isBusy = computed(() => ooniStatus.value === 'running' || censorshipCheckStatus.value === 'running');

const hasData = computed(() => (ooniData.value?.countries?.length || 0) > 0);
const flagged = computed(() => (ooniData.value?.countries || []).filter((c) => c.tier !== 'ok'));

// "Sparse" = OONI observed the domain in only a handful of countries. A clean
// result over sparse data proves nothing, so the summary must not read (or
// color) like an all-clear.
const SPARSE_COUNTRY_THRESHOLD = 5;
const isSparse = computed(() => hasData.value && ooniData.value.countries.length < SPARSE_COUNTRY_THRESHOLD);
const totalMeasurements = computed(() =>
    (ooniData.value?.countries || []).reduce((sum, c) => sum + c.measurements, 0)
);
const summaryText = computed(() => {
    const total = ooniData.value?.countries?.length || 0;
    if (isSparse.value) {
        return flagged.value.length > 0
            ? t('censorshipcheck.SummarySparseFlagged', { total, n: flagged.value.length })
            : t('censorshipcheck.SummarySparseClean', { total, m: totalMeasurements.value });
    }
    return flagged.value.length > 0
        ? t('censorshipcheck.SummaryFlagged', { n: flagged.value.length })
        : t('censorshipcheck.SummaryClean', { n: total });
});

const countryName = (cc) => getCountryName(cc, lang.value);
const blockedPct = (c) => Math.round(((c.anomaly + c.confirmed) / c.measurements) * 100);
const methodList = (c) => Object.entries(c.methods || {})
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

// History banner: worst flagged tier decides the tone; a clean-but-sparse
// result stays neutral instead of green. (The matching icon branches live
// in the template.)
const historyBannerClass = computed(() => {
    if (flagged.value.some((c) => c.tier === 'confirmed' || c.tier === 'likely')) {
        return 'border-destructive/30 bg-destructive/10 text-destructive';
    }
    if (flagged.value.length > 0) return 'border-warning/30 bg-warning/10 text-warning';
    if (isSparse.value) return 'border-info/30 bg-info/10 text-info';
    return 'border-success/30 bg-success/10 text-success';
});

// —— country picker: suggestion sections for the shared picker component ——
// (which appends the full continent catalog itself). Selection is never
// hard-capped; past MAX_TEST_COUNTRIES the picker's tally turns red and the
// run button locks until the user deselects.
const overLimit = computed(() => selectedCountries.value.length > MAX_TEST_COUNTRIES);
const running = computed(() => censorshipCheckStatus.value === 'running');
const runStarted = computed(() => running.value || censorshipCheckStatus.value === 'finished');

const pickerSections = computed(() => {
    const list = [];
    const flaggedCcs = flagged.value.map((c) => c.country);
    if (flaggedCcs.length > 0) {
        list.push({ key: 'flagged', label: t('censorshipcheck.SectionFlagged'), countries: flaggedCcs });
    }
    list.push({ key: 'highrisk', label: t('censorshipcheck.PresetHighRisk'), countries: HIGH_RISK_COUNTRIES });
    list.push({ key: 'open', label: t('censorshipcheck.PresetOpen'), countries: OPEN_COUNTRIES });
    return list;
});

// Result rows for the right column. While running, every country is padded
// to PROBES_PER_COUNTRY spinner rows up front so arriving results replace
// placeholders in place instead of reflowing the table; after the run,
// countries that never got a probe collapse to a single dash row.
const placeholderRow = (cc, status) => ({
    country: cc,
    country_name: countryName(cc),
    city: '',
    network: '',
    status,
});
const testRows = computed(() => activeTestCountries.value.flatMap((cc) => {
    const rows = censorshipResults.value.filter((r) => r.country === cc);
    if (running.value) {
        const missing = PROBES_PER_COUNTRY - rows.length;
        if (missing <= 0) return rows;
        return [...rows, ...Array.from({ length: missing }, () => placeholderRow(cc, 'in-progress'))];
    }
    if (rows.length > 0) return rows;
    return [placeholderRow(cc, 'waiting')];
}));

const validateInput = (input) => {
    if (!input.match(/^https?:\/\//)) input = 'http://' + input;
    try {
        const url = new URL(input);
        if (isValidDomain(url.hostname)) return url.hostname;
    } catch { /* noop */ }
    errorMsg.value = t('censorshipcheck.invalidURL');
    return null;
};

const resetAll = () => {
    errorMsg.value = '';
    ooniData.value = null;
    ooniStatus.value = 'idle';
    selectedCountries.value = [];
    activeTestCountries.value = [];
    censorshipResults.value = [];
    censorshipCheckStatus.value = 'idle';
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'CensorshipCheck');
    resetAll();
    const hostname = validateInput(queryURL.value);
    if (!hostname) return;
    currentHostname.value = hostname;
    queryOoni(hostname);
};

// —— OONI history query (default view) ——
const queryOoni = async (hostname) => {
    ooniStatus.value = 'running';
    try {
        const response = await fetch(`/api/ooni-blocking?domain=${encodeURIComponent(hostname)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        ooniData.value = await response.json();
        ooniStatus.value = 'finished';
        // Achievement rule (ItIsOpen) lives in data/achievement-rules.js —
        // payload { blocked }. The realtime module draws no verdict, so this
        // is the only emitter now.
        emitAppEvent('censorship:tested', {
            blocked: flagged.value.some((c) => c.tier === 'confirmed' || c.tier === 'likely'),
        });
    } catch (error) {
        // Degrade, don't dead-end: the warning banner explains, and the
        // realtime module below stays fully usable via the preset sections.
        console.error('Error fetching OONI blocking data:', error);
        ooniStatus.value = 'error';
    }
};

// —— realtime run over the composed list — raw results, no verdict ——
const runTest = () => {
    trackEvent('Section', 'StartClick', 'CensorshipVerify');
    const group = [...selectedCountries.value];
    activeTestCountries.value = group;
    censorshipResults.value = [];
    runMeasurement({
        locations: group.map((cc) => ({ country: cc, limit: PROBES_PER_COUNTRY })),
        target: currentHostname.value,
        type: 'http',
        measurementOptions: {
            request: { host: currentHostname.value, path: '/', method: 'HEAD' },
            port: 443,
            protocol: 'HTTPS',
        },
    }, {
        onResults: (data) => {
            processHttpResults(data);
            return censorshipResults.value.length > 0;
        },
        onFinish: correctResult,
        // POST error surfaces as 'invalidURL' (preserves pre-refactor copy);
        // poll failure / empty result surface as 'fetchError'.
        onError: (reason) => {
            errorMsg.value = reason === 'create'
                ? t('censorshipcheck.invalidURL')
                : t('censorshipcheck.fetchError');
        },
    });
};

const processHttpResults = (data) => {
    censorshipResults.value = data.results
        .filter(item => ['finished', 'failed', 'in-progress'].includes(item.result.status))
        .filter(item => item.result.rawOutput !== null)
        .map(item => ({
            country: item.probe.country,
            country_name: getCountryName(item.probe.country, lang.value),
            city: item.probe.city,
            network: item.probe.network,
            status: item.result.status,
        }));
};

const correctResult = () => {
    censorshipResults.value.forEach(result => {
        if (result.status === 'in-progress') result.status = 'failed';
    });

    const priority = activeTestCountries.value;
    censorshipResults.value = [...censorshipResults.value.sort((a, b) => {
        const priorityIndexA = priority.indexOf(a.country);
        const priorityIndexB = priority.indexOf(b.country);
        if (priorityIndexA !== -1 && priorityIndexB !== -1) return priorityIndexA - priorityIndexB;
        if (priorityIndexA !== -1) return -1;
        if (priorityIndexB !== -1) return 1;
        return a.country.localeCompare(b.country);
    })];
};
</script>
