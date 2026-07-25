<template>
    <div class="space-y-4">
        <div class="sticky top-0 z-10 -mt-3 pt-3 bg-card pb-1.5 text-xs text-muted-foreground">
            {{ t('globalping.Selected') }}
            <span :class="max && modelValue.length > max ? 'text-destructive font-semibold' : ''">{{
                modelValue.length }}</span><template v-if="max">/{{ max }}</template>
        </div>

        <div v-for="section in allSections" :key="section.key" class="space-y-2">
            <!-- Section header doubles as select-all (indeterminate when partial) -->
            <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox :model-value="sectionState(section)" :disabled="disabled"
                    @update:model-value="(v) => toggleSection(section, v)">
                    <Minus v-if="sectionState(section) === 'indeterminate'" class="size-3" />
                    <Check v-else class="size-3.5" />
                </Checkbox>
                {{ section.label }}
            </label>
            <div class="flex flex-col gap-1.5 pl-6">
                <label v-for="cc in section.countries" :key="section.key + '-' + cc"
                    class="flex items-center gap-2 text-sm min-w-0"
                    :class="countryDisabled(cc) ? 'opacity-50' : 'cursor-pointer'"
                    :title="!isChecked(cc) && !hasProbes(cc) ? t('globalping.NoProbe') : ''">
                    <Checkbox :model-value="isChecked(cc)" :disabled="countryDisabled(cc)"
                        @update:model-value="(v) => setCountry(cc, v)" />
                    <Icon :icon="'circle-flags:' + cc.toLowerCase()" class="shrink-0 size-3.5" />
                    <span class="truncate">{{ countryName(cc) }}</span>
                </label>
            </div>
        </div>
    </div>
</template>

<script setup>
// Reusable country picker for Globalping-backed tools (MtrTest /
// GlobalLatencyTest / CensorshipCheck): the caller's suggestion sections on
// top, followed by the full per-continent catalog of countries that
// currently have an online probe (from the session-cached inventory). All
// sections share one selection (v-model) — a country listed in several
// sections is one entry, every matching checkbox reflects it.
//
// Selecting is never hard-capped: past `max` the tally numerator turns red
// and the parent is expected to gate its run button. Suggested countries
// without an online probe are disabled up front; while the inventory loads
// everything stays enabled (fail-open — Globalping partially allocates, so
// a stale "available" only costs one empty location).
import { ref, computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { getProbeInventory } from '@/utils/globalping-probes.js';
import getCountryName from '@/data/country-name.js';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@iconify/vue';
import { Check, Minus } from '@lucide/vue';

const props = defineProps({
    // Suggestion sections shown above the continent catalog:
    // [{ key, label, countries }] — label arrives pre-translated.
    sections: { type: Array, default: () => [] },
    // Selected country codes (shared across all sections).
    modelValue: { type: Array, required: true },
    disabled: { type: Boolean, default: false },
    // Soft cap: colors the tally, never blocks checking.
    max: { type: Number, default: null },
});
const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const countryName = (cc) => getCountryName(cc, lang.value);

const CONTINENT_LABEL_KEYS = {
    asia: 'Asia',
    europe: 'Europe',
    africa: 'Africa',
    americas: 'Americas',
    oceania: 'Oceania',
};

const inventory = ref(null);
onMounted(() => {
    getProbeInventory()
        .then((data) => { inventory.value = data; })
        .catch(() => { /* keep fail-open */ });
});
const hasProbes = (cc) => inventory.value === null || inventory.value.countries.has(cc);

const allSections = computed(() => [
    ...props.sections,
    ...(inventory.value?.continents || []).map((c) => ({
        key: 'continent-' + c.key,
        label: t('globalping.' + CONTINENT_LABEL_KEYS[c.key]),
        countries: c.countries,
    })),
]);

const isChecked = (cc) => props.modelValue.includes(cc);
const countryDisabled = (cc) => props.disabled || (!isChecked(cc) && !hasProbes(cc));
const setCountry = (cc, checked) => {
    if (checked) {
        if (!isChecked(cc) && !countryDisabled(cc)) {
            emit('update:modelValue', [...props.modelValue, cc]);
        }
    } else {
        emit('update:modelValue', props.modelValue.filter((c) => c !== cc));
    }
};

// Section-level select-all operates on the section's probe-having countries.
const sectionSelectable = (section) => section.countries.filter(hasProbes);
const sectionState = (section) => {
    const selectable = sectionSelectable(section);
    if (selectable.length > 0 && selectable.every(isChecked)) return true;
    return section.countries.some(isChecked) ? 'indeterminate' : false;
};
const toggleSection = (section, checked) => {
    if (props.disabled) return;
    if (checked === true) {
        const missing = sectionSelectable(section).filter((cc) => !isChecked(cc));
        emit('update:modelValue', [...props.modelValue, ...missing]);
    } else {
        const drop = new Set(section.countries);
        emit('update:modelValue', props.modelValue.filter((cc) => !drop.has(cc)));
    }
};
</script>
