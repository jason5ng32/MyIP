<template>
    <div class="ping-test-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('pingtest.Note') }}</p>
            <p v-if="!isMobile">{{ t('pingtest.Note2') }}</p>
        </div>

        <!-- Input area: IP selection + Run -->
        <div class="space-y-2">
            <label for="pingIP" class="text-sm font-medium block">{{ t('pingtest.Note3') }}</label>
            <div class="flex items-center gap-2">
                <Select v-model="selectedIP" :disabled="pingCheckStatus === 'running'">
                    <SelectTrigger id="pingIP" aria-label="Select IP to Ping" class="flex-1">
                        <SelectValue :placeholder="t('pingtest.SelectIP')" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="ip in allIPs" :key="ip" :value="ip">{{ ip }}</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="action" :disabled="pingCheckStatus === 'running' || selectedIP === ''"
                    @click="startPingCheck" class="cursor-pointer">
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
import { trackEvent } from '@/utils/use-analytics';
import { useGlobalpingMeasurement } from '@/composables/use-globalping-measurement';
import getCountryName from '@/data/country-name.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Info,Play } from 'lucide-vue-next';

// svgmap CSS：静态 side-effect import。原本在 drawMap() 里 await import('svgmap/style.min')
// 动态引入 —— dev 下能跑，build 下 Rollup 把 CSS chunk 当 JS 模块去解 export 导致
// 'svg_map_min_exports is not defined' 运行时错误。
// 这个组件本身走 router 懒加载，CSS 会跟着组件 chunk 一起按需加载，不影响首屏。
import 'svgmap/style.min';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const allIPs = computed(() => {
    const _allIPs = store.allIPs;
    return _allIPs.filter(ip => ip && !ip.includes(' '));
});

const selectedIP = ref('');
const pingResults = ref([]);
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
    trackEvent('Section', 'StartClick', 'GlobalLatency');
    pingResults.value = [];
    cleanMap();

    runMeasurement({
        limit: 16,
        locations: [
            { country: 'HK' }, { country: 'TW' }, { country: 'CN' }, { country: 'JP' },
            { country: 'SG' }, { country: 'IN' }, { country: 'RU' }, { country: 'US' },
            { country: 'CA' }, { country: 'AU' }, { country: 'GB' }, { country: 'DE' },
            { country: 'FR' }, { country: 'BR' }, { country: 'ZA' }, { country: 'SA' },
        ],
        target: selectedIP.value,
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
