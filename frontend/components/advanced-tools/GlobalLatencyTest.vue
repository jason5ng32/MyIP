<template>
    <div class="ping-test-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('pingtest.Note') }}</p>
            <p v-if="!isMobile">{{ t('pingtest.Note2') }}</p>
        </div>

        <!-- Input area. With stored IPs (homepage drawer) the user can pick one
             OR switch to manual entry; on the standalone page allIPs is empty,
             so it's manual entry only. -->
        <div class="space-y-2">
            <div class="flex items-center justify-between gap-2">
                <Label :for="manualMode ? 'pingIPManual' : 'pingIP'" class="font-medium">
                    {{ manualMode ? t('pingtest.EnterIPLabel') : t('pingtest.Note3') }}
                </Label>
                <!-- Only when stored IPs exist: switch between the dropdown and
                     manual entry (on = use a stored IP). -->
                <div v-if="allIPs.length" class="flex items-center gap-2 shrink-0">
                    <Switch id="pingUseStored" v-model="useStored" :disabled="pingCheckStatus === 'running'" />
                    <Label for="pingUseStored" class="font-normal text-muted-foreground cursor-pointer">
                        {{ t('pingtest.UseStored') }}
                    </Label>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <Select v-if="!manualMode" v-model="selectedIP" :disabled="pingCheckStatus === 'running'">
                    <SelectTrigger id="pingIP" aria-label="Select IP to Ping" class="flex-1 min-w-0">
                        <SelectValue :placeholder="t('pingtest.SelectIP')" class="truncate font-mono" />
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
                <Input v-else id="pingIPManual" v-model="manualIP" class="flex-1 font-mono"
                    :placeholder="t('pingtest.EnterIPPlaceholder')" :disabled="pingCheckStatus === 'running'"
                    :aria-invalid="manualIP.trim() !== '' && !isValidManualIP" autocomplete="off" autocorrect="off"
                    autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
                    @keyup.enter="startPingCheck" />
                <Button variant="action" :disabled="pingCheckStatus === 'running' || !targetIP" @click="startPingCheck"
                    class="cursor-pointer">
                    <Spinner v-if="pingCheckStatus === 'running'" />
                    <template v-else>
                        <Play class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
        </div>

        <!-- Error Message -->
        <div v-if="pingCheckStatus === 'error'"
            class="flex items-start gap-2 p-3 rounded-md border border-info/30 bg-info/10 text-sm text-info">
            <Info class="size-4 mt-0.5 shrink-0" />
            <span class="leading-relaxed">{{ t('pingtest.Error') }}</span>
        </div>

        <!-- Result table -->
        <Card v-if="pingResults.length > 0">
            <CardContent class="p-0">
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-b">
                                <th scope="col" v-for="header in headers" :key="header.key"
                                    class="px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide min-w-20 text-nowrap"
                                    :class="header.align === 'right' ? 'text-right' : 'text-left'">
                                    {{ t('pingtest.' + header.key) }}
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            <tr v-for="result in pingResults" :key="result.country"
                                class="hover:bg-muted/50 transition-colors">
                                <td class="px-3 py-2.5 whitespace-nowrap">
                                    <div class="flex items-center gap-1.5">
                                        <Icon :icon="'circle-flags:' + result.country.toLowerCase()"
                                            class="shrink-0 size-4" />
                                        <span>{{ result.country_name }}</span>
                                    </div>
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums"
                                    :class="latencyToneClass(result.stats.min)">
                                    {{ result.stats.min.toFixed(1) }}
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums"
                                    :class="latencyToneClass(result.stats.max)">
                                    {{ result.stats.max.toFixed(1) }}
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums"
                                    :class="latencyToneClass(result.stats.avg)">
                                    {{ result.stats.avg.toFixed(1) }}
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                                    {{ result.stats.total }}
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums"
                                    :class="result.stats.loss > 0 ? 'text-warning' : 'text-muted-foreground'">
                                    {{ Math.round(result.stats.loss) }}%
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                                    {{ result.stats.rcv }}
                                </td>
                                <td class="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                                    {{ result.stats.drop }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <!-- Map container (svgmap library renders here) -->
                <div id="svgMap" class="m-3"></div>
            </CardContent>
        </Card>


    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { useGlobalpingMeasurement, GLOBALPING_DEFAULT_LOCATIONS, selectableIPs } from '@/composables/use-globalping-measurement';
