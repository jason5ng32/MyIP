<!-- MAC Lookup (advanced tool, slug `macchecker`): a full address or a
     vendor prefix (common/mac-input.js), answered by /api/macchecker from the
     local IEEE registries. A collapsed fold under the input holds example
     pills, one per kind of answer. Browsers expose no MAC address, so there
     is no "my address" pill. -->
<template>
    <div class="mac-checker-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground leading-relaxed">{{ t('macchecker.Note') }}</p>

        <!-- Input area: label + Input + icon trigger -->
        <div class="space-y-2">
            <Label for="queryMAC">{{ t('macchecker.Note2') }}</Label>
            <div class="flex items-center gap-2">
                <Input type="text" id="queryMAC" name="queryMAC" data-1p-ignore data-lpignore="true" class="font-mono"
                    autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                    :disabled="macCheckStatus === 'running'"
                    :placeholder="t('macchecker.Placeholder')"
                    v-model="queryMAC" @keyup.enter="onSubmit" :aria-invalid="errorMsg !== ''" />
                <Button variant="action"
                    :disabled="macCheckStatus === 'running' || !queryMAC"
                    @click="onSubmit" class="cursor-pointer">
                    <Spinner v-if="macCheckStatus === 'running'" />
                    <template v-else>
                        <Search class="size-4 shrink-0" />
                    </template>
                </Button>
            </div>
            <p v-if="errorMsg" class="text-sm text-destructive">{{ errorMsg }}</p>

            <!-- Example inputs, tap to run. Collapsed by default; the chevron
                 turns from › to ⌄ via data-state. -->
            <Collapsible>
                <CollapsibleTrigger>
                    <button type="button" :class="triggerClass">
                        <ChevronRight class="size-4 transition-transform duration-200" />{{ t('macchecker.Examples') }}
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ToggleGroup :model-value="picked" type="single" variant="outline" :spacing="2"
                        :disabled="macCheckStatus === 'running'"
                        class="mt-2 flex-wrap justify-start" @update:model-value="(v) => v && runPreset(v)">
                        <ToggleGroupItem v-for="example in EXAMPLES" :key="example.input" :value="example.input"
                            :class="tagClass" :aria-label="`${t(example.labelKey)}: ${example.input}`">
                            <span class="text-muted-foreground">{{ t(example.labelKey) }}</span>
                            <span class="font-mono">{{ example.input }}</span>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </CollapsibleContent>
            </Collapsible>
        </div>

        <!-- Result area -->
        <Card v-if="macCheckResult.success" id="macCheckResult">
            <CardContent class="p-4 md:p-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Manufacturer details -->
                    <section class="md:col-span-2 space-y-4">
                        <header class="flex items-center gap-2">
                            <Factory class="size-5 text-muted-foreground" />
                            <h3 class="text-lg font-semibold tracking-tight m-0">
                                {{ t('macchecker.manufacturer') }}
                            </h3>
                        </header>

                        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                            <div v-for="item in leftItems" :key="item.key">
                                <dt class="text-sm text-muted-foreground mb-0.5">{{ t(`macchecker.${item.key}`) }}</dt>
                                <dd class="text-base font-medium wrap-break-word font-mono">{{ macCheckResult[item.key] }}</dd>
                            </div>

                            <div>
                                <dt class="text-sm text-muted-foreground mb-0.5">{{ t('macchecker.company') }}</dt>
                                <dd class="text-base font-medium wrap-break-word">{{ macCheckResult.company }}</dd>
                            </div>
                            <div v-if="macCheckResult.country !== 'N/A'">
                                <dt class="text-sm text-muted-foreground mb-0.5">{{ t('macchecker.country') }}</dt>
                                <dd class="text-base font-medium flex items-center gap-1.5 flex-wrap">
                                    <Icon :icon="'circle-flags:' + macCheckResult.country.toLowerCase()"
                                        class="shrink-0 size-4" />
                                    <span class="wrap-break-word">{{ getCountryName(macCheckResult.country, lang) }}</span>
                                </dd>
                            </div>
                            <div class="sm:col-span-2">
                                <dt class="text-sm text-muted-foreground mb-0.5">{{ t('macchecker.address') }}</dt>
                                <dd class="text-base font-medium wrap-break-word">{{ macCheckResult.address }}</dd>
                            </div>
                        </dl>
                    </section>

                    <!-- Property list -->
                    <section class="space-y-4">
                        <header class="flex items-center gap-2">
                            <ListChecks class="size-5 text-muted-foreground" />
                            <h3 class="text-lg font-semibold tracking-tight m-0">{{ t('macchecker.property') }}</h3>
                        </header>

                        <div class="rounded-lg border bg-card divide-y">
                            <div v-for="item in tableItems" :key="item.key"
                                class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                                <span>{{ t(`macchecker.${item.key}`) }}</span>
                                <component :is="macCheckResult[item.key] ? CircleCheck : CircleX"
                                    class="size-4 shrink-0"
                                    :class="macCheckResult[item.key] ? 'text-success' : 'text-muted-foreground/50'" />
                            </div>
                        </div>
                    </section>
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
import getCountryName from '@/data/country-name.js';
import { normalizeMacQuery } from '@/utils/mac-input.js';
import { ChevronRight, CircleCheck, CircleX, Factory, ListChecks, Search } from '@lucide/vue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);

const macCheckResult = ref({});
const macCheckStatus = ref('idle');
const queryMAC = ref('');
const errorMsg = ref('');
// Which example pill the current result came from, if any.
const picked = ref('');

// One example per kind of answer; the pills double as syntax documentation.
const EXAMPLES = [
    { labelKey: 'macchecker.exampleFull', input: 'F0:2F:4B:01:0A:AA' },
    { labelKey: 'macchecker.examplePrefix', input: '3C:5A:B4' },
    { labelKey: 'macchecker.exampleSubBlock', input: 'F0:40:AF:91:23:45' },
    { labelKey: 'macchecker.examplePrivate', input: 'AC:DE:48:00:11:22' },
    { labelKey: 'macchecker.exampleMulticast', input: '01:00:5E:00:00:FB' },
    { labelKey: 'macchecker.exampleRandom', input: '42:9F:C3:15:7A:E0' },
];

// Pills and fold trigger match IpCalculator's.
const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';
const triggerClass = 'flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground [&[data-state=open]>svg]:rotate-90';

const leftItems = computed(() => [
    { key: 'macPrefix' },
    { key: 'blockStart' },
    { key: 'blockEnd' },
    { key: 'blockSize' },
    { key: 'blockType' },
]);

const tableItems = computed(() => [
    { key: 'isRand' },
    { key: 'isPrivate' },
    { key: 'isMulticast' },
    { key: 'isUnicast' },
    { key: 'isLocal' },
    { key: 'isGlobal' },
]);

const validateInput = (input) => {
    const hex = normalizeMacQuery(input);
    if (!hex) errorMsg.value = t('macchecker.invalidMAC');
    return hex;
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'MACChecker');
    errorMsg.value = '';
    macCheckResult.value = {};
    const raw = queryMAC.value.trim();
    picked.value = EXAMPLES.some((e) => e.input === raw) ? raw : '';
    const query = validateInput(raw);
    if (query) getMacInfo(query);
};

const runPreset = (input) => {
    queryMAC.value = input;
    onSubmit();
};

const getMacInfo = async (query) => {
    macCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/macchecker?mac=${query}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        macCheckResult.value = data;
        macCheckStatus.value = 'idle';
    } catch (error) {
        console.error('Error fetching MAC results:', error);
        macCheckStatus.value = 'idle';
        errorMsg.value = t('macchecker.fetchError');
    }
};
</script>
