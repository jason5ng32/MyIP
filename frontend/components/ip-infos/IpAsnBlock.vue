<!-- ASN block: the ASN row with its Info / History / Connectivity toggles over one single-select
     Collapsible. One of IpDetailPanel's root siblings; the caches are the consumer's, passed down. -->
<template>
    <div v-if="data.asn && !collapsed" class="px-4 py-3 border-t">
        <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 text-sm">
                <Building2 class="size-4 text-muted-foreground shrink-0" />
                <span class="text-xs text-muted-foreground shrink-0">{{ t('ipInfos.ASN') }}</span>
                <span class="font-mono font-normal truncate">{{ data.asn }}</span>
            </div>
            <div class="shrink-0 flex items-center gap-1">
                <!-- ASN Info -->
                <JnTooltip v-if="data.asnlink && configs.cloudFlare" :text="t('Tooltips.ShowASNInfo')" side="top">
                    <Button variant="ghost" size="icon"
                        :class="['size-7 cursor-pointer', isPanelActive('info') && 'bg-muted text-foreground hover:bg-muted']"
                        @click="togglePanel('info')" :aria-expanded="isPanelActive('info')"
                        :aria-label="'Display AS Info of ' + data.asn">
                        <Info />
                    </Button>
                </JnTooltip>
                <!-- ASN History -->
                <JnTooltip v-if="ipPrefix" :text="t('Tooltips.ShowASNHistory')" side="top">
                    <Button variant="ghost" size="icon"
                        :class="['size-7 cursor-pointer', isPanelActive('history') && 'bg-muted text-foreground hover:bg-muted']"
                        @click="togglePanel('history')" :aria-expanded="isPanelActive('history')"
                        :aria-label="'Display ASN History of ' + data.ip">
                        <FolderClock />
                    </Button>
                </JnTooltip>
                <!-- ASN Connectivity -->
                <JnTooltip v-if="asnNumeric" :text="t('Tooltips.ShowASNConnectivity')" side="top">
                    <Button variant="ghost" size="icon"
                        :class="['size-7 cursor-pointer', isPanelActive('connectivity') && 'bg-muted text-foreground hover:bg-muted']"
                        @click="togglePanel('connectivity')" :aria-expanded="isPanelActive('connectivity')"
                        :aria-label="'Display ASN Connectivity of ' + data.asn">
                        <Network />
                    </Button>
                </JnTooltip>
            </div>
        </div>
        <Collapsible :open="isPanelOpen" @update:open="onPanelOpenChange">
            <CollapsibleContent>
                <div class="pt-3">
                    <ASNInfo v-if="activePanel === 'info'" :index="index" :isDarkMode="isDarkMode" :asn="data.asn"
                        :asnInfos="asnInfos" @open-profile="emit('open-tool')" />
                    <ASNHistory v-else-if="activePanel === 'history'" :prefix="ipPrefix"
                        :asnHistoryInfos="asnHistoryInfos" />
                    <ASNConnectivity v-else-if="activePanel === 'connectivity'" :asn="asnNumeric"
                        :asnConnectivityInfos="asnConnectivityInfos" />
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>
</template>

<script setup>
import { ref, computed, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { loadAsnInfoInto } from '@/composables/use-asn-info.js';
import { loadAsnHistoryInto } from '@/utils/ip/asn-history.js';
import { loadAsnConnectivityInto } from '@/utils/ip/asn-connectivity.js';
import { toBgpPrefix } from '@/utils/ip/bgp-prefix.js';
import ASNInfo from './ASNInfo.vue';
import ASNHistory from './ASNHistory.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Building2, FolderClock, Info, Network } from '@lucide/vue';

// ASNConnectivity is heavy (dagre + SVG render); async-import so it
// only enters the bundle when a user opens the Connectivity panel.
const ASNConnectivity = defineAsyncComponent(() => import('./ASNConnectivity.vue'));

const { t } = useI18n();

const props = defineProps({
    data: { type: Object, required: true },
    asnInfos: { type: Object, required: true },
    asnHistoryInfos: { type: Object, default: () => ({}) },
    asnConnectivityInfos: { type: Object, default: () => ({}) },
    configs: { type: Object, required: true },
    isDarkMode: { type: Boolean, required: true },
    index: { type: Number, default: 0 },
    collapsed: { type: Boolean, default: false },
});

// ASNInfo's ASN Profile link; re-emitted by IpDetailPanel to its consumer.
const emit = defineEmits(['open-tool']);

// Single-select panel content: 'info' | 'history' | 'connectivity' | null.
// Kept separate from the open state so close animations retain their content
// until Collapsible finishes measuring and animating the closing height.
const activePanel = ref(null);
const isPanelOpen = ref(false);

// BGP DFZ-floor prefix for the IP — /24 v4, /48 v6. Used both as the query
// param sent to /api/asn-history (so CF dedupes across every IP in the same
// prefix) and as the local session-cache key.
const ipPrefix = computed(() => toBgpPrefix(props.data.ip));

// Numeric ASN (no 'AS' prefix), used as the connectivity cache key and the
// /api/asn-connectivity query param. Null when the geo source didn't return
// an ASN.
const asnNumeric = computed(() => {
    const raw = props.data.asn;
    if (!raw) return null;
    const m = String(raw).match(/^AS?(\d+)$/i);
    return m ? m[1] : null;
});

// Toggle the panel for `name`. Clicking the already-active button collapses
// the panel entirely; clicking the inactive one switches view and lazily
// triggers its data fetch. Session caches (asnInfos / asnHistoryInfos) make
// the switch instant on the second visit.
const togglePanel = async (name) => {
    if (isPanelOpen.value && activePanel.value === name) {
        isPanelOpen.value = false;
        return;
    }
    activePanel.value = name;
    isPanelOpen.value = true;
    if (name === 'info') {
        await getASNInfo(props.data.asn);
    } else if (name === 'history' && ipPrefix.value) {
        await getASNHistory(ipPrefix.value);
    } else if (name === 'connectivity' && asnNumeric.value) {
        await getASNConnectivity(asnNumeric.value);
    }
};

const isPanelActive = (name) => isPanelOpen.value && activePanel.value === name;

// Collapsible's controlled mode can emit open-state updates from its internals;
// mirror those without clearing the selected content before the close animation.
const onPanelOpenChange = (open) => {
    isPanelOpen.value = open;
};

// Fetch + caching live in the loaders; each cache is the owner's (IpInfos /
// QueryIP), handed down as a prop.
const getASNInfo = async (asn) => {
    trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
    await loadAsnInfoInto(props.asnInfos, asn);
};

const getASNHistory = async (prefix) => {
    trackEvent('IPCheck', 'ASNHistoryClick', 'Show ASN History');
    await loadAsnHistoryInto(props.asnHistoryInfos, prefix);
};

const getASNConnectivity = async (asn) => {
    trackEvent('IPCheck', 'ASNConnectivityClick', 'Show ASN Connectivity');
    await loadAsnConnectivityInto(props.asnConnectivityInfos, asn);
};
</script>
