<!-- Bulk IP Lookup map (Analysis tab): a per-country choropleth (the
     IPHistoryMap renderer) over the scoped rows, by IP count or by frequency
     as `weight` says. Display only. -->
<template>
    <section class="flex flex-col gap-4 rounded-lg border bg-card p-4 min-w-0">
        <!-- Header: title, then the hint — the ranked panels' rhythm -->
        <div class="space-y-1">
            <h2 class="flex min-h-8 items-center gap-2 text-base font-semibold m-0">
                <MapIcon class="size-4 shrink-0 text-muted-foreground" />
                <span class="min-w-0 truncate">{{ t('bulklookup.MapTitle') }}</span>
            </h2>
            <p class="text-xs text-muted-foreground leading-relaxed m-0">{{ t(`bulklookup.MapHint.${weight}`) }}</p>
        </div>

        <!-- my-auto: centred when the list beside it makes the card taller -->
        <div class="relative w-full aspect-[2.2/1] my-auto overflow-hidden rounded-md">
            <canvas ref="canvas" role="img" :aria-label="t('bulklookup.MapTitle')"></canvas>
            <div v-if="!ready && !failed" class="absolute inset-0 flex items-center justify-center bg-card">
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
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { useWorldMapChart } from '@/composables/use-world-map-chart.js';
import { aggregateRows } from '@/composables/use-bulk-lookup.js';
import { Spinner } from '@/components/ui/spinner';
import { Map as MapIcon } from '@lucide/vue';

const props = defineProps({
    rows: { type: Array, required: true },
    // 'ips' | 'hits', the Analysis toggle.
    weight: { type: String, default: 'ips' },
});

const { t, locale } = useI18n();
const store = useMainStore();
const canvas = ref(null);

const formatCount = (n) => n.toLocaleString(locale.value);

const countries = computed(() => aggregateRows(props.rows, 'country', { weight: props.weight }).filter((group) => group.key));

const options = computed(() => {
    const tooltipKey = `bulklookup.MapTooltip.${props.weight}`;
    return {
        values: Object.fromEntries(countries.value.map((group) => [group.key, group.value])),
        lang: locale.value,
        colorFrom: '#6597F3',
        colorTo: '#1449AB',
        tooltipOnMissing: false,
        formatValue: (value) => ` ${t(tooltipKey, { n: formatCount(value ?? 0) })}`,
    };
});

const { ready, failed } = useWorldMapChart({
    canvas, visible: true, options, theme: () => store.isDarkMode,
});
</script>
