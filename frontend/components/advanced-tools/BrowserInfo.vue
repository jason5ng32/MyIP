<template>
    <!-- Browser Info -->
    <div class="browser-info-section my-4">
        <div class="text-neutral-500">
            <p>{{ t('browserinfo.Note') }}</p>
            <p>{{ t('browserinfo.Note2') }}</p>
        </div>
        <div class="mb-3">
            <div class="jn-card rounded-lg border bg-card text-card-foreground">
                <div class="p-4">
                    <Transition name="slide-fade" mode="out-in">
                        <div id="browserInfoResult" class="flex flex-wrap -mx-2" v-if="checkingStatus === 'finished'">
                            <div class="w-full md:w-2/3 px-2 mb-4">
                                <div class="h-full">
                                    <div class="flex flex-wrap" :class="[isMobile ? 'p-1 border-b' : '']">
                                        <h3 class="mb-4 w-full text-xl font-semibold">
                                            {{ t('browserinfo.browser.Infos') }}
                                            <BriefcaseBusiness class="inline size-[1em] align-[-0.125em]" />
                                        </h3>
                                        <div class="w-full">
                                            <div class="flex flex-col w-full px-3 py-2 rounded-md border bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200">
                                                <Badge class="w-fit mb-1 bg-green-600 text-white border-transparent">User Agent</Badge>
                                                <span>
                                                    <span class="jn-code-font">{{ userAgent.ua }}</span>
                                                    <component :is="copiedStatus ? ClipboardCheck : ClipboardPlus"
                                                        class="inline size-[1em] align-[-0.125em]"
                                                        @click="copyToClipboard(userAgent.ua)" role="button"
                                                        aria-label="Copy UA" />
                                                </span>
                                            </div>
                                        </div>

                                        <div class="w-full md:w-1/2 mt-3">
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.browserName') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ userAgent.browser.name }} {{ userAgent.browser.version }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.engineName') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ userAgent.engine.name }} {{ userAgent.engine.version }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.osName') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ userAgent.os.name }} {{ userAgent.os.version }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.language') }}</span>
                                                <span class="jn-con-title mt-1">{{ otherInfos.browserLanguage }}</span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.cookieEnabled') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ otherInfos.cookieEnabled ? t('browserinfo.browser.cookieEnabledTrue') : t('browserinfo.browser.cookieEnabledFalse') }}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="w-full md:w-1/2 mt-3">
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.deviceVendor') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ userAgent.device.vendor }} {{ userAgent.device.model }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.cpuArchitecture') }}</span>
                                                <span class="jn-con-title mt-1">
                                                    {{ userAgent.device.cpu ? userAgent.device.cpu.architecture : 'N/A' }}
                                                </span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.gpu') }}</span>
                                                <span class="jn-con-title mt-1">{{ gpu }}</span>
                                            </div>
                                            <div class="jn-detail">
                                                <span>{{ t('browserinfo.browser.cpuCores') }}</span>
                                                <span class="jn-con-title mt-1">{{ otherInfos.cpucores }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="w-full md:w-1/3 px-2 mb-4">
                                <div class="h-full" :class="{ 'rounded-lg border bg-card text-card-foreground': !isMobile }">
                                    <div :class="[isMobile ? 'p-1' : 'p-4']">
                                        <h3 class="mb-4 text-xl font-semibold">
                                            {{ t('browserinfo.fingerprint.Infos') }}
                                            <Fingerprint class="inline size-[1em] align-[-0.125em]" />
                                        </h3>
                                        <div class="w-full">
                                            <div class="flex flex-col w-full px-3 py-2 rounded-md border bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200"
                                                :class="[isMobile ? 'jn-fp-box-mobile' : '']">
                                                <Badge class="w-fit mb-1 bg-blue-600 text-white border-transparent">
                                                    {{ t('browserinfo.fingerprint.fingerprint') }}
                                                </Badge>
                                                <span class="jn-code-font break-all">{{ fingerprint }}</span>
                                            </div>
                                        </div>

                                        <p class="mt-3">{{ t('browserinfo.fingerprint.changeOption') }}</p>

                                        <div class="flex flex-wrap gap-1 m-1">
                                            <div v-for="(value, key) in excludeOptions" :key="key"
                                                class="flex items-center gap-2 w-1/2 py-1">
                                                <Switch :id="key" v-model="excludeOptions[key]" />
                                                <label :for="key" class="cursor-pointer select-none">
                                                    {{ t(`browserinfo.options.${key}`) }}
                                                </label>
                                            </div>
                                        </div>
                                        <div class="px-3 py-2 rounded-md border bg-neutral-50 border-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 opacity-75 mt-4" role="alert">
                                            <Info class="inline size-[1em] align-[-0.125em]" />
                                            {{ t('browserinfo.fingerprint.browserTips') }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-else class="jn-placeholder">
                            <span v-if="checkingStatus === 'running'">
                                <span class="inline-block h-3 w-3 rounded-full bg-green-600 animate-pulse" aria-hidden="true"></span>
                                <span class="text-green-600">&nbsp;{{ t('browserinfo.calculating') }}</span>
                            </span>
                            <p v-if="checkingStatus === 'error'" class="text-red-600">{{ errorMsg }}</p>
                        </div>
                    </Transition>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { BriefcaseBusiness, ClipboardCheck, ClipboardPlus, Fingerprint, Info } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
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
const gpu = ref('');
const otherInfos = ref({});

// 获取 GPU 信息
const getGPU = async () => {
    try {
        const { getGPUTier } = await import('detect-gpu');
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
        const { UAParser } = await import('ua-parser-js');
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
        const { getFingerprint, setOption } = await import('@thumbmarkjs/thumbmarkjs');
        setOption('exclude', excludes);
        const getFP = await getFingerprint();
        fingerprint.value = getFP;
    } catch (error) {
        console.error('Error getting fingerprint:', error);
        throw error;
    }
};

// 获取全部
const getAll = async () => {
    try {
        checkingStatus.value = 'running';
        await Promise.all([
            getUA(),
            getFingerPrint(),
            getGPU(),
            getOtherBrowserInfo()
        ]);
        checkingStatus.value = 'finished';
    } catch (error) {
        console.error('Error during checks:', error);
        checkingStatus.value = 'error';
        errorMsg.value = t('browserinfo.calError');
    }
}

// 复制
const copyToClipboard = async (ua) => {
    try {
        await navigator.clipboard.writeText(ua);
        copiedStatus.value = true;
        setTimeout(() => {
            copiedStatus.value = false;
        }, 5000);
    } catch (err) {
        console.error('Copy error:', err);
    }
};

onMounted(() => {
    checkingStatus.value = 'running';
    setTimeout(() => {
        getAll();
    }, 1000);
});

// 监控排除选项
watch(excludeOptions, () => {
    getFingerPrint();
}, { immediate: true, deep: true });
</script>

<style scoped>
.jn-placeholder {
    height: 16pt;
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
