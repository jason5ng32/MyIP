<template>
    <!-- ASN 信息面板：嵌入在 IPCard 的 Collapsible 里展开 -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <!-- 顶部说明 -->
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Info class="size-3.5 mt-[0.15em] shrink-0" />
            <span>{{ t('ipInfos.ASNInfo.note') }}</span>
        </div>

        <div v-if="asnInfos[asn]" class="px-3 pb-3 space-y-3">
            <!-- 基本信息：紧凑的 dl 两列 -->
            <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div v-for="(item, key) in basicInfo" :key="key" :class="{ 'col-span-2': key === 'asnOrgName' }">
                    <dt class="text-xs text-muted-foreground mb-0.5">{{ t(`ipInfos.ASNInfo.${key}`) }}</dt>
                    <dd class="font-normal flex items-center gap-1.5 wrap-break-word">
                        <template v-if="key === 'asnCountryCode'">
                            <Icon v-if="item" :icon="'circle-flags:' + item.toLowerCase()" class="shrink-0 size-4" />
                            <span>{{ getCountryName(item, lang) }}</span>
                        </template>
                        <template v-else>{{ item }}</template>
                    </dd>
                </div>
            </dl>

            <!-- 成对数据可视化 -->
            <div v-if="pairDataList.length" class="space-y-2.5 pt-1">
                <div class="text-xs text-muted-foreground">
                    {{ t('ipInfos.ASNInfo.trafficPercentage') }}
                </div>
                <DataPairBar v-for="pair in pairDataList" :key="pair.leftLabel" :leftLabel="pair.leftLabel"
                    :leftValue="pair.leftValue" :rightLabel="pair.rightLabel" :rightValue="pair.rightValue" />
            </div>

            <!-- 外部链接 -->
            <div class="flex flex-wrap items-center gap-2 pt-1">
                <span class="text-xs text-muted-foreground">{{ t('ipInfos.ASNInfo.moreData') }}</span>
                <a class="inline-flex" :href="`https://bgp.tools/as/${removeASPrefix(asn)}`" target="_blank"
                    rel="noopener" title="BGP.Tools">
                    <Badge variant="outline" class="gap-1 hover:bg-muted cursor-pointer">
                        <Database class="size-3" /> BGPTools
                        <ExternalLink class="size-3 opacity-60" />
                    </Badge>
                </a>
                <a class="inline-flex" :href="`https://radar.cloudflare.com/${asn}`" target="_blank" rel="noopener"
                    title="Cloudflare Radar">
                    <Badge variant="outline" class="gap-1 hover:bg-muted cursor-pointer">
                        <Database class="size-3" /> CF Radar
                        <ExternalLink class="size-3 opacity-60" />
                    </Badge>
                </a>
            </div>
        </div>

        <!-- 加载态 skeleton -->
        <div v-else class="px-3 pb-3 space-y-2">
            <div v-for="(w, i) in placeholderSizes" :key="i" class="h-3.5 bg-muted rounded animate-pulse"
                :style="`width: ${(w / 12) * 100}%`"></div>
        </div>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { computed } from 'vue';
import getCountryName from '@/utils/country-name.js';
import DataPairBar from './DataPairBar.vue';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@iconify/vue';
import { Database, ExternalLink, Info } from 'lucide-vue-next';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);

const placeholderSizes = [12, 8, 6, 8, 4];

const removeASPrefix = (asn) => asn.replace('AS', '');

const props = defineProps({
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    asn: { type: String, required: true },
    asnInfos: { type: Object, required: true }
});

// 提取基本信息(非成对数据)
const basicInfo = computed(() => {
    const data = props.asnInfos[props.asn];
    if (!data) return {};
    const { asnName, asnCountryCode, asnOrgName, estimatedUsers } = data;
    const info = {};
    if (asnName) info.asnName = asnName;
    if (asnCountryCode) info.asnCountryCode = asnCountryCode;
    if (asnOrgName) info.asnOrgName = asnOrgName;
    if (estimatedUsers) info.estimatedUsers = estimatedUsers;
    return info;
});

// 处理成对数据
const pairData = computed(() => {
    const data = props.asnInfos[props.asn];
    if (!data) return {};

    const parsePercentage = (str) => {
        if (!str) return null;
        const num = parseFloat(str.replace('%', ''));
        return isNaN(num) ? null : parseFloat(num.toFixed(2));
    };

    const pairs = {};

    const ipv4 = parsePercentage(data.IPv4_Pct);
    const ipv6 = parsePercentage(data.IPv6_Pct);
    if (ipv4 !== null && ipv6 !== null) pairs.ipVersion = { left: ipv4, right: ipv6 };

    const http = parsePercentage(data.HTTP_Pct);
    const https = parsePercentage(data.HTTPS_Pct);
    if (http !== null && https !== null) pairs.httpProtocol = { left: http, right: https };

    const desktop = parsePercentage(data.Desktop_Pct);
    const mobile = parsePercentage(data.Mobile_Pct);
    if (desktop !== null && mobile !== null) pairs.deviceType = { left: desktop, right: mobile };

    const human = parsePercentage(data.Human_Pct);
    const bot = parsePercentage(data.Bot_Pct);
    if (human !== null && bot !== null) pairs.userType = { left: human, right: bot };

    return pairs;
});

const pairDataList = computed(() => {
    const list = [
        { key: 'ipVersion', leftLabel: 'IPv4_Pct', rightLabel: 'IPv6_Pct' },
        { key: 'httpProtocol', leftLabel: 'HTTP_Pct', rightLabel: 'HTTPS_Pct' },
        { key: 'deviceType', leftLabel: 'Desktop_Pct', rightLabel: 'Mobile_Pct' },
        { key: 'userType', leftLabel: 'Human_Pct', rightLabel: 'Bot_Pct' }
    ];
    return list
        .filter(item => pairData.value[item.key])
        .map(item => ({
            leftLabel: item.leftLabel,
            rightLabel: item.rightLabel,
            leftValue: pairData.value[item.key].left,
            rightValue: pairData.value[item.key].right
        }));
});
</script>
