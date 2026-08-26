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
                <JnTooltip v-if="canShowCountryTraffic" :text="t('Tooltips.ShowCountryTraffic')" side="left">
                    <button type="button"
                        class="shrink-0 -my-0.5 p-1 rounded-md hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        @click="openTrafficDialog"
                        :aria-label="'Show online activity pattern of ' + data.country_name">
                        <Activity class="size-3.5" />
                    </button>
                </JnTooltip>
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
            <!-- Timezone -->
            <div v-if="data.timezone">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Clock class="size-3.5" />
                    <span>{{ t('ipInfos.TimeZone') }}</span>
                </dt>
                <dd class="font-normal wrap-break-word" :title="zoneLocalTime" @mouseenter="refreshZoneLocalTime">
                    {{ data.timezone }}
                    <span class="text-muted-foreground">{{ zoneOffset }}</span>
                </dd>
            </div>

            <div class="col-span-2" :class="data.timezone ? 'md:col-span-2' : 'md:col-span-3'">
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

        <!-- Gated: single CTA banner + 4-field preview grid with *** values.
             Signed-out shows the sign-in copy; over-quota shows the monthly
             quota copy + sponsor link instead. -->
        <template v-if="allAdvancedLocked || allAdvancedQuotaExceeded">
            <span
                class="w-full flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-muted/60 text-muted-foreground transition-colors group">
                <span class="flex items-center gap-1.5 min-w-0">
                    <component :is="allAdvancedQuotaExceeded ? Hourglass : Lock" class="size-3.5 shrink-0" />
                    <span class="truncate">
                        {{ allAdvancedQuotaExceeded ? t('ipInfos.advancedQuotaCta') : t('ipInfos.advancedUnlockCta') }}
                    </span>
                </span>
                <!-- Opens the Benefits & Usage dialog (usage tab for signed-in
                     users) — the sponsor path lives there, not a direct jump. -->
                <button v-if="allAdvancedQuotaExceeded" type="button"
                    class="shrink-0 underline underline-offset-2 hover:text-foreground cursor-pointer"
                    @click="openUsageDialog">
                    {{ t('user.ViewUsage') }}
                </button>
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
                    {{ data.isProxy }}
                </dd>
                <dd class="font-normal wrap-break-word">
                    <span v-if="data.proxyProvider && data.proxyProvider !== 'unknown'"
                        class="text-muted-foreground font-normal text-xs">{{ data.proxyProvider }} {{ data.proxyProtocol
                        &&
                        data.proxyProtocol !== 'unknown'
                        ?
                        '· ' + data.proxyProtocol : '' }}</span>
                </dd>
            </div>

            <div v-if="showNativeBadge">
                <dt class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <House class="size-3.5" />
                    <span>{{ t('ipInfos.advancedData.Nativeness') }}</span>
                    <JnTooltip :text="t('ipInfos.advancedData.nativenessTooltip')" side="top" class="hidden md:block">
                        <CircleQuestionMark class="size-3 cursor-help opacity-70" />
                    </JnTooltip>
                </dt>
                <dd class="font-normal flex items-center gap-1 wrap-break-word">
                    <component :is="data.isNativeIP === true ? Equal : EqualNot" class="size-3.5 shrink-0" />
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
                        :asnInfos="asnInfos" />
                    <ASNHistory v-else-if="activePanel === 'history'" :prefix="ipPrefix"
                        :asnHistoryInfos="asnHistoryInfos" />
                    <ASNConnectivity v-else-if="activePanel === 'connectivity'" :asn="asnNumeric"
                        :asnConnectivityInfos="asnConnectivityInfos" />
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>

    <!-- Country online-activity dialog. Same opt-in rationale as the Map Dialog. -->
    <CountryTraffic v-if="enableCountryTraffic" :open="isTrafficDialogOpen"
        @update:open="isTrafficDialogOpen = $event" :country-code="data.country_code || ''"
        :country-name="data.country_name" :timezone="data.timezone" :isDarkMode="isDarkMode" />

    <!-- Map Dialog. Only rendered when enableMap=true (IPCard opts in, QueryIP opts out to avoid nested dialogs). -->
    <LocationMap v-if="enableMap" :open="isMapDialogOpen" @update:open="isMapDialogOpen = $event" :data="data"
        :isDarkMode="isDarkMode" />
</template>

