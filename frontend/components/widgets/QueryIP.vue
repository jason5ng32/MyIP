<template>
    <!-- 悬浮查询按钮（右下固定） -->
    <JnTooltip :text="t('Tooltips.QueryIP')" side="left">
        <Button size="icon" type="button" aria-label="IP Check"
            class="fixed bottom-5 z-[1050] rounded-full shadow-lg"
            :style="positionStyle"
            @click="openQueryIP">
            <Search class="size-4" />
        </Button>
    </JnTooltip>

    <!-- 查询 Dialog -->
    <Dialog :open="isOpen" @update:open="onOpenChange">
        <DialogContent :title="t('ipcheck.Title')" class="max-w-xl">
            <DialogHeader :icon="Search" :title="t('ipcheck.Title')" />

            <div class="space-y-4">
                <!-- 输入 + 查询按钮（border-collapse 拼接） -->
                <div class="flex">
                    <Input type="text" id="inputIP" name="inputIP"
                        class="rounded-r-none"
                        :placeholder="t('ipcheck.Placeholder')"
                        v-model="inputIP" @keyup.enter="submitQuery" />
                    <Button id="sumitQueryButton" type="button"
                        class="rounded-l-none -ml-px shrink-0"
                        :disabled="!isValidIP(inputIP) || isChecking === 'running'"
                        @click="submitQuery">
                        {{ t('ipcheck.Button') }}
                    </Button>
                </div>

                <!-- 错误提示 -->
                <p v-if="modalQueryError" class="text-sm text-destructive">{{ modalQueryError }}</p>

                <!-- 查询结果（复用 IPCard 视觉语言） -->
                <div v-if="modalQueryResult" class="rounded-lg border bg-card overflow-hidden">
                    <!-- Hero IP 区 -->
                    <div class="px-4 py-3 flex items-center gap-2 min-w-0 border-b">
                        <Monitor class="size-5 text-muted-foreground shrink-0" />
                        <span class="font-mono font-semibold whitespace-nowrap truncate min-w-0"
                            :class="heroIpSizeClass(inputIP)" :title="inputIP">{{ inputIP }}</span>
                    </div>

                    <!-- 元数据 2 列 dl -->
                    <dl class="px-4 py-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <MapPin class="size-3.5" />
                                <span>{{ t('ipInfos.Country') }}</span>
                            </dt>
                            <dd class="font-normal flex items-center gap-1.5 flex-wrap">
                                <Icon v-if="modalQueryResult.country_code"
                                    :icon="'circle-flags:' + modalQueryResult.country_code.toLowerCase()"
                                    class="shrink-0 size-4" />
                                <span class="wrap-break-word">{{ modalQueryResult.country_name || '—' }}</span>
                            </dd>
                        </div>
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <House class="size-3.5" />
                                <span>{{ t('ipInfos.Region') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ modalQueryResult.region || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <CornerUpRight class="size-3.5" />
                                <span>{{ t('ipInfos.City') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ modalQueryResult.city || '—' }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <EthernetPort class="size-3.5" />
                                <span>{{ t('ipInfos.ISP') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ modalQueryResult.isp || '—' }}</dd>
                        </div>
                    </dl>

                    <!-- 高级数据（仅 IPCheck.ing 源）—— 完全跟 IPCard 规则一致 -->
                    <div v-show="showAdvancedBlock" class="px-4 py-3 border-t space-y-2.5">
                        <!-- 未登录态：Lock 提示 + 2×2 字段菜单 -->
                        <template v-if="allAdvancedLocked">
                            <div
                                class="w-full flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 text-muted-foreground">
                                <Lock class="size-3.5 shrink-0" />
                                <span class="truncate">{{ t('ipInfos.advancedUnlockCta') }}</span>
                            </div>
                            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div v-for="f in lockedFieldList" :key="f.key"
                                    class="flex items-center gap-1.5 text-muted-foreground">
                                    <component :is="f.icon" class="size-3.5 shrink-0" />
                                    <span class="text-xs truncate">{{ f.label }}</span>
                                    <span class="ml-auto text-muted-foreground/60">***</span>
                                </div>
                            </dl>
                        </template>

                        <!-- 已登录态：label + 纯文本值 -->
                        <dl v-else class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm items-center">
                            <template v-if="showType">
                                <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <SignalHigh class="size-3.5" />{{ t('ipInfos.type') }}
                                </dt>
                                <dd class="font-normal">{{ modalQueryResult.type }}</dd>
                            </template>

                            <template v-if="showProxy">
                                <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <ShieldCheck class="size-3.5" />{{ t('ipInfos.isProxy') }}
                                </dt>
                                <dd class="font-normal">
                                    {{ modalQueryResult.isProxy }}<span
                                        v-if="modalQueryResult.proxyProtocol && modalQueryResult.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')"
                                        class="text-muted-foreground font-normal"> · {{ modalQueryResult.proxyProtocol }}</span>
                                </dd>
                            </template>

                            <template v-if="showNative">
                                <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <House class="size-3.5" />{{ t('ipInfos.advancedData.Nativeness') }}
                                </dt>
                                <dd class="font-normal flex items-center gap-1">
                                    <component :is="modalQueryResult.isNativeIP === true ? CircleCheck : CircleX"
                                        class="size-3.5 text-muted-foreground" />
                                    {{ modalQueryResult.isNativeIP === true ? t('ipInfos.advancedData.NativeIPYes') : t('ipInfos.advancedData.NativeIPNo') }}
                                </dd>
                            </template>

                            <template v-if="showQualityScore">
                                <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <Gauge class="size-3.5" />{{ t('ipInfos.qualityScore') }}
                                </dt>
                                <dd>
                                    <span v-if="modalQueryResult.qualityScore === 'unknown'" class="text-sm text-muted-foreground">
                                        {{ t('ipInfos.qualityScoreUnknown') }}
                                    </span>
                                    <div v-else class="flex items-center gap-2">
                                        <Progress :model-value="Number(modalQueryResult.qualityScore) || 0"
                                            class="h-2 flex-1 min-w-12"
                                            :indicator-class="qualityTone === 'ok-fast' ? 'bg-success' : qualityTone === 'ok-slow' ? 'bg-warning' : 'bg-destructive'" />
                                        <span class="text-sm font-medium tabular-nums shrink-0">{{ modalQueryResult.qualityScore }}/100</span>
                                    </div>
                                </dd>
                            </template>
                        </dl>
                    </div>

                    <!-- ASN 行 -->
                    <div v-if="modalQueryResult.asn" class="px-4 py-3 border-t flex items-center gap-2 text-sm">
                        <Building2 class="size-4 text-muted-foreground shrink-0" />
                        <span class="text-xs text-muted-foreground shrink-0">{{ t('ipInfos.ASN') }}</span>
                        <a v-if="modalQueryResult.asnlink" :href="modalQueryResult.asnlink" target="_blank" rel="noopener"
                            class="font-mono font-medium truncate hover:underline">{{ modalQueryResult.asn }}</a>
                        <span v-else class="font-mono font-medium truncate">{{ modalQueryResult.asn }}</span>
                    </div>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// refactor/02：QueryIP 视觉完全对齐 IPCard
// - 模板用 DialogHeader primitive，不再手写 header
// - 结果面板复用 IPCard 的 hero IP + 2 列 dl + 高级数据 + ASN 结构
// - 高级数据 Type/Proxy/Native 纯文本不评判色，Quality Score 保留语义色
// - sign_in_required 走跟 IPCard 一样的 Lock CTA + 2×2 字段菜单
// - 国旗 .fi → circle-flags
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useMainStore } from '@/store';
import { isValidIP } from '@/utils/valid-ip.js';
import { transformDataFromIPapi } from '@/utils/transform-ip-data.js';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { authenticatedFetch } from '@/utils/authenticated-fetch';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Icon } from '@iconify/vue';
import {
    Building2,
    CircleCheck,
    CircleX,
    CornerUpRight,
    EthernetPort,
    Gauge,
    House,
    Lock,
    MapPin,
    Monitor,
    Search,
    ShieldCheck,
    SignalHigh,
} from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
const userPreferences = computed(() => store.userPreferences);
const lang = computed(() => store.lang);
const inputIP = ref('');
const modalQueryResult = ref(null);
const modalQueryError = ref('');
const isChecking = ref('idle');
const ipGeoSource = ref(userPreferences.value.ipGeoSource);

watch(() => userPreferences.value.ipGeoSource, (newVal) => {
    ipGeoSource.value = newVal;
}, { deep: true });

const submitQuery = async () => {
    if (isValidIP(inputIP.value)) {
        modalQueryError.value = '';
        modalQueryResult.value = null;
        isChecking.value = 'running';
        await fetchIPForModal(inputIP.value);
    } else {
        modalQueryError.value = t('ipcheck.Error');
        modalQueryResult.value = null;
        isChecking.value = 'idle';
    }
};

const isOpen = ref(false);
const onOpenChange = (val) => {
    isOpen.value = val;
    if (val) {
        nextTick(() => {
            const inputElement = document.getElementById('inputIP');
            if (inputElement) inputElement.focus();
        });
    }
};

const openQueryIP = () => {
    trackEvent('SideButtons', 'ToggleClick', 'QueryIP');
    openModal();
};

const openModal = () => onOpenChange(true);

const fetchIPForModal = async (ip, sourceID = null) => {
    let selectedLang = lang.value === 'zh' ? 'zh-CN' : lang.value;
    sourceID = ipGeoSource.value;
    const sources = store.ipDBs;

    for (const source of sources) {
        if (sourceID && source.id !== sourceID) continue;
        try {
            const url = store.getDbUrl(source.id, ip, selectedLang);
            const response = await authenticatedFetch(url);
            modalQueryResult.value = transformDataFromIPapi(response, source.id, t, lang.value);
            isChecking.value = 'idle';
            break;
        } catch (error) {
            console.error('Error fetching IP details:', error);
        }
    }
};

// ——— Hero IP 字号降级（跟 IPCard 一套逻辑） ———
const heroIpSizeClass = (ip) => {
    const len = typeof ip === 'string' ? ip.length : 0;
    if (len <= 15) return 'text-2xl';
    if (len <= 26) return 'text-xl';
    return 'text-base';
};

// ——— 高级数据展示条件（跟 IPCard 一致） ———
const result = computed(() => modalQueryResult.value || {});
const showAdvancedBlock = computed(() => ipGeoSource.value === 0 && modalQueryResult.value);
const allAdvancedLocked = computed(() =>
    result.value.type === 'sign_in_required' &&
    result.value.isProxy === 'sign_in_required' &&
    result.value.isNativeIP === 'sign_in_required' &&
    result.value.qualityScore === 'sign_in_required'
);
const showType = computed(() =>
    result.value.type && result.value.type !== 'sign_in_required'
    && result.value.type !== t('ipInfos.advancedData.type.unknownType')
);
const showProxy = computed(() =>
    result.value.isProxy && result.value.isProxy !== 'sign_in_required'
    && result.value.isProxy !== t('ipInfos.advancedData.proxyUnknown')
);
const showNative = computed(() =>
    result.value.isNativeIP !== undefined && result.value.isNativeIP !== 'sign_in_required'
);
const showQualityScore = computed(() =>
    result.value.qualityScore !== undefined && result.value.qualityScore !== 'sign_in_required'
);

// 未登录的字段菜单
const lockedFieldList = computed(() => [
    { key: 'type',    icon: SignalHigh,  label: t('ipInfos.type') },
    { key: 'proxy',   icon: ShieldCheck, label: t('ipInfos.isProxy') },
    { key: 'native',  icon: House,       label: t('ipInfos.advancedData.Nativeness') },
    { key: 'quality', icon: Gauge,       label: t('ipInfos.qualityScore') },
]);

// Quality Score tone
const qualityTone = computed(() => {
    const n = Number(result.value.qualityScore);
    if (isNaN(n)) return 'wait';
    if (n >= 80) return 'ok-fast';
    if (n >= 50) return 'ok-slow';
    return 'fail';
});

// ——— 悬浮按钮定位（超宽屏时对齐到内容区右侧） ———
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 20}px` };
    }
    return { right: '20px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };
onMounted(() => window.addEventListener('resize', handleResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleResize));

defineExpose({ openModal });
</script>
