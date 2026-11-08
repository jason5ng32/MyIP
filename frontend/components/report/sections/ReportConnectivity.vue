<template>
    <div class="overflow-x-auto">
        <table class="w-full text-xs">
            <thead>
                <tr class="border-b">
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Name') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Status') }}</th>
                    <th scope="col" :class="TH_RIGHT">{{ t('speedtest.Latency') }}</th>
                    <th scope="col" :class="TH_RIGHT">{{ t('mtrtest.ColBest') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                <tr v-for="target in section.targets" :key="target.id" class="hover:bg-muted/50 transition-colors">
                    <td class="px-3 py-2 whitespace-nowrap">{{ target.name }}</td>
                    <td class="px-3 py-2 whitespace-nowrap" :class="STATUS_META[target.status].tone">
                        {{ t(STATUS_META[target.status].key) }}
                    </td>
                    <td :class="TD_NUM">{{ target.timeMs ?? '—' }}</td>
                    <td :class="[TD_NUM, 'text-muted-foreground']">{{ target.minTimeMs ?? '—' }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
// Read-only renderer for the connectivity report section. The section stores
// locale-free status enums; they map back to the site's own status labels in
// the viewer's language.
import { useI18n } from 'vue-i18n';
import { TH_LEFT, TH_RIGHT, TD_NUM } from './table-classes.js';
import { CONNECTIVITY_STATUS_KEYS } from '@/utils/codes/connectivity-labels.js';

defineProps({ section: { type: Object, required: true } });
const { t } = useI18n();

const STATUS_META = {
    ok: { key: CONNECTIVITY_STATUS_KEYS.ok, tone: 'text-success' },
    unreachable: { key: CONNECTIVITY_STATUS_KEYS.unreachable, tone: 'text-destructive' },
    timeout: { key: CONNECTIVITY_STATUS_KEYS.timeout, tone: 'text-destructive' },
};
</script>
