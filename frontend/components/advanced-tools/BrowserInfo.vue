<template>
    <!-- Browser Info -->
    <div class="browser-info-section my-4">
        <div class="text-secondary">
            <p>{{ t('browserinfo.Note') }}</p>
            <p>{{ t('browserinfo.Note2') }}</p>
        </div>
        <div class="row">
            <div class="col-12 mb-3">
                <div class="card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">

                    <div class="card-body">
                        <Transition name="slide-fade" mode="out-in">
                            <div id="browserInfoResult" class="row" v-if="checkingStatus === 'finished'">
                                <div class="col-lg-8 col-md-8 col-12 mb-4">
                                    <div class="h-100" :class="{ 
                                    'dark-mode dark-mode-border': isDarkMode,
                                    'card': !isMobile
                                    }">

                                        <div class="card-body row"
                                            :class="[isMobile ? 'p-1 border-1 border-bottom' : '']">
                                            <h3 class="mb-4">{{ t('browserinfo.browser.Infos') }} <i
                                                    class="bi bi-person-workspace"></i></h3>
                                            <div class="jn-ua-box w-100">
                                                <div class="alert alert-success jn-ua-box">
                                                    <span class="mb-1 badge text-bg-success">User Agent</span>
                                                    <span><span class="jn-code-font ">{{ userAgent.ua }}</span> <i
                                                            :class="copiedStatus ? 'bi bi-clipboard-check-fill' : 'bi bi-clipboard-plus'"
                                                            @click="copyToClipboard(userAgent.ua)" role="button"
                                                            aria-label="Copy UA"></i></span>
                                                </div>
                                            </div>

                                            <div class="col-lg-6 col-md-6 col-12">
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.browserName') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ userAgent.browser.name }} {{ userAgent.browser.version }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.engineName') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ userAgent.engine.name }} {{ userAgent.engine.version }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.osName') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ userAgent.os.name }} {{ userAgent.os.version }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.language') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ otherInfos.browserLanguage }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.cookieEnabled') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ otherInfos.cookieEnabled?
                                                        t('browserinfo.browser.cookieEnabledTrue'):t('browserinfo.browser.cookieEnabledFalse')
                                                        }}
                                                    </span>
                                                </div>
                                            </div>

                                            <div class="col-lg-6 col-md-6 col-12">
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.deviceVendor') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ userAgent.device.vendor }} {{ userAgent.device.model }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.cpuArchitecture') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ userAgent.device.cpu ? userAgent.device.cpu.architecture :
                                                        'N/A'
                                                        }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.gpu') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ gpu }}
                                                    </span>
                                                </div>
                                                <div class="jn-detail">
                                                    <span>
                                                        {{ t('browserinfo.browser.cpuCores') }}
                                                    </span>
                                                    <span class="jn-con-title card-title mt-1">
                                                        {{ otherInfos.cpucores }}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                <div class="col-lg-4 col-md-4 col-12 mb-4">
                                    <div class="h-100" :class="{ 
                                    'dark-mode dark-mode-border': isDarkMode,
                                    'card': !isMobile
                                    }">
                                        <div class="card-body" :class="[isMobile ? 'p-1' : '']">
                                            <h3 class="mb-4">{{ t('browserinfo.fingerprint.Infos') }} <i
                                                    class="bi bi-fingerprint"></i></h3>
                                            <div class="jn-ua-box w-100">
                                                <div :class="[isMobile ? 'jn-fp-box-mobile' : '']"
                                                    class="alert alert-primary jn-ua-box">
                                                    <span class="mb-1 badge text-bg-primary">{{
                                                        t('browserinfo.fingerprint.fingerprint') }}</span>
                                                    <span class="jn-code-font ">{{ fingerprint }}</span>
                                                </div>
                                            </div>

                                            <p>{{ t('browserinfo.fingerprint.changeOption') }}</p>

                                            <div class="row g-1 m-1">
                                                <div v-for="(value, key) in excludeOptions" :key="key"
                                                    class="form-check form-switch col-6">
                                                    <input class="form-check-input" type="checkbox" :id="key"
                                                        v-model="excludeOptions[key]" />
                                                    <label class="form-check-label" :for="key">
                                                        {{ t(`browserinfo.options.${key}`) }}
                                                    </label>
                                                </div>
                                            </div>
                                            <div class="alert alert-light opacity-75 mt-4" role="alert">
                                                <i class="bi bi-info-circle"></i> {{
                                                t('browserinfo.fingerprint.browserTips') }}
                                            </div>

                                        </div>
                                    </div>
                                </div>

                            </div>
                            <div v-else class="jn-placeholder ">
                                <span v-if="checkingStatus === 'running'">
                                    <span class="spinner-grow spinner-grow-sm text-success" aria-hidden="true"></span>
                                    <span class="text-success">&nbsp;{{ t('browserinfo.calculating') }}</span>
                                </span>
                                <p v-if="checkingStatus === 'error'" class="text-danger">{{ errorMsg }}</p>
                            </div>
                        </Transition>
                    </div>

                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, reactive, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { UAParser } from 'ua-parser-js';
