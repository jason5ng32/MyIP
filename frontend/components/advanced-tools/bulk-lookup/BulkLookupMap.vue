<!-- Bulk IP Lookup map: IPs per country as a choropleth (the IPHistoryMap
     renderer), narrowed by an ASN · Org select. Clicking a country emits
     `pick` so the page filters its table by it. -->
<template>
    <section class="rounded-lg border bg-card p-4 space-y-3 min-w-0">
        <!-- Header: title + hint, ASN · Org filter beside it from md up -->
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
            <div class="space-y-1 min-w-0">
                <h2 class="flex items-center gap-2 text-base font-semibold m-0">
                    <MapIcon class="size-4 text-muted-foreground" />{{ t('bulklookup.MapTitle') }}
                </h2>
                <p class="text-xs text-muted-foreground leading-relaxed m-0">{{ t('bulklookup.MapHint') }}</p>
            </div>
            <Select v-model="asn" :disabled="!asnGroups.length">
                <SelectTrigger class="h-8 w-full text-xs" :aria-label="t('bulklookup.PanelAsn')">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{{ t('bulklookup.AllAsns') }}</SelectItem>
                    <SelectItem v-for="group in asnGroups" :key="group.key" :value="group.key">
                        {{ group.label ? `${group.key} · ${group.label}` : group.key }} ({{ group.value }})
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>

        <div class="relative w-full aspect-[2.2/1] overflow-hidden rounded-md">
            <p v-if="!rows.length" class="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground m-0">
                {{ t('bulklookup.NothingYet') }}
            </p>
            <canvas v-else ref="canvas" role="img" :aria-label="t('bulklookup.MapTitle')"></canvas>
            <div v-if="rows.length && !ready && !failed" class="absolute inset-0 flex items-center justify-center bg-card">
                <Spinner class="size-4 text-muted-foreground" />
            </div>
            <p v-if="failed" role="status"
                class="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground bg-card">
                {{ t('bulklookup.MapUnavailable') }}
            </p>
        </div>
    </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { useWorldMapChart } from '@/composables/use-world-map-chart.js';
import { aggregateRows } from '@/composables/use-bulk-lookup.js';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Map as MapIcon } from '@lucide/vue';

const props = defineProps({
    rows: { type: Array, required: true },
});
const emit = defineEmits(['pick']);

const { t, locale } = useI18n();
const store = useMainStore();
const canvas = ref(null);

const asn = ref('all');
const asnGroups = computed(() => aggregateRows(props.rows, 'asn').filter((group) => group.key));
// An ASN deleted from the list drops back to all.
watch(asnGroups, (groups) => {
    if (asn.value !== 'all' && !groups.some((group) => group.key === asn.value)) asn.value = 'all';
});

const countries = computed(() => {
    const rows = asn.value === 'all' ? props.rows : props.rows.filter((row) => row.asn === asn.value);
    return aggregateRows(rows, 'country').filter((group) => group.key);
});

const options = computed(() => ({
    values: Object.fromEntries(countries.value.map((group) => [group.key, group.value])),
    lang: locale.value,
    colorFrom: '#6597F3',
    colorTo: '#1449AB',
    tooltipOnMissing: false,
    formatValue: (value) => ` ${t('bulklookup.MapTooltip', { n: value })}`,
    onCountryClick: (code) => emit('pick', { field: 'country', key: code }),
}));

const { ready, failed } = useWorldMapChart({
    canvas, visible: true, options, theme: () => store.isDarkMode,
});
</script>