import { isValidIP } from '@/utils/valid-ip.js';
import getCountryName from '@/data/country-name.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Info, Play } from '@lucide/vue';

import 'svgmap/style.min';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const allIPs = computed(() => selectableIPs(store.allIPs));

const selectedIP = ref('');
const pingResults = ref([]);

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
const { status: pingCheckStatus, start: runMeasurement } = useGlobalpingMeasurement({
    pollInterval: 1000,
    maxRetries: 4,
});

// Header configuration: Region left aligned, all numbers right aligned (tabular-nums aligns decimal points more neatly)
const headers = [
    { key: 'Region', align: 'left' },
    { key: 'MinDelay', align: 'right' },
    { key: 'MaxDelay', align: 'right' },
    { key: 'AvgDelay', align: 'right' },
    { key: 'TotalPackets', align: 'right' },
    { key: 'PacketLoss', align: 'right' },
    { key: 'ReceivedPackets', align: 'right' },
    { key: 'DroppedPackets', align: 'right' },
];

// Delay coloring: <100ms green (ok-fast), 100-250ms neutral, >250ms yellow warning
const latencyToneClass = (ms) => {
    if (ms < 100) return 'text-success';
    if (ms < 250) return '';
    return 'text-warning';
};

const startPingCheck = () => {
    if (!targetIP.value) return;
    trackEvent('Section', 'StartClick', 'GlobalLatency');
    pingResults.value = [];
    cleanMap();

    runMeasurement({
        limit: 16,
        locations: GLOBALPING_DEFAULT_LOCATIONS,
        target: targetIP.value,
        type: 'ping',
        measurementOptions: { packets: 8 },
    }, {
        onResults: (data) => {
            processpingResults(data);
            return pingResults.value.length > 0;
        },
        onFinish: () => drawMap(),
    });
};

const processpingResults = (data) => {
    pingResults.value = data.results
        .filter(item => item.result.status === 'finished')
        .filter(item => item.result.stats.min !== null)
        .map(item => ({
            country: item.probe.country,
            country_name: getCountryName(item.probe.country, lang.value),
            stats: item.result.stats,
        }));
};

const drawMap = async () => {
    const svgMapModule = await import('svgmap');

    const mapData = {
        data: {
            avgPing: { name: t('pingtest.AvgDelay'), format: '{0} ms', thresholdMax: 250, thresholdMin: 0 },
            minPing: { name: t('pingtest.MinDelay'), format: '{0} ms' },
            maxPing: { name: t('pingtest.MaxDelay'), format: '{0} ms' },
            total: { name: t('pingtest.TotalPackets'), format: '{0}' },
            loss: { name: t('pingtest.PacketLoss'), format: '{0}%' },
            rcv: { name: t('pingtest.ReceivedPackets'), format: '{0}' },
            drop: { name: t('pingtest.DroppedPackets'), format: '{0}' },
        },
        applyData: 'avgPing',
        values: {},
    };

    pingResults.value.forEach(countryData => {
        mapData.values[countryData.country] = {
            avgPing: countryData.stats.avg,
            minPing: countryData.stats.min,
            maxPing: countryData.stats.max,
            total: countryData.stats.total,
            loss: countryData.stats.loss,
            rcv: countryData.stats.rcv,
            drop: countryData.stats.drop,
        };
    });

    new svgMapModule.default({
        targetElementID: 'svgMap',
        data: mapData,
        colorMax: '#083923',
        colorMin: '#22CB80',
        minZoom: 1,
        maxZoom: 1,
        mouseWheelZoomEnabled: false,
        initialZoom: 1,
    });
};

const cleanMap = () => {
    const el = document.getElementById('svgMap');
    if (el) el.innerHTML = '';
};
</script>
