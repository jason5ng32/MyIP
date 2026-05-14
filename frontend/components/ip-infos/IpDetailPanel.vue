<template>
    <!-- Multi-root template on purpose: Metadata / Advanced / ASN render as direct siblings of
         the consumer's Hero IP inside a flex-col, so ASN's `mt-auto` pushes to the card bottom.
         Side-effect: `class` / `style` don't auto-fall through — don't write
         `<IpDetailPanel class="..."/>`, the class goes nowhere. Style via the children's own classes. -->

    <!-- Metadata grid: 2 cols on mobile, 3 cols on PC for Country / Region / City.
         ISP takes its own row (col-span-3) so long provider names have room to breathe. -->
    <dl v-if="data.country_name" class="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-3 text-sm items-start"
        :class="{ 'grid-cols-1!': collapsed }">
        <div>
            <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <MapPin class="size-3.5" />
                <span>{{ t('ipInfos.Country') }}</span>
            </dt>
            <dd class="font-normal flex items-center gap-1.5 flex-wrap">
                <Icon v-if="data.country_code" :icon="'circle-flags:' + data.country_code.toLowerCase()"
                    class="shrink-0 size-4" />
                <span class="wrap-break-word">{{ data.country_name }}</span>
            </dd>
        </div>

        <!-- Region / City / ISP only rendered when not in collapsed mode. -->
        <template v-if="!collapsed">
            <div>
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <House class="size-3.5" />
                    <span>{{ t('ipInfos.Region') }}</span>
                </dt>
                <dd class="font-normal wrap-break-word">{{ data.region || '—' }}</dd>
            </div>
            <div>
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <CornerUpRight class="size-3.5" />
                    <span>{{ t('ipInfos.City') }}</span>
                </dt>
                <dd class="font-normal flex items-center gap-1 flex-wrap">
                    <span class="wrap-break-word">{{ data.city || '—' }}</span>
                    <JnTooltip v-if="canShowMap" :text="t('Tooltips.ViewOnMap')" side="left">
                        <button type="button"
                            class="shrink-0 -my-0.5 p-1 rounded-md hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            @click="openMapDialog" :aria-label="'View ' + data.ip + ' on map'">
                            <Map class="size-3.5" />
                        </button>
                    </JnTooltip>
                </dd>
            </div>
            <div class="col-span-2 md:col-span-3">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <EthernetPort class="size-3.5" />
                    <span>{{ t('ipInfos.ISP') }}</span>
                </dt>
                <dd class="font-normal wrap-break-word">{{ data.isp || '—' }}</dd>
            </div>
        </template>
    </dl>

    <!-- Advanced block (IPCheck.ing source only): locked CTA for signed-out, label-value grid for signed-in. -->
    <div v-if="!collapsed" v-show="showAdvancedBlock" class="px-4 pb-3 border-t pt-3 space-y-2.5">

        <!-- Signed-out: single CTA banner + 4-field preview grid with *** values. -->
        <template v-if="allAdvancedLocked">
            <span
                class="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 text-muted-foreground transition-colors group">
                <span class="flex items-center gap-1.5 min-w-0">
                    <Lock class="size-3.5 shrink-0" />
                    <span class="truncate">{{ t('ipInfos.advancedUnlockCta') }}</span>
                </span>
            </span>

            <dl class="grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-3 text-sm items-start">
                <div v-for="f in lockedFieldList" :key="f.key">
                    <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <component :is="f.icon" class="size-3.5" />
                        <span>{{ f.label }}</span>
                    </dt>
                    <dd class="font-normal text-muted-foreground/60">***</dd>
                </div>
            </dl>
        </template>

        <!-- Signed-in: same vertical "label on top, value below" rhythm as the metadata grid. -->
        <dl v-else class="grid grid-cols-2 md:grid-cols-2 gap-x-3 gap-y-3 text-sm items-start">
            <div v-if="showTypeBadge">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <SignalHigh class="size-3.5" />
                    <span>{{ t('ipInfos.type') }}</span>
                </dt>
                <dd class="font-normal wrap-break-word">{{ data.type }}</dd>
            </div>

            <div v-if="showProxyBadge">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <ShieldCheck class="size-3.5" />
                    <span>{{ t('ipInfos.isProxy') }}</span>
                </dt>
                <dd class="font-normal wrap-break-word">
                    {{ data.isProxy }}<span
                        v-if="data.proxyProtocol && data.proxyProtocol !== t('ipInfos.advancedData.proxyUnknownProtocol')"
                        class="text-muted-foreground font-normal"> · {{ data.proxyProtocol }}</span>
                </dd>
            </div>

            <div v-if="showNativeBadge">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <House class="size-3.5" />
                    <span>{{ t('ipInfos.advancedData.Nativeness') }}</span>
                </dt>
                <dd class="font-normal flex items-center gap-1 wrap-break-word">
                    <component :is="data.isNativeIP === true ? CircleCheck : CircleX"
                        class="size-3.5 shrink-0" />
                    <span>{{ data.isNativeIP === true ? t('ipInfos.advancedData.NativeIPYes') :
                        t('ipInfos.advancedData.NativeIPNo') }}</span>
                </dd>
            </div>

            <div v-if="showQualityScore">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Gauge class="size-3.5" />
                    <span>{{ t('ipInfos.qualityScore') }}</span>
                </dt>
                <dd>
                    <span v-if="data.qualityScore === 'unknown'" class="font-normal text-muted-foreground">
                        {{ t('ipInfos.qualityScoreUnknown') }}
                    </span>
                    <div v-else class="flex items-center gap-2">
                        <Progress :model-value="Number(data.qualityScore) || 0" class="h-2 flex-1 min-w-12"
                            :indicator-class="qualityTone === 'ok-fast' ? 'bg-success' : qualityTone === 'ok-slow' ? 'bg-warning' : 'bg-destructive'" />
                        <span class="text-sm font-normal tabular-nums shrink-0">{{ data.qualityScore }}/100</span>
                    </div>
                </dd>
            </div>
        </dl>
    </div>

    <!-- ASN block -->
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
                        <History />
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
                        :asnInfos="asnInfos" />
                    <ASNHistory v-else-if="activePanel === 'history'" :prefix="ipPrefix"
                        :asnHistoryInfos="asnHistoryInfos" />
                    <ASNConnectivity v-else-if="activePanel === 'connectivity'" :asn="asnNumeric"
                        :asnConnectivityInfos="asnConnectivityInfos" />
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>

    <!-- Map Dialog. Only rendered when enableMap=true (IPCard opts in, QueryIP opts out to avoid nested dialogs). -->
    <Dialog v-if="enableMap" :open="isMapDialogOpen" @update:open="isMapDialogOpen = $event">
        <DialogContent :title="data.ip" class="max-w-2xl">
            <DialogHeader>
                <template #title>
                    <span class="flex items-center gap-2 min-w-0">
                        <Icon v-if="data.country_code" :icon="'circle-flags:' + data.country_code.toLowerCase()"
                            class="size-4 shrink-0" />
                        <span class="truncate">{{ data.country_name }}<template v-if="data.city"> · {{ data.city
                                }}
                            </template>
                        </span>
                    </span>
                </template>
            </DialogHeader>
            <div class="mb-2">
            <span class="flex items-center gap-2 text-sm text-muted-foreground ">
                <Earth class="size-4" />
                <span class="text-sm text-muted-foreground">{{ t('ipInfos.Coordinates') }}</span>
            </span>
            <span class="font-mono shrink-0 truncate whitespace-nowrap">{{  data.longitude }}, {{  data.latitude }}</span>
            </div>
            <span>
            <img :src="isDarkMode ? data.mapUrl_dark : data.mapUrl"
                class="w-full rounded-md border bg-muted aspect-2/1 object-cover" alt="Map">
            </span>
        </DialogContent>
    </Dialog>
