<template>
    <!-- MAC Checker -->
    <div class="mac-checker-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('macchecker.Note') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <div>
                        <label for="queryMAC" class="inline-block">{{ t('macchecker.Note2') }}</label>
                    </div>

                    <div class="flex mb-2 mt-2">
                        <Input type="text" class="rounded-r-none"
                            :disabled="macCheckStatus === 'running'"
                            :placeholder="t('macchecker.Placeholder')"
                            v-model="queryMAC" @keyup.enter="onSubmit"
                            name="queryMAC" id="queryMAC" data-1p-ignore />
                        <Button class="rounded-l-none -ml-px bg-blue-600 hover:bg-blue-700 text-white"
                            @click="onSubmit"
                            :disabled="macCheckStatus === 'running' || !queryMAC">
                            <span v-if="macCheckStatus !== 'running'">{{ t('macchecker.Run') }}</span>
                            <span v-else class="inline-block h-3 w-3 rounded-full bg-current animate-pulse" aria-hidden="true"></span>
                        </Button>
                    </div>
                    <div class="jn-placeholder">
                        <p v-if="errorMsg" class="text-red-600">{{ errorMsg }}</p>
                    </div>

                    <!-- Result Display -->
                    <div id="macCheckResult" class="flex flex-wrap -mx-2" v-if="macCheckResult.success">
                        <div class="w-full md:w-2/3 px-2 mb-4">
                            <div class="h-full rounded-lg border bg-card text-card-foreground">
                                <div class="p-4 flex flex-wrap">
                                    <h3 class="w-full mb-4 text-xl font-semibold">{{ t('macchecker.manufacturer') }}</h3>
                                    <div class="w-full md:w-1/2">
                                        <div class="jn-detail" v-for="item in leftItems" :key="item.key">
                                            <span>{{ t(`macchecker.${item.key}`) }}</span>
                                            <span class="jn-con-title mt-1">{{ macCheckResult[item.key] }}</span>
                                        </div>
                                    </div>

                                    <div class="w-full md:w-1/2">
                                        <div class="jn-detail">
                                            <span>{{ t('macchecker.company') }}</span>
                                            <span class="jn-con-title mt-1">{{ macCheckResult.company }}</span>
                                        </div>
                                        <div v-if="macCheckResult.country !== 'N/A'" class="jn-detail">
                                            <span>{{ t('macchecker.country') }}</span>
                                            <span class="jn-con-title mt-1">
                                                <span :class="'jn-fl fi fi-' + macCheckResult.country.toLowerCase()"></span>
                                                {{ getCountryName(macCheckResult.country, lang) }}
                                            </span>
                                        </div>
                                        <div class="jn-detail">
                                            <span>{{ t('macchecker.address') }}</span>
                                            <span class="jn-con-title mt-1">{{ macCheckResult.address }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="w-full md:w-1/3 px-2 mb-4">
                            <div class="h-full rounded-lg border bg-card text-card-foreground">
                                <div class="p-4">
                                    <h3 class="mb-4 text-xl font-semibold">{{ t('macchecker.property') }}</h3>
                                    <div class="overflow-x-auto whitespace-nowrap">
                                        <table class="w-full border-collapse">
                                            <thead>
                                                <tr class="border-b border-neutral-200 dark:border-neutral-700">
                                                    <th scope="col" class="text-left p-2">{{ t('macchecker.property') }}</th>
                                                    <th scope="col" class="text-left p-2">{{ t('macchecker.value') }}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr v-for="item in tableItems" :key="item.key"
                                                    class="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                                    <td class="p-2">{{ t(`macchecker.${item.key}`) }}</td>
                                                    <td class="p-2">
                                                        <i class="bi"
                                                            :class="macCheckResult[item.key] ? 'bi-check-circle-fill text-green-600' : 'bi-x-circle-fill text-neutral-500'"></i>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import getCountryName from '@/utils/country-name.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const store = useMainStore();
const lang = computed(() => store.lang);

const macCheckResult = ref({});
const macCheckStatus = ref("idle");
const queryMAC = ref('');
const errorMsg = ref('');

const leftItems = computed(() => {
    return [
        { key: 'macPrefix' },
        { key: 'blockStart' },
        { key: 'blockEnd' },
        { key: 'blockSize' },
        { key: 'blockType' }
    ];
});

const tableItems = computed(() => {
    return [
        { key: 'isRand' },
        { key: 'isPrivate' },
        { key: 'isMulticast' },
        { key: 'isUnicast' },
        { key: 'isLocal' },
        { key: 'isGlobal' }
    ];
});

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
    if (query) {
        getMacInfo(query);
    }
};

const getMacInfo = async (query) => {
    macCheckStatus.value = 'running';
    try {
        const response = await fetch(`/api/macchecker?mac=${query}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
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

<style scoped>
.jn-placeholder {
    height: 16pt;
}

.jn-detail {
    display: flex;
    flex-direction: column;
    align-content: flex-start;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 10pt;
}
</style>
