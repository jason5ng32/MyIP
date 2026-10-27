<!-- Bulk IP Lookup summary: Country/region and ASN · Org ranked lists, by IP
     count or by log occurrences. Clicking an entry emits `pick` so the page
     filters its table. -->
<template>
    <div class="space-y-3">
        <ToggleGroup :model-value="weight" type="single" variant="outline" :spacing="2" :disabled="!rows.length"
            class="w-full flex-wrap justify-start" :aria-label="t('bulklookup.tab.summary')"
            @update:model-value="(v) => v && (weight = v)">
            <ToggleGroupItem value="ips" :class="tagClass">{{ t('bulklookup.ByIps') }}</ToggleGroupItem>
            <ToggleGroupItem value="hits" :class="tagClass">{{ t('bulklookup.ByHits') }}</ToggleGroupItem>
        </ToggleGroup>

        <div class="grid gap-4 lg:grid-cols-2">
            <section v-for="panel in panels" :key="panel.field" class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
                <div class="space-y-1">
                    <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                        <component :is="panel.icon" class="size-4 text-muted-foreground" />
                        {{ t(panel.titleKey) }}
                        <span class="ml-auto text-xs font-normal text-muted-foreground tabular-nums">{{ panel.groups.length }}</span>
                    </h2>
                    <p class="text-xs text-muted-foreground leading-relaxed m-0">{{ t('bulklookup.SummaryHint') }}</p>
                </div>

                <p v-if="!panel.groups.length" class="py-6 text-center text-sm text-muted-foreground m-0">
                    {{ t('bulklookup.NothingYet') }}
                </p>
                <ul v-else class="space-y-0.5 list-none m-0 p-0">
                    <li v-for="group in shown(panel)" :key="group.key">
                        <button type="button"
                            class="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                            @click="emit('pick', { field: panel.field, key: group.key })">
                            <Icon v-if="panel.field === 'country' && group.key"
                                :icon="'circle-flags:' + group.key.toLowerCase()" class="size-4 shrink-0" />
                            <span v-if="panel.field === 'asn'" class="w-20 shrink-0 font-mono text-xs truncate"
                                :class="{ 'text-muted-foreground': !group.key }">{{ group.key || '—' }}</span>
                            <span class="w-32 truncate" :class="{ 'text-muted-foreground': !group.key || panel.field === 'asn' }"
                                :title="groupLabel(panel.field, group)">{{ groupLabel(panel.field, group) }}</span>
                            <span class="flex-1 h-1.5 min-w-8 rounded-full bg-muted overflow-hidden">
                                <span class="block h-full rounded-full bg-info" :style="{ width: `${group.share * 100}%` }" />
                            </span>
                            <span class="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{{ group.value.toLocaleString(locale) }}</span>
                            <span class="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{{ percent(group.share) }}</span>
                        </button>
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
import getCountryName from '@/data/country-name.js';
import { aggregateRows } from '@/composables/use-bulk-lookup.js';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronDown, Globe, Network } from '@lucide/vue';

const props = defineProps({
    rows: { type: Array, required: true },
});
const emit = defineEmits(['pick']);

const { t, locale } = useI18n();

const TOP_N = 10;
const tagClass = 'group h-7 rounded-full px-2.5 text-xs cursor-pointer';

const weight = ref('ips');
const expanded = ref({ country: false, asn: false });

const panels = computed(() => [
    { field: 'country', titleKey: 'bulklookup.PanelCountry', icon: Globe, groups: aggregateRows(props.rows, 'country', { weight: weight.value }) },
    { field: 'asn', titleKey: 'bulklookup.PanelAsn', icon: Network, groups: aggregateRows(props.rows, 'asn', { weight: weight.value }) },
]);

const shown = (panel) => (expanded.value[panel.field] ? panel.groups : panel.groups.slice(0, TOP_N));

const groupLabel = (field, group) => {
    if (!group.key) return t('bulklookup.Unknown');
    if (field === 'country') return getCountryName(group.key, locale.value) || group.key;
    return group.label || '';
};

const percent = (share) => {
    try {
        return new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(share);
    } catch {
        return `${(share * 100).toFixed(1)}%`;
    }
};
</script>
