<!-- Bulk IP Lookup Analysis tab: statistics over the scoped rows.
     One IPs / frequency toggle weights the whole tab: the map beside the
     Country/region ranking, then the ASN · Org and address-block
     (/24 · /48) rankings. A known entry is a button that drills the page's
     scope down through the search query's tokens (`pick`); a second click
     lifts it. -->
<template>
    <div class="space-y-4">
        <!-- Weight of the whole tab: map and rankings -->
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span id="bulkLookupWeightLabel" class="text-sm text-muted-foreground">{{ t('bulklookup.WeightLabel') }}</span>
            <ToggleGroup :model-value="weight" type="single" variant="outline" :spacing="2"
                class="flex-wrap justify-start" aria-labelledby="bulkLookupWeightLabel"
                @update:model-value="(v) => v && (weight = v)">
                <ToggleGroupItem value="ips" :class="tagClass">{{ t('bulklookup.ByIps') }}</ToggleGroupItem>
                <ToggleGroupItem value="hits" :class="tagClass">{{ t('bulklookup.ByHits') }}</ToggleGroupItem>
            </ToggleGroup>
        </div>

        <!-- On lg, ten tracks: map (6) beside Country/region (4), then
             ASN · Org and address blocks (5 each); stacked below lg -->
        <div class="grid gap-4 lg:grid-cols-10">
            <BulkLookupMap :rows="rows" :weight="weight" class="lg:col-span-6" />

            <section v-for="panel in panels" :key="panel.field"
                class="flex flex-col gap-4 rounded-lg border bg-card p-4 min-w-0" :class="panel.span">
                <div class="space-y-1">
                    <h2 class="flex min-h-8 items-center gap-2 text-base font-semibold m-0">
                        <component :is="panel.icon" class="size-4 shrink-0 text-muted-foreground" />
                        <span class="min-w-0 truncate">{{ t(panel.titleKey) }}</span>
                        <span class="ml-auto shrink-0 text-xs font-normal text-muted-foreground tabular-nums">
                            {{ formatCount(panel.groups.length) }}<template v-if="panel.top !== null"> · {{ t('bulklookup.TopGroupsShare', { n: TOP_GROUPS_N, share: percent(panel.top) }) }}</template>
                        </span>
                    </h2>
                    <p class="text-xs text-muted-foreground leading-relaxed m-0">{{ t(`bulklookup.PanelHint.${panel.field}`) }}</p>
                </div>

                <!-- An entry: label(s), bar, value, share. Known ones are pick
                     buttons; Unknown has no token, so it stays plain. -->
                <!-- Empty scope: a placeholder keeps the card from collapsing -->
                <p v-if="!panel.groups.length" class="text-sm text-muted-foreground text-center py-6 m-0">
                    {{ t('bulklookup.NoMatches') }}
                </p>
                <ul v-else class="space-y-0.5 list-none m-0 p-0">
                    <li v-for="group in panel.shown" :key="group.key">
                        <component :is="group.key ? 'button' : 'div'" v-bind="entryAttrs(panel, group)"
                            :class="cn('flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm sm:gap-2',
                                group.key && 'text-left cursor-pointer hover:bg-muted/30',
                                isActive(panel, group) && 'bg-info/10 text-info hover:bg-info/15')">
                            <Icon v-if="panel.field === 'country' && group.key"
                                :icon="'circle-flags:' + group.key.toLowerCase()" class="size-4 shrink-0" />
                            <span v-if="panel.field === 'asn'" class="w-16 shrink-0 font-mono text-xs truncate sm:w-20"
                                :class="{ 'text-muted-foreground': !group.key }" :title="group.key">{{ group.key || '—' }}</span>
                            <span v-if="panel.field === 'block'" :class="cn(labelClass, 'sm:w-40 font-mono text-xs')"
                                :title="group.key">{{ group.key }}</span>
                            <span v-else :class="cn(labelClass, 'sm:w-32', (!group.key || panel.field === 'asn') && 'text-muted-foreground')"
                                :title="groupLabel(panel.field, group)">{{ groupLabel(panel.field, group) }}</span>
                            <span class="w-10 shrink-0 h-1.5 rounded-full bg-muted overflow-hidden sm:w-auto sm:min-w-8 sm:flex-1">
                                <span class="block h-full rounded-full bg-info" :style="{ width: `${group.share * 100}%` }" />
                            </span>
                            <span class="w-12 shrink-0 text-right font-mono text-xs tabular-nums sm:w-14">{{ formatCount(group.value) }}</span>
                            <span class="w-11 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground sm:w-12">{{ percent(group.share) }}</span>
                        </component>
                    </li>
                </ul>

                <button v-if="panel.groups.length > TOP_N" type="button"
                    class="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-sm text-muted-foreground hover:bg-muted/30 hover:text-foreground cursor-pointer"
                    @click="expanded[panel.field] = !expanded[panel.field]">
                    <ChevronDown class="size-4 transition-transform duration-200" :class="{ 'rotate-180': expanded[panel.field] }" />
                    {{ expanded[panel.field] ? t('bulklookup.ShowLess') : t('bulklookup.MoreEntries', { n: panel.groups.length - TOP_N }) }}
                </button>
            </section>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { cn } from '@/lib/utils';
