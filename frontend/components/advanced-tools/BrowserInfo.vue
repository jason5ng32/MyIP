<template>
    <div class="browser-info-section my-4 space-y-4">
        <!-- 顶部说明 -->
        <div class="text-sm text-muted-foreground space-y-1.5">
            <p>{{ t('browserinfo.Note') }}</p>
            <p>{{ t('browserinfo.Note2') }}</p>
        </div>

        <Transition name="slide-fade" mode="out-in">
            <!-- 加载 / 错误态 -->
            <div v-if="checkingStatus !== 'finished'"
                class="flex items-center justify-center gap-2 py-8 text-sm">
                <template v-if="checkingStatus === 'running'">
                    <Spinner class="text-info" />
                    <span class="text-muted-foreground">{{ t('browserinfo.calculating') }}</span>
                </template>
                <p v-else-if="checkingStatus === 'error'" class="text-destructive">{{ errorMsg }}</p>
            </div>

            <!-- 结果态：外层 Card 包住，内部左 2/3 Browser + 右 1/3 Fingerprint -->
            <Card v-else id="browserInfoResult">
                <CardContent class="p-4 md:p-6">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Browser 区 -->
                        <section class="md:col-span-2 space-y-4">
                            <header class="flex items-center gap-2">
                                <BriefcaseBusiness class="size-5 text-muted-foreground" />
                                <h3 class="text-lg font-semibold tracking-tight m-0">
                                    {{ t('browserinfo.browser.Infos') }}
                                </h3>
                            </header>

                            <!-- UA hero 块 —— success 色系强调 -->
                            <div class="rounded-lg border border-success/30 bg-success/10 p-3 space-y-2">
                                <div class="flex items-center justify-between gap-2">
                                    <Badge class="bg-success text-success-foreground border-transparent font-normal">
                                        User Agent
                                    </Badge>
                                    <Button variant="ghost" size="icon" class="size-7 -mr-1 cursor-pointer hover:bg-transparent"
                                        @click="copyToClipboard(userAgent.ua)"
                                        aria-label="Copy UA">
                                        <component :is="copiedStatus ? ClipboardCheck : ClipboardPlus" />
                                    </Button>
                                </div>
                                <p class="font-mono text-sm leading-relaxed wrap-break-word">{{ userAgent.ua }}</p>
                            </div>

                            <!-- 字段 dl 网格 -->
                            <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div v-for="f in browserFields" :key="f.label">
                                    <dt class="text-sm text-muted-foreground mb-0.5">{{ f.label }}</dt>
                                    <dd class="text-base font-medium wrap-break-word">{{ f.value || '—' }}</dd>
                                </div>
                            </dl>
                        </section>

                        <!-- Fingerprint 区 -->
                        <section class="space-y-4">
                            <header class="flex items-center gap-2">
                                <Fingerprint class="size-5 text-muted-foreground" />
                                <h3 class="text-lg font-semibold tracking-tight m-0">
                                    {{ t('browserinfo.fingerprint.Infos') }}
                                </h3>
                            </header>

                            <!-- Fingerprint hero 块 —— info 色系强调（跟 UA 区分） -->
                            <div class="rounded-lg border border-info/30 bg-info/10 p-3 space-y-2">
                                <Badge class="bg-info text-info-foreground border-transparent font-normal">
                                    {{ t('browserinfo.fingerprint.fingerprint') }}
                                </Badge>
                                <p class="font-mono text-sm wrap-break-word">{{ fingerprint }}</p>
                            </div>

                            <!-- Exclude options -->
                            <div>
                                <p class="text-sm mb-2">{{ t('browserinfo.fingerprint.changeOption') }}</p>
                                <div class="rounded-lg border bg-card divide-y">
                                    <div v-for="(_, key) in excludeOptions" :key="key"
                                        class="flex items-center justify-between gap-2 px-3 py-2">
                                        <label :for="key" class="text-sm cursor-pointer select-none">
                                            {{ t(`browserinfo.options.${key}`) }}
                                        </label>
                                        <Switch :id="key" v-model="excludeOptions[key]" />
                                    </div>
                                </div>
                            </div>

                            <!-- 提示 -->
                            <div class="flex items-start gap-2 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground">
                                <Info class="size-3.5 mt-0.5 shrink-0" />
                                <span class="leading-relaxed">{{ t('browserinfo.fingerprint.browserTips') }}</span>
                            </div>
                        </section>
                    </div>
                </CardContent>
            </Card>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { BriefcaseBusiness, ClipboardCheck, ClipboardPlus, Fingerprint, Info } from 'lucide-vue-next';
