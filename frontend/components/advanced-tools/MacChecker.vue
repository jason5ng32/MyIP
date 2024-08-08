<template>
    <!-- MAC Checker -->
    <div class="mac-checker-section mb-4">
        <div class="jn-title2">
            <h2 id="MacChecker" :class="{ 'mobile-h2': isMobile }">🗄️ {{ t('macchecker.Title') }}</h2>

        </div>
        <div class="text-secondary">
            <p>{{ t('macchecker.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body">
                        <div class="col-12 col-md-auto">
                            <label for="queryMAC" class="col-form-label">{{ t('macchecker.Note2') }}</label>
                        </div>

                        <div class="input-group mb-2 mt-2 ">
                            <input type="text" class="form-control" :class="{ 'dark-mode': isDarkMode }"
                                :disabled="macCheckStatus === 'running'" :placeholder="t('macchecker.Placeholder')"
                                v-model="queryMAC" @keyup.enter="onSubmit" name="queryMAC" id="queryMAC" data-1p-ignore>

                            <button class="btn btn-primary" @click="onSubmit"
                                :disabled="macCheckStatus === 'running' || !queryMAC">
                                <span v-if="macCheckStatus !== 'running'">{{
                                    t('macchecker.Run') }}</span>
                                <span v-else class="spinner-grow spinner-grow-sm" aria-hidden="true"></span>
                            </button>

                        </div>
                        <div class="jn-placeholder">
                            <p v-if="errorMsg" class="text-danger">{{ errorMsg }}</p>
                        </div>

                        <!-- Result Display -->

                        <div id="macCheckResult" class="row" v-if="macCheckResult.success">
                            <div class="col-lg-8 col-md-8 col-12 mb-4">
                                <div class="card h-100" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                                    <div class="card-body row">
                                        <h3 class="mb-4">{{ t('macchecker.manufacturer') }}</h3>
                                        <div class="col-lg-6 col-md-6 col-12">
                                            <div class="jn-detail" v-for="item in leftItems" :key="item.key">
                                                <span>
                                                    {{ t(`macchecker.${item.key}`) }}
                                                </span>
                                                <span class="jn-con-title card-title mt-1">
                                                    {{ macCheckResult[item.key] }}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="col-lg-6 col-md-6 col-12">
                                            <div class="jn-detail">
                                                <span>
                                                    {{ t('macchecker.company') }}
                                                </span>
                                                <span class="jn-con-title card-title mt-1">
                                                    {{ macCheckResult.company }}
                                                </span>
                                            </div>
                                            <div v-if="macCheckResult.country !== 'N/A'" class="jn-detail">
                                                <span>
                                                    {{ t('macchecker.country') }}
                                                </span>
                                                <span class="jn-con-title card-title mt-1">
                                                    <span
                                                        :class="'jn-fl fi fi-' + macCheckResult.country.toLowerCase()"></span>
                                                    {{ getCountryName(macCheckResult.country, lang) }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>
                                                    {{ t('macchecker.address') }}
                                                </span>
                                                <span class="jn-con-title card-title mt-1">
                                                    {{ macCheckResult.address }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="col-lg-4 col-md-4 col-12 mb-4">
                                <div class="card h-100" :class="{ 'dark-mode dark-mode-border': isDarkMode}">
                                    <div class="card-body">
                                        <h3 class="mb-4">{{ t('macchecker.property') }}</h3>
                                        <div class="table-responsive text-nowrap">
                                            <table class="table table-hover" :class="{ 'table-dark': isDarkMode }">
                                                <thead>
                                                    <tr>
                                                        <th scope="col">{{ t('macchecker.property') }}</th>
                                                        <th scope="col">{{ t('macchecker.value') }}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr v-for="item in tableItems" :key="item.key">
                                                        <td>{{ t(`macchecker.${item.key}`) }}</td>
                                                        <td>
                                                            <i class="bi"
                                                                :class="macCheckResult[item.key] ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-secondary'"></i>
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
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import getCountryName from '@/utils/country-name.js';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
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

// 检查 MAC 是否有效
const validateInput = (input) => {
    if (!input) return null;
    // 清理所有的分隔符和空格
    const normalizedInput = input.replace(/[:-]/g, '')
        .replace(/\s+/g, '');
    // 检查长度和格式
    if (normalizedInput.length < 6 || normalizedInput.length > 12 || !/^[0-9A-Fa-f]+$/.test(normalizedInput)) {
        errorMsg.value = t('macchecker.invalidMAC');
        return null;
    }

    return normalizedInput;
};

// 提交查询
const onSubmit = () => {
    trackEvent('Section', 'StartClick', 'MACChecker');
    errorMsg.value = '';
    macCheckResult.value = {};
    const query = validateInput(queryMAC.value);
    if (query) {
        getMacInfo(query);
    }
};

// 获取 MAC 信息
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