import { getFingerprint as calFingerPrint, setOption as setFingerPrintOption } from '@thumbmarkjs/thumbmarkjs';
import { getGPUTier } from 'detect-gpu';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const fingerprint = ref('');
const excludeOptions = ref({
    'audio': true,
    'canvas': true,
    'fonts': true,
    'hardware': true,
    'locales': true,
    'permissions': true,
    'plugins': true,
    'screen': true,
    'system': true,
    'webgl': true,
    'math': true,
});
const errorMsg = ref('');
const checkingStatus = ref('idle');
const copiedStatus = ref(false);

const userAgent = ref('');
const fullFPDatas = ref();
const gpu = ref('');
const otherInfos = ref({});

// 获取 GPU 信息
const getGPU = async () => {
    try {
        const gpuTier = await getGPUTier();
        if (gpuTier && gpuTier.gpu) {
            gpu.value = gpuTier.gpu.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
        } else {
            gpu.value = 'N/A';
        }
    } catch (error) {
        console.error('Error getting GPU info:', error);
        throw error;
    }
}

// 获取 UA
const getUA = async () => {
    try {
        const parser = new UAParser();
        parser.setUA(parser.getUA());
        userAgent.value = parser.getResult();
    } catch (error) {
        console.error('Error getting user agent:', error);
        throw error;
    }
};

// 获取其他信息
const getOtherBrowserInfo = async () => {
    try {
        otherInfos.value.browserLanguage = navigator.language;
        otherInfos.value.cookieEnabled = navigator.cookieEnabled;
        otherInfos.value.cpucores = navigator.hardwareConcurrency;
    } catch (error) {
        console.error('Error getting other browser info:', error);
        throw error;
    }
};

// 获取指纹计算的排除选项
const getExcludeOptions = async () => {
    const results = [];
    const checkOptions = (options, prefix = '') => {
        for (const key in options) {
            const value = options[key];
            const fullPath = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object') {
                checkOptions(value, fullPath);
            } else if (!value) {
                results.push(fullPath);
            }
        }
    };

    checkOptions(excludeOptions.value);
    return results;
};

// 获取指纹
const getFingerPrint = async () => {
    fingerprint.value = t('browserinfo.calculating');
    try {
        let excludes = await getExcludeOptions();
        setFingerPrintOption('exclude', excludes);
        const getFP = await calFingerPrint();
        fingerprint.value = getFP;
    } catch (error) {
        console.error('Error getting fingerprint:', error);
        throw error;
    }
};

// 获取全部
const getAll = async () => {
    try {
        await getUA();
        await getFingerPrint();
        await getGPU();
        await getOtherBrowserInfo();
        checkingStatus.value = 'finished';
    } catch (error) {
        console.error('Error during checks:', error);
        checkingStatus.value = 'error';
        errorMsg.value = t('browserinfo.calError');
    }
}

// 复制
const copyToClipboard = (ua) => {
    navigator.clipboard.writeText(ua).then(() => {
        copiedStatus.value = true;
        setTimeout(() => {
            copiedStatus.value = false;
        }, 5000);
    }).catch(err => {
        console.error('Copy error', err);
    });
};

onMounted(() => {
    checkingStatus.value = 'running';
    setTimeout(() => {
        getAll();
    }, 1000);
});

// 监控排除选项
watch(excludeOptions, (newVal, oldVal) => {
    getFingerPrint();
}, { immediate: true, deep: true });

</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
}

.jn-ua-box {
    height: fit-content;
    display: flex;
    flex-direction: column;
}

.jn-ua-box .badge {
    width: fit-content;
}

.jn-code-font {
    font-family: "IntelOne Mono", "Courier New", "Courier", "monospace";
    font-weight: 400;
}

.jn-fp-box-mobile {
    min-height: 80pt;
}

.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.3s ease-out;
}

.slide-fade-enter-from {
    transform: translateY(60px);
    opacity: 0;
}

.slide-fade-leave-to {
    opacity: 0;
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