<script setup>
// Shared display panel for IP info: Metadata grid + Advanced block + ASN row + optional Map Dialog.
// Used by IPCard (homepage card grid) and QueryIP (manual IP lookup dialog).
// Hero IP is NOT part of this panel — consumers render their own hero row since affordances
// (copy button, etc.) differ.
import { ref, computed } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { toBgpPrefix } from '@/utils/bgp-prefix.js';
import { getZoneUtcOffset, getZoneLocalTime } from '@/utils/time-utils.js';
import ASNInfo from './ASNInfo.vue';
import ASNHistory from './ASNHistory.vue';
import CountryTraffic from './CountryTraffic.vue';
import LocationMap from './LocationMap.vue';
// ASNConnectivity is heavy (dagre + SVG render); async-import so it
// only enters the bundle when a user opens the Connectivity panel.
import { defineAsyncComponent } from 'vue';
const ASNConnectivity = defineAsyncComponent(() => import('./ASNConnectivity.vue'));
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Icon } from '@iconify/vue';
import {
    Activity,
    Building2,
    CornerUpRight,
    Equal,
    EqualNot,
    EthernetPort,
    Gauge,
    Hourglass,
    House,
    Info,
    Network,
    Lock,
    Map,
    MapPin,
    ShieldCheck,
    SignalHigh,
    CircleQuestionMark,
    Clock,
    FolderClock,
} from '@lucide/vue';

const { t, locale } = useI18n();
const store = useMainStore();

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
    // Same opt-in for the Country online-activity button + dialog (Country cell).
    enableCountryTraffic: { type: Boolean, default: false },
});

// Consumers rendering this panel inside a dialog listen to close themselves
// first — the Benefits & Usage dialog would otherwise stack on top of them.
const emit = defineEmits(['view-usage']);

const openUsageDialog = () => {
    emit('view-usage');
    store.setTriggerUserBenefits(true);
};

// Single-select panel content for the ASN block: 'info' | 'history' | null.
// Kept separate from the open state so close animations retain their content
// until Collapsible finishes measuring and animating the closing height.
const activePanel = ref(null);
const isPanelOpen = ref(false);
const isMapDialogOpen = ref(false);
const isTrafficDialogOpen = ref(false);

// The backend sends the zone name only; the offset follows DST, so it is
// resolved here rather than travelling through the routes' 24h edge cache.
const zoneOffset = computed(() => getZoneUtcOffset(props.data.timezone));

// Hover title: the wall-clock time where the IP sits, re-read on each hover.
const zoneLocalTime = ref('');
const refreshZoneLocalTime = () => {
    zoneLocalTime.value = getZoneLocalTime(props.data.timezone, locale.value);
};

// Advanced block only surfaces for the IPCheck.ing source (ipGeoSource === 0).
const showAdvancedBlock = computed(() => props.ipGeoSource === 0 && Boolean(props.data));

// Map button is gated on the deployment having a Google Maps key (configs.map) + location data.
// enableMap is the consumer-level opt-in.
const canShowMap = computed(() =>
    props.enableMap && Boolean(props.configs.map) && Boolean(props.data.country_name)
);

// Backend gating sentinels for the advanced fields (see transform-ip-data.js).
const isGatedValue = (value) => value === 'sign_in_required' || value === 'quota_exceeded';

// If every advanced field is masked → show the single CTA + preview grid instead
// of rendering four individual gated rows. The two sentinels pick different copy.
const allAdvancedLocked = computed(() =>
    props.data.type === 'sign_in_required' &&
    props.data.isProxy === 'sign_in_required' &&
    props.data.isNativeIP === 'sign_in_required' &&
    props.data.qualityScore === 'sign_in_required'
);
const allAdvancedQuotaExceeded = computed(() =>
    props.data.type === 'quota_exceeded' &&
    props.data.isProxy === 'quota_exceeded' &&
    props.data.isNativeIP === 'quota_exceeded' &&
    props.data.qualityScore === 'quota_exceeded'
);

const showTypeBadge = computed(() =>
    props.data.type && !isGatedValue(props.data.type)
    && props.data.type !== t('ipInfos.advancedData.type.unknownType')
);
const showProxyBadge = computed(() =>
    props.data.isProxy && !isGatedValue(props.data.isProxy)
    && props.data.isProxy !== t('ipInfos.advancedData.proxyUnknown')
);
const showNativeBadge = computed(() =>
    props.data.isNativeIP !== undefined && !isGatedValue(props.data.isNativeIP)
);
const showQualityScore = computed(() =>
    props.data.qualityScore !== undefined && !isGatedValue(props.data.qualityScore)
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

// Consumer opt-in + a Cloudflare key on the deployment + a country to query.
const canShowCountryTraffic = computed(() =>
    props.enableCountryTraffic && !props.collapsed
    && Boolean(props.configs.cloudFlare) && Boolean(props.data.country_code)
);

const openTrafficDialog = () => {
    isTrafficDialogOpen.value = true;
    trackEvent('IPCheck', 'CountryTrafficClick', props.data.country_code || 'unknown');
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
