<template>
    <span class="inline-flex items-center gap-1.5 min-w-0">
        <Icon v-if="code" :icon="'circle-flags:' + code.toLowerCase()" class="size-3.5 shrink-0" />
        <span class="truncate">{{ display }}</span>
    </span>
</template>

<script setup>
// Flag + localized country name (+ optional "region · city" detail) — the
// standard geo cell used across the report tables. Country names resolve in
// the VIEWER's locale via Intl (utils/country-name.js).
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import { useMainStore } from '@/store';
import getCountryName from '@/utils/country-name.js';

const props = defineProps({
    code: { type: String, default: '' },
    detail: { type: String, default: '' },
});

const store = useMainStore();
const display = computed(() => {
    const name = props.code ? (getCountryName(props.code, store.lang) || props.code) : '';
    return [name, props.detail].filter(Boolean).join(' · ') || '—';
});
</script>
