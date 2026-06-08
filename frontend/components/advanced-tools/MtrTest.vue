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
                <Button variant="action" :disabled="mtrCheckStatus === 'running' || !targetIP" @click="startmtrCheck"
                    class="cursor-pointer">
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
                class="rounded-lg border bg-card px-4 data-[state=open]:border-primary/30">
                <AccordionTrigger class="hover:no-underline cursor-pointer my-1">
                    <div class="flex items-center gap-2 min-w-0 flex-wrap">
                        <Icon :icon="'circle-flags:' + result.country.toLowerCase()" class="shrink-0 size-5" />
                        <span class="text-sm font-semibold">
                            {{ result.country_name }}, {{ result.city }}
                        </span>
                        <template v-if="!isMobile">
                            <span class="text-muted-foreground">·</span>
                            <span class="text-sm text-muted-foreground truncate">{{ result.network }}</span>
                            <Badge variant="success" class="font-mono font-normal shadow-none rounded-full">AS{{
                                result.asn }}</Badge>
                        </template>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <pre
                        class="mt-2 p-4 rounded-md bg-muted font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word">{{ result.rawOutput }}</pre>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
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
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
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

const startmtrCheck = () => {
    if (!targetIP.value) return;
    trackEvent('Section', 'StartClick', 'MTRTest');
    mtrResults.value = [];

    runMeasurement({
        limit: 16,
        locations: GLOBALPING_DEFAULT_LOCATIONS,
        target: targetIP.value,
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
