<template>
    <!-- ASN Info Panel: embedded in IPCard's Collapsible to expand -->
    <div class="rounded-md border bg-muted/40 text-sm">
        <!-- Top note -->
        <div class="px-3 pt-3 pb-2 flex items-start gap-2 text-xs text-muted-foreground">
            <span>{{ t('ipInfos.ASNInfo.note') }}</span>
        </div>

        <div v-if="asnInfos[asn]" class="px-3 pb-3 space-y-3">
            <!-- Basic information: compact dl two columns -->
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

            <!-- Connection quality (Cloudflare speed test aggregates) -->
            <AsnConnectionQuality :info="asnInfos[asn]" />

            <!-- Traffic shares (pair bars) -->
            <AsnTrafficShares :info="asnInfos[asn]" />

            <!-- External links -->
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

        <!-- Loading state skeleton -->
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
import getCountryName from '@/data/country-name.js';
import AsnConnectionQuality from './AsnConnectionQuality.vue';
import AsnTrafficShares from './AsnTrafficShares.vue';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@iconify/vue';
import { Database, ExternalLink } from '@lucide/vue';

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

// Extract basic information (non-pair data)
const basicInfo = computed(() => {
    const data = props.asnInfos[props.asn];
    if (!data) return {};
    const info = {};
    const keys = [
        'asnName', 'asnCountryCode', 'asnOrgName', 'estimatedUsers',
        'prefixesV4', 'prefixesV6', 'upstreamCount', 'downstreamCount', 'peerCount',
    ];
    for (const key of keys) {
        if (data[key]) info[key] = data[key];
    }
    return info;
});
</script>
