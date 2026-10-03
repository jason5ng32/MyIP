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

            <!-- Full profile: a real link to the standalone page (new tab on
                 modifier clicks); a plain click opens the drawer instead -->
            <div v-if="profileHref" class="pt-1">
                <Button as-child variant="outline" size="sm" class="h-7 cursor-pointer gap-1.5 text-xs">
                    <a :href="profileHref" @click="openProfile">
                        <PanelBottomOpen class="size-3.5" />{{ t('ipInfos.ASNInfo.openProfile') }}
                    </a>
                </Button>
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
import { useRouter } from 'vue-router';
import { trackEvent } from '@/utils/analytics';
import { parseAsnInput } from '@/utils/asn-input.js';
import { isToolAvailable } from '@/utils/tool-availability.js';
import { TOOL_BY_SLUG } from '@/data/tools.js';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/vue';
import { PanelBottomOpen } from '@lucide/vue';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);

const placeholderSizes = [12, 8, 6, 8, 4];

const props = defineProps({
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    asn: { type: String, required: true },
    asnInfos: { type: Object, required: true }
});

// Fired before a plain-click open, so a host dialog (QueryIP) can close
// first instead of stacking under the drawer.
const emit = defineEmits(['open-profile']);

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

// ASN Profile entry: hidden when the tool is gated off (no Cloudflare key)
// or the ASN doesn't parse. Opens like an Advanced Tools card: the `?tool=`
// drawer, with `q` making the tool run the lookup on mount.
const router = useRouter();
const profileAsn = computed(() => {
    if (!isToolAvailable(TOOL_BY_SLUG.get('asn'), store.configs)) return null;
    const asn = parseAsnInput(props.asn);
    return asn === null ? null : `AS${asn}`;
});
const profileHref = computed(() => (profileAsn.value ? `/tools/asn?q=${profileAsn.value}` : ''));

const openProfile = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    trackEvent('IPCheck', 'ASNProfileClick', 'Open ASN Profile');
    emit('open-profile');
    router.push({ path: '/', query: { tool: 'asn', q: profileAsn.value } });
};
</script>
