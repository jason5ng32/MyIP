<template>
    <!-- refactor/01：原 .collapse 类已移除，展开收起由父级 CollapsibleContent 控制 -->
    <div class="rounded-md border bg-neutral-50 border-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 leading-relaxed font-bold p-0">
        <div class="p-3">
            <span v-if="asnInfos[asn]">
                <i class="bi bi-info-circle-fill"></i>
                <span class="font-light">&nbsp;{{ t('ipInfos.ASNInfo.note') }}</span>
                <br />

                <!-- 基本信息 -->
                <template v-for="(item, key) in basicInfo" :key="key">
                    <span class="font-light">
                        {{ t(`ipInfos.ASNInfo.${key}`) }}
                    </span>
                    <span v-if="key === 'asnCountryCode'">
                        {{ getCountryName(item, lang) }}
                        <span :class="'jn-fl fi fi-' + item.toLowerCase()"></span>
                    </span>
                    <span v-else>
                        {{ item }}
                    </span>
                    <br />
                </template>

                <!-- 成对数据可视化 -->
                <div class="data-pairs-section">
                    <label class="font-light">{{ t('ipInfos.ASNInfo.trafficPercentage') }}</label>
                    <DataPairBar v-for="pair in pairDataList" :key="pair.leftLabel" :leftLabel="pair.leftLabel"
                        :leftValue="pair.leftValue" :rightLabel="pair.rightLabel" :rightValue="pair.rightValue"
                        :isDarkMode="isDarkMode" />
                </div>

                <div class="font-light flex mt-3">
                    <span class="font-light">{{ t('ipInfos.ASNInfo.moreData') }}</span>
                    <span>
                        <a class="no-underline px-2" :href="`https://bgp.tools/as/${removeASPrefix(asn)}`"
                            target="_blank" title="BGP.Tools">
                            <Badge :class="!isDarkMode ? 'bg-neutral-900 text-white border-transparent' : 'bg-neutral-100 text-neutral-900 border-transparent'">
                                <i class="bi bi-database-fill"></i>&nbsp;BGPTools
                            </Badge>
                        </a>
                    </span>
                    <span>
                        <a class="no-underline" :href="`https://radar.cloudflare.com/${asn}`" target="_blank"
                            title="Cloudflare Radar">
                            <Badge :class="!isDarkMode ? 'bg-neutral-900 text-white border-transparent' : 'bg-neutral-100 text-neutral-900 border-transparent'">
                                <i class="bi bi-database-fill"></i>&nbsp;CF Radar
                            </Badge>
                        </a>
                    </span>
                </div>
            </span>
            <span v-else class="animate-pulse">
                <span v-for="(colSize, index) in placeholderSizes" :key="index" class="block my-2"
                    :style="`width: ${(colSize / 12) * 100}%; height: 1em; background-color: currentColor; opacity: 0.2; border-radius: 4px;`">
                </span>
            </span>
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

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);

const placeholderSizes = [12, 8, 6, 8, 4];

const removeASPrefix = (asn) => {
    return asn.replace('AS', '');
}

const props = defineProps({
    index: {
        type: Number,
        required: true
    },
    isDarkMode: {
        type: Boolean,
        required: true
    },
    asn: {
        type: String,
        required: true
    },
    asnInfos: {
        type: Object,
        required: true
    }
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

    // IPv4 vs IPv6
    const ipv4 = parsePercentage(data.IPv4_Pct);
    const ipv6 = parsePercentage(data.IPv6_Pct);
    if (ipv4 !== null && ipv6 !== null) {
        pairs.ipVersion = { left: ipv4, right: ipv6 };
    }

    // HTTP vs HTTPS
    const http = parsePercentage(data.HTTP_Pct);
    const https = parsePercentage(data.HTTPS_Pct);
    if (http !== null && https !== null) {
        pairs.httpProtocol = { left: http, right: https };
    }

    // Desktop vs Mobile
    const desktop = parsePercentage(data.Desktop_Pct);
    const mobile = parsePercentage(data.Mobile_Pct);
    if (desktop !== null && mobile !== null) {
        pairs.deviceType = { left: desktop, right: mobile };
    }

    // Human vs Bot
    const human = parsePercentage(data.Human_Pct);
    const bot = parsePercentage(data.Bot_Pct);
    if (human !== null && bot !== null) {
        pairs.userType = { left: human, right: bot };
    }

    return pairs;
});

// 将成对数据转换为列表，用于循环渲染
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