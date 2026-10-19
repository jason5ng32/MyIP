<template>
    <div class="overflow-x-auto">
        <table class="w-full text-xs">
            <thead>
                <tr class="border-b">
                    <th scope="col" :class="TH_LEFT">{{ t('adblocktest.report.Category') }}</th>
                    <th v-for="key in STATUS_KEYS" :key="key" scope="col" :class="TH_RIGHT">
                        {{ t(`adblocktest.count.${key}`) }}
                    </th>
                    <th scope="col" :class="TH_RIGHT">{{ t('adblocktest.report.Total') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                <tr v-for="group in section.groups" :key="group.id" class="hover:bg-muted/50 transition-colors">
                    <td class="px-3 py-2">{{ groupTitle(group.id) }}</td>
                    <td v-for="key in STATUS_KEYS" :key="key"
                        :class="[TD_NUM, group[key] > 0 ? textClass(statusTone(key)) : 'text-muted-foreground']">
                        {{ group[key] }}
                    </td>
                    <td :class="[TD_NUM, 'text-muted-foreground']">{{ group.total }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
// Read-only renderer for the Ad & Tracker Blocking Test report section: the
// request counts per category. Titles come from the tool's own i18n entries;
// an id the current list no longer knows renders as-is.
import { useI18n } from 'vue-i18n';
import { statusTone } from '@/utils/features/adblock-test.js';
import { useStatusTone } from '@/composables/use-status-tone.js';
import { TH_LEFT, TH_RIGHT, TD_NUM } from './table-classes.js';

defineProps({ section: { type: Object, required: true } });

const { t, te } = useI18n();
const { textClass } = useStatusTone();

const STATUS_KEYS = ['blocked', 'open', 'unknown'];

const groupTitle = (id) => {
    const key = `adblocktest.group.${id}.title`;
    return te(key) ? t(key) : id;
};
</script>
