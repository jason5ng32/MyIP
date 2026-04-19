<template>
    <div class="mac-checker-section my-4 space-y-4">
        <!-- Top note -->
        <p class="text-sm text-muted-foreground">{{ t('macchecker.Note') }}</p>

        <!-- Input area: label + InputGroup -->
        <div class="space-y-2">
            <label for="queryMAC" class="text-sm font-medium">{{ t('macchecker.Note2') }}</label>
            <div class="flex items-center gap-2">
                <Input type="text" id="queryMAC" name="queryMAC" data-1p-ignore
                    :disabled="macCheckStatus === 'running'"
                    :placeholder="t('macchecker.Placeholder')"
                    v-model="queryMAC" @keyup.enter="onSubmit" />
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
import { trackEvent } from '@/utils/use-analytics';
import getCountryName from '@/data/country-name.js';
import { CircleCheck, CircleX, Factory, ListChecks } from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@iconify/vue';
import { Search } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);

const macCheckResult = ref({});
const macCheckStatus = ref('idle');
const queryMAC = ref('');
const errorMsg = ref('');

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
    if (!input) return null;
    const normalizedInput = input.replace(/[:-]/g, '').replace(/\s+/g, '');
    if (normalizedInput.length < 6 || normalizedInput.length > 12 || !/^[0-9A-Fa-f]+$/.test(normalizedInput)) {
        errorMsg.value = t('macchecker.invalidMAC');
        return null;
    }
    return normalizedInput;
};

const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'MACChecker');
    errorMsg.value = '';
    macCheckResult.value = {};
    const query = validateInput(queryMAC.value);
    if (query) getMacInfo(query);
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
