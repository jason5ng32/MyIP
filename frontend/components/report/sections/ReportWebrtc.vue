<template>
    <div class="overflow-x-auto">
        <table class="w-full text-xs">
            <thead>
                <tr class="border-b">
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Server') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.IP') }}</th>
                    <th scope="col" :class="TH_LEFT">NAT</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Location') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.ISP') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                <tr v-for="server in section.servers" :key="server.id" class="hover:bg-muted/50 transition-colors">
                    <td class="px-3 py-2 font-mono whitespace-nowrap">{{ server.url }}</td>
                    <td class="px-3 py-2 font-mono whitespace-nowrap">{{ server.ip || '—' }}</td>
                    <td class="px-3 py-2 whitespace-nowrap" :class="natTone(server.natType)">
                        {{ t(natTypeKey(server.natType)) }}
                    </td>
                    <td class="px-3 py-2"><GeoCell :code="server.countryCode" /></td>
                    <td class="px-3 py-2 text-muted-foreground">{{ server.org || '—' }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
// Read-only renderer for the webrtc report section. natType enums map back
// to the site's NAT labels; 'unavailable'/'error' reuse the status labels.
import { useI18n } from 'vue-i18n';
import GeoCell from './GeoCell.vue';
import { TH_LEFT } from './table-classes.js';
import { natTypeKey } from '@/utils/codes/webrtc-labels.js';

defineProps({ section: { type: Object, required: true } });
const { t } = useI18n();

// An exposed address is the finding here — anything that resolved reads
// as attention-worthy, unavailable (protective) as success-toned.
const natTone = (natType) => {
    if (natType === 'unavailable') return 'text-success';
    if (natType === 'error') return 'text-muted-foreground';
    return '';
};
</script>