</template>

<script setup>
// Shared display panel for IP info: Metadata grid + Advanced block + ASN row + optional Map Dialog.
// Used by IPCard (homepage card grid) and QueryIP (manual IP lookup dialog).
// Hero IP is NOT part of this panel — consumers render their own hero row since affordances
// (copy button, etc.) differ.
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { toBgpPrefix } from '@/utils/bgp-prefix.js';
import ASNInfo from './ASNInfo.vue';
import ASNHistory from './ASNHistory.vue';
// ASNConnectivity is heavy (dagre + SVG render); async-import so it
// only enters the bundle when a user opens the Connectivity panel.
import { defineAsyncComponent } from 'vue';
const ASNConnectivity = defineAsyncComponent(() => import('./ASNConnectivity.vue'));
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/vue';
import { Earth } from 'lucide-vue-next';
import {
    Building2,
    CircleCheck,
    CircleX,
    CornerUpRight,
    EthernetPort,
    Gauge,
    History,
    House,
    Info,
    Network,
    Lock,
    Map,
    MapPin,
    ShieldCheck,
    SignalHigh,
} from 'lucide-vue-next';

const { t } = useI18n();

const props = defineProps({
    data: { type: Object, required: true },
    ipGeoSource: { type: Number, required: true },
    asnInfos: { type: Object, required: true },
    // Optional — keyed by IP. IpInfos owns the shared map; QueryIP falls back to its own.
    asnHistoryInfos: { type: Object, default: () => ({}) },
    // Optional — keyed by numeric ASN string. Same shared-cache pattern.
    asnConnectivityInfos: { type: Object, default: () => ({}) },
    configs: { type: Object, required: true },
    isDarkMode: { type: Boolean, required: true },
    // ASNInfo requires an index; homepage cards pass their grid index, QueryIP has nothing meaningful.
    index: { type: Number, default: 0 },
    // IPCard on mobile with simpleMode enables this to hide everything but Country + hide ASN.
    collapsed: { type: Boolean, default: false },
    // IPCard opts in to show the Map button (in the City cell) + the Map Dialog.
    // QueryIP opts out — the parent is already a Dialog, stacking dialogs is confusing.
    enableMap: { type: Boolean, default: false },
});

