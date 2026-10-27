<template>
    <!-- Multi-root template on purpose: Metadata / Advanced / ASN render as direct siblings of
         the consumer's Hero IP (IPCard: inside its body's flex-col), with no wrapper of their own.
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
                        @click="onTrafficClick"
                        :aria-expanded="countryTrafficMode === 'inline' ? isMetaPanelActive('traffic') : undefined"
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
                            @click="onMapClick"
                            :aria-expanded="mapMode === 'inline' ? isMetaPanelActive('map') : undefined"
                            :aria-label="'View ' + data.ip + ' on map'">
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

    <!-- Inline expansion for the Map / Country-traffic panels ('inline' mode). -->
    <Collapsible v-if="mapMode === 'inline' || countryTrafficMode === 'inline'" :open="isMetaPanelOpen"
        @update:open="onMetaPanelOpenChange">
        <CollapsibleContent>
            <div class="px-4 pb-3">
                <div class="rounded-md border bg-muted/40 p-3 text-sm">
                    <LocationMapPanel v-if="activeMetaPanel === 'map'" :data="data" :isDarkMode="isDarkMode" />
                    <CountryTrafficPanel v-else-if="activeMetaPanel === 'traffic'"
                        :country-code="data.country_code || ''" :timezone="data.timezone" :isDarkMode="isDarkMode" />
                </div>
            </div>
        </CollapsibleContent>
    </Collapsible>

    <!-- Advanced block (IPCheck.ing source only): gated CTA or the advanced grid + details. -->
    <IpAdvancedBlock :data="data" :ip-geo-source="ipGeoSource" :configs="configs" :collapsed="collapsed"
        @view-usage="emit('view-usage')" @open-tool="emit('open-tool')" />

    <!-- ASN block: ASN row + Info / History / Connectivity panels. -->
    <IpAsnBlock :data="data" :index="index" :asn-infos="asnInfos" :asn-history-infos="asnHistoryInfos"
        :asn-connectivity-infos="asnConnectivityInfos" :configs="configs" :is-dark-mode="isDarkMode"
        :collapsed="collapsed" @open-tool="emit('open-tool')" />

    <!-- Dialog-mode shells for the same two panels (IPCard). -->
    <CountryTraffic v-if="countryTrafficMode === 'dialog'" :open="isTrafficDialogOpen"
        @update:open="isTrafficDialogOpen = $event" :country-code="data.country_code || ''"
        :country-name="data.country_name" :timezone="data.timezone" :isDarkMode="isDarkMode" />

    <LocationMap v-if="mapMode === 'dialog'" :open="isMapDialogOpen" @update:open="isMapDialogOpen = $event"
        :data="data" :isDarkMode="isDarkMode" />
</template>

<script setup>
// Shared display panel for IP info: Metadata grid + Advanced block (IpAdvancedBlock) + ASN row
// (IpAsnBlock), plus the Map and Country-traffic panels (per-consumer 'dialog' / 'inline' / 'off'
// via mapMode / countryTrafficMode). Used by IPCard (homepage card grid) and QueryIP (manual IP
// lookup dialog). Hero IP is NOT part of this panel — consumers render their own hero row since
// affordances (copy button, etc.) differ.
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { getZoneUtcOffset, getZoneLocalTime } from '@/utils/time-utils.js';
import CountryTraffic from './CountryTraffic.vue';
import CountryTrafficPanel from './CountryTrafficPanel.vue';
import LocationMap from './LocationMap.vue';
import LocationMapPanel from './LocationMapPanel.vue';
import IpAdvancedBlock from './IpAdvancedBlock.vue';
import IpAsnBlock from './IpAsnBlock.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Icon } from '@iconify/vue';
import {
    Activity,
    CornerUpRight,
    EthernetPort,
    House,
    Map,
    MapPin,
    Clock,
} from '@lucide/vue';

const { t, locale } = useI18n();

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
    // How the Map (City cell) and Country-traffic (Country cell) affordances
    // render: 'dialog' (IPCard), 'inline' — a Collapsible under the metadata
    // grid (QueryIP, itself a Dialog; stacking dialogs is confusing) — or
    // 'off' (default).
    mapMode: { type: String, default: 'off' },
    countryTrafficMode: { type: String, default: 'off' },
});

// A host dialog listens to close itself first: before the Benefits & Usage
// dialog stacks on it (`view-usage`) or a tool link (ASN Profile, Blocklist Check, Persona Check) changes page (`open-tool`).
const emit = defineEmits(['view-usage', 'open-tool']);

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

// Map button is gated on the deployment having a Google Maps key (configs.map) + location data.
const canShowMap = computed(() =>
    props.mapMode !== 'off' && Boolean(props.configs.map) && Boolean(props.data.country_name)
);

// Consumer opt-in + a Cloudflare key on the deployment + a country to query.
const canShowCountryTraffic = computed(() =>
    props.countryTrafficMode !== 'off' && !props.collapsed
    && Boolean(props.configs.cloudFlare) && Boolean(props.data.country_code)
);

// Single-select inline expansion under the metadata grid ('inline' mode) —
// same open/content split as IpAsnBlock's panels, so close animations keep
// their content.
const activeMetaPanel = ref(null);
const isMetaPanelOpen = ref(false);
const isMetaPanelActive = (name) => isMetaPanelOpen.value && activeMetaPanel.value === name;
const toggleMetaPanel = (name) => {
    if (isMetaPanelActive(name)) {
        isMetaPanelOpen.value = false;
        return;
    }
    activeMetaPanel.value = name;
    isMetaPanelOpen.value = true;
};
const onMetaPanelOpenChange = (open) => {
    isMetaPanelOpen.value = open;
};

const onMapClick = () => {
    trackEvent('IPCheck', 'ViewOnMapClick', props.data.source || 'unknown');
    if (props.mapMode === 'inline') toggleMetaPanel('map');
    else isMapDialogOpen.value = true;
};

const onTrafficClick = () => {
    trackEvent('IPCheck', 'CountryTrafficClick', props.data.country_code || 'unknown');
    if (props.countryTrafficMode === 'inline') toggleMetaPanel('traffic');
    else isTrafficDialogOpen.value = true;
};
</script>
