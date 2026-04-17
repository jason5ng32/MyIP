<template>
    <!-- IP 信息卡 — shadcn Card 架构，三个可能的主体：正常 / 错误 / 加载 -->
    <Card
        class="keyboard-shortcut-card jn-card flex flex-col h-full overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <!-- 卡头：数字徽章 + 来源 + 刷新 -->
        <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/50 border-b">
            <div class="flex items-center gap-2 min-w-0">
                <span
                    class="inline-flex items-center justify-center size-5 rounded-full bg-foreground text-background text-xs font-semibold shrink-0">
                    {{ index + 1 }}
                </span>
                <span class="text-sm font-medium truncate">
                    <span class="text-muted-foreground">{{ t('ipInfos.Source') }}:</span>
                    {{ card.source }}
                </span>
            </div>
            <JnTooltip :text="t('Tooltips.RefreshIPCard')" side="left">
                <Button size="icon" variant="outline" class="size-8 shrink-0 cursor-pointer"
                    @click="$emit('refresh-card', card, index)" :aria-label="'Refresh ' + card.source">
                    <RotateCw class="size-4" />
                </Button>
            </JnTooltip>
        </div>

        <!-- 主体分三态：正常 / 错误 / 加载 -->
        <div class="flex-1 flex flex-col">
            <!-- 正常态：IP + 可选 Map + 元数据 + (IPCheck.ing 源独有的) 高级数据 + ASN -->
            <template v-if="hasData">
                <!-- Hero IP 区 -->
                <div class="px-4 py-3 flex items-center gap-2 min-w-0">
                    <Monitor class="size-5 text-muted-foreground shrink-0" />
                    <span class="font-mono font-semibold whitespace-nowrap truncate min-w-0"
                        :class="heroIpSizeClass(card.ip)" :title="card.ip">{{ card.ip }}</span>
                    <JnTooltip v-if="isValidIP(card.ip)" :text="t('Tooltips.CopyIP')" side="left">
                        <button type="button"
                            class="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            @click="copyToClipboard(card.ip, card.id)" :aria-label="'Copy ' + card.ip">
                            <component :is="copiedStatus[card.id] ? ClipboardCheck : ClipboardPlus" class="size-4" />
                        </button>
                    </JnTooltip>
                </div>

                <!-- Map（用户 preference 控制） -->
                <div v-if="isMapShown && card.country_name"
                    class="mx-4 mb-3 rounded-md overflow-hidden border bg-muted">
                    <img :src="isDarkMode ? card.mapUrl_dark : card.mapUrl" class="w-full aspect-2/1 object-cover"
                        alt="Map">
                </div>

                <!-- 元数据网格：Country / Region / City / ISP -->
                <dl v-if="card.country_name" class="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-3 text-sm"
                    :class="{ 'grid-cols-1!': isMobile && isCardsCollapsed }">
                    <div>
                        <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                            <MapPin class="size-3.5" />
                            <span>{{ t('ipInfos.Country') }}</span>
                        </dt>
                        <dd class="font-normal flex items-center gap-1.5 flex-wrap">
                            <Icon v-if="card.country_code" :icon="'circle-flags:' + card.country_code.toLowerCase()"
                                class="shrink-0 size-4" />
                            <span class="wrap-break-word">{{ card.country_name }}</span>
                        </dd>
                    </div>

                    <!-- 非 collapsed 模式下显示其它元数据 -->
                    <template v-if="!isMobile || !isCardsCollapsed">
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <House class="size-3.5" />
                                <span>{{ t('ipInfos.Region') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ card.region || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <CornerUpRight class="size-3.5" />
                                <span>{{ t('ipInfos.City') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ card.city || '—' }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                <EthernetPort class="size-3.5" />
                                <span>{{ t('ipInfos.ISP') }}</span>
                            </dt>
                            <dd class="font-normal wrap-break-word">{{ card.isp || '—' }}</dd>
                        </div>
                    </template>
                </dl>

                <!-- 高级数据块（仅 IPCheck.ing 源展示）：
                    - 已登录：纯文本值，不对"是否代理/是否原生"做颜色评判；只有质量分保留语义色
                    - 未登录：4 个字段压成 2×2 紧凑网格 + 单行 CTA 提示免费登录即可解锁 -->
                <div v-if="!isMobile || !isCardsCollapsed" v-show="showAdvancedBlock"
                    class="px-4 pb-3 border-t pt-3 space-y-2.5">

                    <!-- 未登录态 ———————————————————————————————————— -->
                    <template v-if="allAdvancedLocked">
                        <!-- CTA：单行 + Sign In 按钮；点击打开 Benefits 弹窗集中展示好处和登录入口 -->
                        <span
                            class="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 text-muted-foreground transition-colors group">
                            <span class="flex items-center gap-1.5 min-w-0">
                                <Lock class="size-3.5 shrink-0" />
                                <span class="truncate">{{ t('ipInfos.advancedUnlockCta') }}</span>
                            </span>
                        </span>

                        <!-- 2×2 紧凑字段菜单：纯预览，让用户知道登录后能看到什么 -->
                        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            <div v-for="f in lockedFieldList" :key="f.key"
                                class="flex items-center gap-1.5 text-muted-foreground">
                                <component :is="f.icon" class="size-3.5 shrink-0" />
                                <span class="text-xs truncate">{{ f.label }}</span>
                                <span class="ml-auto text-muted-foreground/60">***</span>
                            </div>
                        </dl>
                    </template>

                    <!-- 已登录态 ———————————————————————————————————— -->
                    <!-- 纯文本值排版：label 在前，值在后，不做颜色评判（只有 Quality 保留进度条语义色） -->
                    <dl v-else class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm items-center">
                        <template v-if="showTypeBadge">
                            <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                <SignalHigh class="size-3.5" />{{ t('ipInfos.type') }}
                            </dt>
                            <dd class="font-normal">{{ card.type }}</dd>
                        </template>

                        <template v-if="showProxyBadge">
                            <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                <ShieldCheck class="size-3.5" />{{ t('ipInfos.isProxy') }}
                            </dt>
                            <dd class="font-normal">
                                {{ card.isProxy }}<span
                                    v-if="card.proxyProtocol && card.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')"
                                    class="text-muted-foreground font-normal"> · {{ card.proxyProtocol }}</span>
                            </dd>
                        </template>

                        <template v-if="showNativeBadge">
                            <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                <House class="size-3.5" />{{ t('ipInfos.advancedData.Nativeness') }}
                            </dt>
                            <dd class="font-normal flex items-center gap-1">
                                <component :is="card.isNativeIP === true ? CircleCheck : CircleX"
                                    class="size-3.5 text-muted-foreground" />
                                {{ card.isNativeIP === true ? t('ipInfos.advancedData.NativeIPYes') :
                                t('ipInfos.advancedData.NativeIPNo') }}
                            </dd>
                        </template>

                        <template v-if="showQualityScore">
                            <dt class="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Gauge class="size-3.5" />{{ t('ipInfos.qualityScore') }}
                            </dt>
                            <dd>
                                <span v-if="card.qualityScore === 'unknown'" class="text-sm text-muted-foreground">
                                    {{ t('ipInfos.qualityScoreUnknown') }}
                                </span>
                                <div v-else class="flex items-center gap-2">
                                    <Progress :model-value="Number(card.qualityScore) || 0" class="h-2 flex-1 min-w-12"
                                        :indicator-class="qualityTone === 'ok-fast' ? 'bg-success' : qualityTone === 'ok-slow' ? 'bg-warning' : 'bg-destructive'" />
                                    <span class="text-sm font-normal tabular-nums shrink-0">{{ card.qualityScore
                                        }}/100</span>
                                </div>
                            </dd>
                        </template>
                    </dl>
                </div>

                <!-- ASN 行 + 展开 -->
                <div v-if="card.asn && (!isMobile || !isCardsCollapsed)" class="px-4 py-3 border-t mt-auto">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0 text-sm">
                            <Building2 class="size-4 text-muted-foreground shrink-0" />
                            <span class="text-xs text-muted-foreground shrink-0">{{ t('ipInfos.ASN') }}</span>
                            <span class="font-mono font-normal truncate">{{ card.asn }}</span>
                        </div>
                        <JnTooltip v-if="card.asnlink && configs.cloudFlare" :text="t('Tooltips.ShowASNInfo')"
                            side="left">
                            <button type="button"
                                class="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                @click="toggleASNCollapse(card.asn)" :aria-expanded="isAsnOpen"
                                :aria-label="'Display AS Info of ' + card.asn">
                                <component :is="isAsnOpen ? ChevronUp : ChevronDown" class="size-4" />
                            </button>
                        </JnTooltip>
                    </div>
                    <Collapsible :open="isAsnOpen" @update:open="isAsnOpen = $event">
                        <CollapsibleContent class="pt-3">
                            <ASNInfo :index="index" :isDarkMode="isDarkMode" :asn="card.asn" :asnInfos="asnInfos" />
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </template>

            <!-- 错误态 -->
            <div v-else-if="isErrorState"
                class="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                <IPErrorIcon />
                <p class="text-sm text-destructive font-medium">{{ card.ip }}</p>
            </div>

            <!-- 加载态：skeleton rows -->
            <div v-else class="flex-1 px-4 py-3 space-y-3">
                <div v-for="(w, i) in placeholderSizes" :key="i" class="h-4 bg-muted rounded animate-pulse"
                    :style="`width: ${(w / 12) * 100}%`"></div>
            </div>
        </div>
    </Card>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import ASNInfo from './ASNInfo.vue';
import IPErrorIcon from '../svgicons/IPError.vue';
import { trackEvent } from '@/utils/use-analytics';
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Icon } from '@iconify/vue';
import {
    Building2,
    ChevronDown,
    ChevronUp,
    CircleCheck,
    CircleHelp,
    CircleX,
    ClipboardCheck,
    ClipboardPlus,
    CornerUpRight,
    EthernetPort,
    Gauge,
    House,
    Lock,
    MapPin,
    Monitor,
    RotateCw,
    ShieldCheck,
    SignalHigh,
} from 'lucide-vue-next';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];
const isAsnOpen = ref(false);

const props = defineProps({
    card: { type: Object, required: true },
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    ipGeoSource: { type: Number, required: true },
    isMapShown: { type: Boolean, required: true },
    isCardsCollapsed: { type: Boolean, required: true },
    copiedStatus: { type: Object, required: true },
    configs: { type: Object, required: true },
    asnInfos: { type: Object, required: true }
});

const emit = defineEmits(['refresh-card', 'get-asn-info']);

// 三态判定：有数据（正常）/ 错误 / 加载
// 原版是 `(card.asn) || card.ip === '2001:4860:4860::8888'`，后者是 masked-info 在 signed-out 时兜底的假 IP
const hasData = computed(() =>
    Boolean(props.card.asn) || props.card.ip === '2001:4860:4860::8888'
);
const isErrorState = computed(() =>
    props.card.ip === t('ipInfos.IPv4Error') || props.card.ip === t('ipInfos.IPv6Error')
);

// Hero IP 字号降级：hero 区字号比 WebRTC/DnsLeak 里的 IP 行大一档
// ≤15 (IPv4) → 2xl；16-26 (压缩 IPv6) → xl；>26 (完整 IPv6) → base
const heroIpSizeClass = (ip) => {
    const len = typeof ip === 'string' ? ip.length : 0;
    if (len <= 15) return 'text-2xl';
    if (len <= 26) return 'text-xl';
    return 'text-sm';
};

// 高级数据块显示条件：仅 IPCheck.ing 源（ipGeoSource === 0）
const showAdvancedBlock = computed(() => props.ipGeoSource === 0 && hasData.value);

// 所有高级字段都 sign_in_required → 只显示一条登录提示，比原先"每行都挂 Sign In"简洁很多
const allAdvancedLocked = computed(() =>
    props.card.type === 'sign_in_required' &&
    props.card.isProxy === 'sign_in_required' &&
    props.card.isNativeIP === 'sign_in_required' &&
    props.card.qualityScore === 'sign_in_required'
);

// 单个 Badge 显示条件
const showTypeBadge = computed(() =>
    props.card.type && props.card.type !== 'sign_in_required'
    && props.card.type !== t('ipInfos.advancedData.type.unknownType')
);
const showProxyBadge = computed(() =>
    props.card.isProxy && props.card.isProxy !== 'sign_in_required'
    && props.card.isProxy !== t('ipInfos.advancedData.proxyUnknown')
);
const showNativeBadge = computed(() =>
    props.card.isNativeIP !== undefined && props.card.isNativeIP !== 'sign_in_required'
);

// 未登录态的 4 字段菜单：让用户看到登录能解锁的是哪些字段
// 用 shallow-ref 风格的纯对象数组（lucide 组件直接作为值），循环渲染
const lockedFieldList = computed(() => [
    { key: 'type', icon: SignalHigh, label: t('ipInfos.type') },
    { key: 'proxy', icon: ShieldCheck, label: t('ipInfos.isProxy') },
    { key: 'native', icon: House, label: t('ipInfos.advancedData.Nativeness') },
    { key: 'quality', icon: Gauge, label: t('ipInfos.qualityScore') },
]);

// Quality Score：≥80 ok-fast；50-80 ok-slow；<50 fail —— 复用已有 4 档 tone 语义
const qualityTone = computed(() => {
    const n = Number(props.card.qualityScore);
    if (isNaN(n)) return 'wait';
    if (n >= 80) return 'ok-fast';
    if (n >= 50) return 'ok-slow';
    return 'fail';
});
const showQualityScore = computed(() =>
    props.card.qualityScore !== undefined && props.card.qualityScore !== 'sign_in_required'
);

const copyToClipboard = (ip, id) => {
    navigator.clipboard.writeText(ip).then(() => {
        props.copiedStatus[id] = true;
        setTimeout(() => { props.copiedStatus[id] = false; }, 5000);
    }).catch(err => {
        console.error('Copy error', err);
    });
};

const toggleASNCollapse = async (asn) => {
    isAsnOpen.value = !isAsnOpen.value;
    if (isAsnOpen.value) {
        await getASNInfo(asn);
    }
};

const getASNInfo = async (asn) => {
    trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
    try {
        if (props.asnInfos[asn]) return;
        asn = asn.replace('AS', '');
        const response = await fetch(`/api/cfradar?asn=${asn}`);
        const data = await response.json();
        props.asnInfos['AS' + asn] = data;
    } catch (error) {
        console.error('Error fetching ASN info:', error);
    }
};
</script>