import getCountryName from '@/data/country-name.js';
import {
    aggregateRows, topGroupShare, TOP_GROUPS_N, normalizePick, queryPick,
} from '@/composables/use-bulk-lookup.js';
import BulkLookupMap from './BulkLookupMap.vue';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Blocks, ChevronDown, Globe, Network } from '@lucide/vue';

const props = defineProps({
    rows: { type: Array, required: true },
    // The page's search query, read for the active pick of each panel.
    query: { type: String, default: '' },
});
const emit = defineEmits(['pick']);

const { t, locale } = useI18n();

const TOP_N = 10;

// An entry's label: flexes below sm beside the fixed-width bar, so a phone
// row keeps its numbers in view; fixed widths from sm.
const labelClass = 'min-w-0 flex-1 truncate sm:flex-none';
const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';

const formatCount = (n) => n.toLocaleString(locale.value);
const percent = (share) => {
    try {
        return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(share);
    } catch {
        return `${(share * 100).toFixed(1)}%`;
    }
};

// 'ips' | 'hits'; held by the page so it survives a tab switch.
const weight = defineModel('weight', { type: String, default: 'ips' });
const expanded = ref({ country: false, asn: false, block: false });

// `span`: the panel's tracks on the lg ten-track grid.
const PANELS = [
    { field: 'country', titleKey: 'bulklookup.PanelCountry', icon: Globe, span: 'lg:col-span-4' },
    { field: 'asn', titleKey: 'bulklookup.PanelAsn', icon: Network, span: 'lg:col-span-5' },
    { field: 'block', titleKey: 'bulklookup.PanelBlock', icon: Blocks, span: 'lg:col-span-5' },
];
// `shown`: the top N, or all when expanded; `active`: the query's pick.
const panels = computed(() => PANELS.map((panel) => {
    const groups = aggregateRows(props.rows, panel.field, { weight: weight.value });
    return {
        ...panel,
        groups,
        top: topGroupShare(groups),
        shown: expanded.value[panel.field] ? groups : groups.slice(0, TOP_N),
        active: queryPick(props.query, panel.field),
    };
}));

// Whether an entry is its panel's current pick; Unknown never is.
const isActive = (panel, group) => !!group.key
    && panel.active === normalizePick(panel.field, group.key);

// A known entry's pick-button attributes; Unknown stays a plain row.
const entryAttrs = (panel, group) => {
    if (!group.key) return {};
    const active = isActive(panel, group);
    return {
        type: 'button',
        title: t('bulklookup.PickHint'),
        'aria-pressed': String(active),
        onClick: () => emit('pick', { field: panel.field, key: group.key }),
    };
};

const groupLabel = (field, group) => {
    if (!group.key) return t('bulklookup.Unknown');
    if (field === 'country') return getCountryName(group.key, locale.value) || group.key;
    return group.label || '';
};
</script>