import { Card, CardContent } from '@/components/ui/card';

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

// 浏览器字段：数据驱动，避免模板重复 8 段 jn-detail
const browserFields = computed(() => {
    if (!userAgent.value || !userAgent.value.browser) return [];
    return [
        { label: t('browserinfo.browser.browserName'),    value: `${userAgent.value.browser.name || ''} ${userAgent.value.browser.version || ''}`.trim() },
        { label: t('browserinfo.browser.deviceVendor'),   value: `${userAgent.value.device.vendor || ''} ${userAgent.value.device.model || ''}`.trim() },
        { label: t('browserinfo.browser.engineName'),     value: `${userAgent.value.engine.name || ''} ${userAgent.value.engine.version || ''}`.trim() },
        { label: t('browserinfo.browser.cpuArchitecture'), value: userAgent.value.device.cpu ? userAgent.value.device.cpu.architecture : 'N/A' },
        { label: t('browserinfo.browser.osName'),         value: `${userAgent.value.os.name || ''} ${userAgent.value.os.version || ''}`.trim() },
        { label: t('browserinfo.browser.gpu'),            value: gpu.value },
        { label: t('browserinfo.browser.language'),       value: otherInfos.value.browserLanguage },
        { label: t('browserinfo.browser.cpuCores'),       value: otherInfos.value.cpucores },
        { label: t('browserinfo.browser.cookieEnabled'),  value: otherInfos.value.cookieEnabled
            ? t('browserinfo.browser.cookieEnabledTrue')
            : t('browserinfo.browser.cookieEnabledFalse') },
    ];
});

const getGPU = async () => {
    try {
        const { getGPUTier } = await import('detect-gpu');
        const gpuTier = await getGPUTier();
        gpu.value = gpuTier && gpuTier.gpu
            ? gpuTier.gpu.toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase())
            : 'N/A';
    } catch (error) {
        console.error('Error getting GPU info:', error);
        throw error;
    }
};

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

const getExcludeOptions = async () => {
    const results = [];
    const checkOptions = (options, prefix = '') => {
        for (const key in options) {
            const value = options[key];
            const fullPath = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object') checkOptions(value, fullPath);
            else if (!value) results.push(fullPath);
        }
    };
    checkOptions(excludeOptions.value);
    return results;
};

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

const getAll = async () => {
    try {
        checkingStatus.value = 'running';
        await Promise.all([getUA(), getFingerPrint(), getGPU(), getOtherBrowserInfo()]);
        checkingStatus.value = 'finished';
    } catch (error) {
        console.error('Error during checks:', error);
        checkingStatus.value = 'error';
        errorMsg.value = t('browserinfo.calError');
    }
};

const copyToClipboard = async (ua) => {
    try {
        await navigator.clipboard.writeText(ua);
        copiedStatus.value = true;
        setTimeout(() => { copiedStatus.value = false; }, 5000);
    } catch (err) {
        console.error('Copy error:', err);
    }
};

onMounted(() => {
    checkingStatus.value = 'running';
    setTimeout(() => { getAll(); }, 1000);
});

watch(excludeOptions, () => { getFingerPrint(); }, { immediate: true, deep: true });
</script>

<style scoped>
.slide-fade-enter-active,
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
</style>
