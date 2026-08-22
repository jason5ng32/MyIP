<!--
  Searchable country selector over the full ISO 3166-1 alpha-2 set, built on
  the shadcn-vue Combobox primitives. Names come from Intl.DisplayNames via
  data/country-name.js. All 249 countries are offered, virtualized — only the
  rows in view mount, so 249 inline flag SVGs never exist at once.
-->

<template>
    <Combobox v-model="selected" v-model:open="open" :disabled="disabled" ignore-filter>
        <ComboboxAnchor>
            <ComboboxTrigger :disabled="disabled">
                <span class="flex min-w-0 items-center gap-2">
                    <Icon v-if="modelValue" :icon="'circle-flags:' + modelValue.toLowerCase()"
                        class="size-4 shrink-0" />
                    <span class="truncate" :class="!modelValue && 'text-muted-foreground'">
                        {{ selectedName || placeholder }}
                    </span>
                </span>
            </ComboboxTrigger>
        </ComboboxAnchor>

        <ComboboxList>
            <ComboboxInput v-model="searchTerm" :placeholder="placeholder" />
            <template #items>
                <ComboboxEmpty v-if="!matches.length">{{ $t('personacheck.noCountryMatch') }}</ComboboxEmpty>
                <!-- Virtualized: `matches` is codes only, so the option value
                     stays the string the v-model speaks; names resolve per
                     rendered row. -->
                <ComboboxVirtualizer v-slot="{ option }" :options="matches" :estimate-size="32"
                    :text-content="(code) => nameOf(code)">
                    <ComboboxItem :value="option">
                        <Icon :icon="'circle-flags:' + option.toLowerCase()" class="size-4 shrink-0" />
                        <span class="truncate">{{ nameOf(option) }}<span
                                class="ms-1 font-mono text-muted-foreground">({{ option }})</span></span>
                    </ComboboxItem>
                </ComboboxVirtualizer>
            </template>
        </ComboboxList>
    </Combobox>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Icon } from '@iconify/vue';
import { ComboboxVirtualizer } from 'reka-ui';
import {
    Combobox, ComboboxAnchor, ComboboxTrigger, ComboboxInput,
    ComboboxList, ComboboxItem, ComboboxEmpty,
} from '@/components/ui/combobox';
import { ALPHA2_TO_NUMERIC } from '@/data/country-numeric.js';
import getCountryName from '@/data/country-name.js';

const props = defineProps({
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);

const { locale } = useI18n();

const open = ref(false);
const searchTerm = ref('');

// Rebuilt when the UI language changes, so the list is searchable in whatever
// language the visitor reads.
const allCountries = computed(() => Object.keys(ALPHA2_TO_NUMERIC)
    .map((code) => ({ code, name: getCountryName(code, locale.value) || code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale.value)));

const namesByCode = computed(() => new Map(
    allCountries.value.map(({ code, name }) => [code, name])));

const nameOf = (code) => namesByCode.value.get(code) || code;

const selectedName = computed(() => (props.modelValue ? nameOf(props.modelValue) : ''));

// Filtering is ours rather than the Combobox's built-in (hence ignore-filter),
// so a query can match either the localized name or the raw code — "Japan"
// and "JP" both find Japan. The term comes from ComboboxInput's own v-model.
const matches = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    const all = allCountries.value;
    const filtered = query
        ? all.filter(({ code, name }) =>
            name.toLowerCase().includes(query) || code.toLowerCase().startsWith(query))
        : all;
    return filtered.map(({ code }) => code);
});

const selected = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value ?? ''),
});

watch(open, (isOpen) => { if (!isOpen) searchTerm.value = ''; });
</script>
