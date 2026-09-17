<template>
    <div class="overflow-x-auto">
        <table class="w-full text-xs">
            <thead>
                <tr class="border-b">
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Provider') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.IP') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Location') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.ISP') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                <tr v-for="(provider, index) in section.providers" :key="`${provider.id}:${index}`" class="hover:bg-muted/50 transition-colors">
                    <td class="px-3 py-2 whitespace-nowrap">{{ provider.name }}</td>
                    <td class="px-3 py-2 font-mono whitespace-nowrap">{{ provider.ip }}</td>
                    <td class="px-3 py-2"><GeoCell :code="provider.countryCode" /></td>
                    <td class="px-3 py-2 text-muted-foreground">{{ provider.org || '—' }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
// Read-only renderer for the dnsleak report section: the DNS resolver egress
// IPs that answered the sharer's lookups.
import { useI18n } from 'vue-i18n';
import GeoCell from './GeoCell.vue';
import { TH_LEFT } from './table-classes.js';

defineProps({ section: { type: Object, required: true } });
const { t } = useI18n();
</script>
