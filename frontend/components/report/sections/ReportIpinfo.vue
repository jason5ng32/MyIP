<template>
    <div class="overflow-x-auto">
        <table class="w-full text-xs">
            <thead>
                <tr class="border-b">
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Source') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.IP') }}</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.Location') }}</th>
                    <th v-if="has.timezone" scope="col" :class="TH_LEFT">{{ t('ipInfos.TimeZone') }}</th>
                    <th scope="col" :class="TH_LEFT">ASN</th>
                    <th scope="col" :class="TH_LEFT">{{ t('reportPage.Col.ISP') }}</th>
                    <th v-if="has.anonymity" scope="col" :class="TH_LEFT">{{ t('ipInfos.anonymity.label') }}</th>
                    <th v-if="has.ipType" scope="col" :class="TH_LEFT">{{ t('ipInfos.type') }}</th>
                    <th v-if="has.nativeIP" scope="col" :class="TH_LEFT">{{ t('ipInfos.advancedData.Nativeness') }}</th>
                    <th v-if="has.qualityScore" scope="col" :class="TH_RIGHT">{{ t('ipInfos.qualityScore') }}</th>
                </tr>
            </thead>
            <tbody class="divide-y">
                <tr v-for="card in section.cards" :key="card.source + card.ip" class="hover:bg-muted/50 transition-colors">
                    <td class="px-3 py-2 whitespace-nowrap">{{ card.source }}</td>
                    <td class="px-3 py-2 font-mono whitespace-nowrap">{{ card.ip }}</td>
                    <td class="px-3 py-2">
                        <GeoCell :code="card.countryCode" :detail="[card.region, card.city].filter(Boolean).join(' · ')" />
                    </td>
                    <td v-if="has.timezone" class="px-3 py-2 whitespace-nowrap">
                        {{ card.timezone || '—' }}
                    </td>
                    <td class="px-3 py-2 font-mono tabular-nums text-muted-foreground whitespace-nowrap">{{ card.asn || '—' }}</td>
                    <td class="px-3 py-2 text-muted-foreground">{{ card.isp || '—' }}</td>
                    <td v-if="has.anonymity" class="px-3 py-2 whitespace-nowrap">
                        <template v-if="card.anonymity">
                            <span :class="card.anonymity === 'none' ? 'text-success' : 'text-warning'">
                                {{ t(ANONYMITY_I18N_KEYS[card.anonymity]) }}
                            </span>
                            <span v-if="card.anonymityProvider || card.anonymityProtocol" class="ml-1 text-muted-foreground">
                                {{ [card.anonymityProvider, card.anonymityProtocol].filter(Boolean).join(' · ') }}
                            </span>
                        </template>
                        <span v-else class="text-muted-foreground">—</span>
                    </td>
                    <td v-if="has.ipType" class="px-3 py-2 whitespace-nowrap">
                        {{ card.ipType ? t(TYPE_KEYS[card.ipType]) : '—' }}
                    </td>
                    <td v-if="has.nativeIP" class="px-3 py-2 whitespace-nowrap">
                        <span v-if="card.nativeIP === undefined" class="text-muted-foreground">—</span>
                        <span v-else :class="card.nativeIP ? 'text-success' : 'text-warning'">
                            {{ t(card.nativeIP ? 'ipInfos.advancedData.NativeIPYes' : 'ipInfos.advancedData.NativeIPNo') }}
                        </span>
                    </td>
                    <td v-if="has.qualityScore" :class="TD_NUM">
                        {{ card.qualityScore != null ? `${card.qualityScore}/100` : '—' }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script setup>
// Read-only renderer for the ipinfo report section: one row per IP source.
// The IPCheck.ing-source enrichment columns (anonymity verdict, line type,
// ASN-geo match, quality score) appear only when at least one card carries
// them — enums map back to the IP card's own labels in the viewer's locale.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import GeoCell from './GeoCell.vue';
import { TH_LEFT, TH_RIGHT, TD_NUM } from './table-classes.js';
// Anonymity verdict code → the IP card's own label.
import { ANONYMITY_I18N_KEYS } from '@/utils/transform-ip-data.js';

const props = defineProps({ section: { type: Object, required: true } });
const { t } = useI18n();

const TYPE_KEYS = {
    business: 'ipInfos.advancedData.type.Business',
    residential: 'ipInfos.advancedData.type.Residential',
    wireless: 'ipInfos.advancedData.type.Wireless',
    hosting: 'ipInfos.advancedData.type.Hosting',
};

const has = computed(() => ({
    timezone: props.section.cards.some((card) => card.timezone !== undefined),
    anonymity: props.section.cards.some((card) => card.anonymity !== undefined),
    ipType: props.section.cards.some((card) => card.ipType !== undefined),
    nativeIP: props.section.cards.some((card) => card.nativeIP !== undefined),
    qualityScore: props.section.cards.some((card) => card.qualityScore !== undefined),
}));
</script>