// Single-select panel content for the ASN block: 'info' | 'history' | null.
// Kept separate from the open state so close animations retain their content
// until Collapsible finishes measuring and animating the closing height.
const activePanel = ref(null);
const isPanelOpen = ref(false);
const isMapDialogOpen = ref(false);

// Advanced block only surfaces for the IPCheck.ing source (ipGeoSource === 0).
const showAdvancedBlock = computed(() => props.ipGeoSource === 0 && Boolean(props.data));

// Map button is gated on the deployment having a Google Maps key (configs.map) + location data.
// enableMap is the consumer-level opt-in.
const canShowMap = computed(() =>
    props.enableMap && Boolean(props.configs.map) && Boolean(props.data.country_name)
);

// If every advanced field is masked behind login → show the single CTA + preview grid instead
// of rendering four individual "sign in to unlock" rows.
const allAdvancedLocked = computed(() =>
    props.data.type === 'sign_in_required' &&
    props.data.isProxy === 'sign_in_required' &&
    props.data.isNativeIP === 'sign_in_required' &&
    props.data.qualityScore === 'sign_in_required'
);

const showTypeBadge = computed(() =>
    props.data.type && props.data.type !== 'sign_in_required'
    && props.data.type !== t('ipInfos.advancedData.type.unknownType')
);
const showProxyBadge = computed(() =>
    props.data.isProxy && props.data.isProxy !== 'sign_in_required'
    && props.data.isProxy !== t('ipInfos.advancedData.proxyUnknown')
);
const showNativeBadge = computed(() =>
    props.data.isNativeIP !== undefined && props.data.isNativeIP !== 'sign_in_required'
);
const showQualityScore = computed(() =>
    props.data.qualityScore !== undefined && props.data.qualityScore !== 'sign_in_required'
);

// Locked field preview: the 4 advanced fields shown as "label + ***" for signed-out users.
const lockedFieldList = computed(() => [
    { key: 'type', icon: SignalHigh, label: t('ipInfos.type') },
    { key: 'proxy', icon: ShieldCheck, label: t('ipInfos.isProxy') },
    { key: 'native', icon: House, label: t('ipInfos.advancedData.Nativeness') },
    { key: 'quality', icon: Gauge, label: t('ipInfos.qualityScore') },
]);

// Quality Score color tiers — reuse the same 4-tone semantic as use-status-tone.
const qualityTone = computed(() => {
    const n = Number(props.data.qualityScore);
    if (isNaN(n)) return 'wait';
    if (n >= 80) return 'ok-fast';
    if (n >= 50) return 'ok-slow';
    return 'fail';
});

const openMapDialog = () => {
    isMapDialogOpen.value = true;
    trackEvent('IPCheck', 'ViewOnMapClick', props.data.source || 'unknown');
};

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

const getASNInfo = async (asn) => {
    trackEvent('IPCheck', 'ASNInfoClick', 'Show ASN Info');
    try {
        if (props.asnInfos[asn]) return;
        asn = asn.replace('AS', '');
        const response = await fetchWithTimeout(`/api/cfradar?asn=${asn}`);
        const data = await response.json();
        props.asnInfos['AS' + asn] = data;
    } catch (error) {
        console.error('Error fetching ASN info:', error);
    }
};

const getASNHistory = async (prefix) => {
    trackEvent('IPCheck', 'ASNHistoryClick', 'Show ASN History');
    try {
        if (props.asnHistoryInfos[prefix]) return;
        // RIPEstat routing-history is a slow analytical endpoint (10–20s on
        // cold prefixes). Backend caps it at 25s; browser waits 26s so the
        // server's 504 surfaces instead of the browser aborting first.
        const response = await fetchWithTimeout(
            `/api/asn-history?prefix=${encodeURIComponent(prefix)}`,
            { timeoutMs: 26000 }
        );
        if (!response.ok) {
            props.asnHistoryInfos[prefix] = { error: true };
            return;
        }
        const data = await response.json();
        props.asnHistoryInfos[prefix] = data;
    } catch (error) {
        console.error('Error fetching ASN history:', error);
        props.asnHistoryInfos[prefix] = { error: true };
    }
};

const getASNConnectivity = async (asn) => {
    trackEvent('IPCheck', 'ASNConnectivityClick', 'Show ASN Connectivity');
    try {
        if (props.asnConnectivityInfos[asn]) return;
        const response = await fetchWithTimeout(
            `/api/asn-connectivity?asn=${encodeURIComponent(asn)}`,
            { timeoutMs: 5000 } // backend is sub-ms local lookup; tight cap is fine
        );
        if (!response.ok) {
            props.asnConnectivityInfos[asn] = { error: true };
            return;
        }
        const graph = await response.json();
        props.asnConnectivityInfos[asn] = { graph };
    } catch (error) {
        console.error('Error fetching ASN connectivity:', error);
        props.asnConnectivityInfos[asn] = { error: true };
    }
};
</script>
