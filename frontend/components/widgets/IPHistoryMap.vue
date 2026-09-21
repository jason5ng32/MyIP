<!-- Compact country overview; country tags provide the equivalent keyboard filters. -->
<template>
    <Collapsible v-model:open="expanded" class="rounded-lg border bg-card">
        <CollapsibleTrigger>
            <Button type="button" variant="ghost"
                class="group w-full h-auto justify-between gap-2 px-3 py-2.5 text-xs cursor-pointer">
                <span class="flex items-center gap-2 min-w-0 text-left whitespace-normal">
                    <Globe class="size-3.5 shrink-0 text-muted-foreground" />
                    {{ t('ipHistory.ViewMap') }}
                </span>
                <ChevronDown class="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
            <div class="px-2 pb-2">
                <div class="relative w-full aspect-[2.2/1] overflow-hidden rounded-md">
                    <canvas ref="canvas" role="img" :aria-label="t('ipHistory.MapTitle')"></canvas>
                    <div v-if="!ready && !failed" class="absolute inset-0 flex items-center justify-center bg-card">
                        <Spinner class="size-4 text-muted-foreground" />
                    </div>
                    <p v-if="failed" role="status"
                        class="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground bg-card">
                        {{ t('ipHistory.MapUnavailable') }}
                    </p>
                </div>
            </div>
        </CollapsibleContent>
    </Collapsible>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useStorage } from '@vueuse/core';
import { useI18n } from 'vue-i18n';
import { Globe, ChevronDown } from '@lucide/vue';
import { useMainStore } from '@/store';
import { useWorldMapChart } from '@/composables/use-world-map-chart.js';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const props = defineProps({
    countries: { type: Array, required: true },
    selected: { type: Array, required: true },
    interactive: { type: Boolean, default: true },
});
const emit = defineEmits(['toggle-country']);
const { t, locale } = useI18n();
const store = useMainStore();
const canvas = ref(null);
// This presentation preference stays local, like the history itself.
const expanded = useStorage('ipHistoryMapExpanded', false, undefined, {
    writeDefaults: false,
    onError: () => {},
});
const options = computed(() => ({
    values: Object.fromEntries(props.countries.map(({ code }) => [code, 1])),
    lang: locale.value,
    uniformColor: true,
    selectedCountries: props.selected,
    tooltipOnMissing: false,
    projectionScale: 1,
    projectionOffset: [0, 0],
    formatValue: (_value, code) => props.interactive
        ? t(props.selected.includes(code) ? 'ipHistory.MapUnselect' : 'ipHistory.MapSelect')
        : '',
    onCountryClick: props.interactive ? (code) => emit('toggle-country', code) : undefined,
}));
const { ready, failed } = useWorldMapChart({
    canvas, visible: expanded, options, theme: () => store.isDarkMode,
});
</script>
