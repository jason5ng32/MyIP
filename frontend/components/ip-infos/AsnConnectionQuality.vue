<!-- Connection quality of an AS (Cloudflare speed-test aggregates): a titled
     two-column grid of whichever of download / upload / latency / jitter the
     Radar ASN summary carries. `info` is that summary (`/api/cfradar?view=asn`);
     renders nothing when no field is present. -->
<template>
    <div v-if="Object.keys(qualityInfo).length" class="space-y-2 pt-1">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{{ t('ipInfos.ASNInfo.connectionQuality') }}</span>
            <JnTooltip :text="t('ipInfos.ASNInfo.connectionQualityTooltip')" side="top"
                class="hidden md:block">
                <CircleQuestionMark class="size-3 cursor-help opacity-70" />
            </JnTooltip>
        </div>
        <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div v-for="(item, key) in qualityInfo" :key="key">
                <dt class="text-xs text-muted-foreground mb-0.5">{{ t(`ipInfos.ASNInfo.${key}`) }}</dt>
                <dd class="font-normal wrap-break-word">{{ item }}</dd>
            </div>
        </dl>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { pickConnectionQuality } from '@/utils/ip/asn-metrics.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { CircleQuestionMark } from '@lucide/vue';

const props = defineProps({
    info: { type: Object, default: null },
});

const { t } = useI18n();

const qualityInfo = computed(() => pickConnectionQuality(props.info));
</script>
