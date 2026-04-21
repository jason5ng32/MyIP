<template>
    <div class="mtr-test-section my-4 space-y-4">
        <!-- Top note -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('mtrtest.Note') }}</p>
            <p v-if="!isMobile">{{ t('mtrtest.Note2') }}</p>
        </div>

        <!-- Input area: IP selection + Run button -->
        <div class="space-y-2">
            <label for="mtrIP" class="text-sm font-medium block">{{ t('mtrtest.Note3') }}</label>
            <div class="flex items-center gap-2">
                <Select v-model="selectedIP" :disabled="mtrCheckStatus === 'running'">
                    <SelectTrigger id="mtrIP" aria-label="Select IP to MTR" class="flex-1">
                        <SelectValue :placeholder="t('mtrtest.SelectIP')" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem v-for="ip in allIPs" :key="ip" :value="ip">{{ ip }}</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="action"
                    :disabled="mtrCheckStatus === 'running' || selectedIP === ''"
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

        <!-- Result Accordion -->
        <Accordion v-if="mtrResults.length > 0" type="single" collapsible default-value="0" class="space-y-2">
            <AccordionItem v-for="(result, index) in mtrResults" :key="result.country" :value="String(index)"
                class="rounded-lg border bg-card px-4">
                <AccordionTrigger class="hover:no-underline">
                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                        <Icon :icon="'circle-flags:' + result.country.toLowerCase()"
                            class="shrink-0 size-5" />
                        <span class="text-sm font-semibold">
                            {{ result.country_name }}, {{ result.city }}
                        </span>
                        <template v-if="!isMobile">
                            <span class="text-muted-foreground">·</span>
                            <span class="text-sm text-muted-foreground truncate">{{ result.network }}</span>
                            <Badge variant="success" class="font-mono font-normal shadow-none rounded-full">AS{{ result.asn }}</Badge>
                        </template>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <pre class="mt-2 p-4 rounded-md bg-muted font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word">{{ result.rawOutput }}</pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { useGlobalpingMeasurement } from '@/composables/use-globalping-measurement';
import getCountryName from '@/data/country-name.js';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Info,Play } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const allIPs = computed(() => {
    const _allIPs = store.allIPs;
    return _allIPs.filter(ip => ip && !ip.includes(' '));
});

const selectedIP = ref('');
const mtrResults = ref([]);
// status: 'idle' | 'running' | 'finished' | 'error' — driven by the composable
const { status: mtrCheckStatus, start: runMeasurement } = useGlobalpingMeasurement({
    pollInterval: 1000,
    maxRetries: 4,
});

const startmtrCheck = () => {
    trackEvent('Section', 'StartClick', 'MTRTest');
    mtrResults.value = [];

    runMeasurement({
        limit: 16,
        locations: [
            { country: 'HK' }, { country: 'TW' }, { country: 'CN' }, { country: 'JP' },
            { country: 'SG' }, { country: 'IN' }, { country: 'RU' }, { country: 'US' },
            { country: 'CA' }, { country: 'AU' }, { country: 'GB' }, { country: 'DE' },
            { country: 'FR' }, { country: 'BR' }, { country: 'ZA' }, { country: 'SA' },
        ],
        target: selectedIP.value,
        type: 'mtr',
        measurementOptions: { port: 80, protocol: 'ICMP' },
    }, {
        onResults: (data) => {
            processmtrResults(data);
            return mtrResults.value.length > 0;
        },
    });
};

const processmtrResults = (data) => {
    const cleanedData = data.results
        .filter(item => item.result.status === 'finished')
        .filter(item => item.result.rawOutput !== null)
        .map(item => ({
            country: item.probe.country,
            country_name: getCountryName(item.probe.country, lang.value),
            city: item.probe.city,
            network: item.probe.network,
            asn: item.probe.asn,
            rawOutput: item.result.rawOutput,
        }));

    mtrResults.value = cleanedData;
};
</script>
