<!-- Traffic shares of an AS: a titled stack of DataPairBar rows (IPv4/IPv6,
     HTTP/HTTPS, desktop/mobile, human/bot). `info` is the Radar ASN summary
     (`/api/cfradar?view=asn`); a pair shows only when both sides parse, and
     nothing renders when none does. -->
<template>
    <div v-if="pairDataList.length" class="space-y-2.5 pt-1">
        <div class="text-xs text-muted-foreground">
            {{ t('ipInfos.ASNInfo.trafficPercentage') }}
        </div>
        <DataPairBar v-for="pair in pairDataList" :key="pair.leftLabel" :leftLabel="pair.leftLabel"
            :leftValue="pair.leftValue" :rightLabel="pair.rightLabel" :rightValue="pair.rightValue" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildTrafficPairs } from '@/utils/ip/asn-metrics.js';
import DataPairBar from './DataPairBar.vue';

const props = defineProps({
    info: { type: Object, default: null },
});

const { t } = useI18n();

const pairDataList = computed(() => buildTrafficPairs(props.info));
</script>
