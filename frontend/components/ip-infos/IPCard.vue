<template>
    <!-- IP Info Card -->
    <Card
        class="keyboard-shortcut-card jn-card flex flex-col h-full overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <!-- Card header: number badge + source + refresh -->
        <div class="flex items-center justify-between gap-2 px-4 py-2.5 bg-muted/50 border-b">
            <div class="flex items-center gap-2 min-w-0">
                <span
                    class="inline-flex items-center justify-center size-5 rounded-full bg-foreground text-background text-xs font-semibold shrink-0">
                    {{ index + 1 }}
                </span>
                <span class="text-sm font-medium truncate">
                    <span class="text-muted-foreground">{{ t('ipInfos.Source') }}:</span>
                    {{ card.source }}
                </span>
            </div>
            <JnTooltip :text="t('Tooltips.RefreshIPCard')" side="left">
                <Button size="icon" variant="outline" class="size-8 shrink-0 cursor-pointer"
                    @click="$emit('refresh-card', card, index)" :aria-label="'Refresh ' + card.source">
                    <RotateCw class="size-4" />
                </Button>
            </JnTooltip>
        </div>

        <!-- Main body in three states: normal / error / loading -->
        <div class="flex-1 flex flex-col">
            <template v-if="hasData">
                <!-- Monitor is inline inside FitText so it rides the IP's
                     first line; Copy stays a flex sibling so ellipsis
                     never clips it. -->
                <div class="px-4 py-3 flex items-start gap-2 min-w-0">
                    <FitText :text="card.ip" :tiers="HERO_TIERS" :max-lines="2" :title="card.ip"
                        class="font-mono font-semibold min-w-0 items-start">
                        <template #prefix >
                            <Monitor class="inline size-5 align-middle text-muted-foreground mr-2 mb-1" />
                        </template>
                    </FitText>
                    <CopyButton v-if="isValidIP(card.ip)" :value="card.ip"
                        :tooltip="t('Tooltips.CopyIP')"
                        :aria-label="'Copy ' + card.ip" />
                </div>

                <IpDetailPanel :data="card" :index="index" :ip-geo-source="ipGeoSource" :asn-infos="asnInfos"
                    :asn-history-infos="asnHistoryInfos" :asn-connectivity-infos="asnConnectivityInfos"
                    :configs="configs" :is-dark-mode="isDarkMode"
                    :enable-map="true" />
            </template>

            <!-- Error state -->
            <div v-else-if="isErrorState"
                class="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                <IPErrorIcon />
                <p class="text-sm text-primary font-medium">{{ card.ip }}</p>
            </div>

            <!-- Loading state: skeleton rows -->
            <div v-else class="flex-1 px-4 py-3 space-y-3">
                <div v-for="(w, i) in placeholderSizes" :key="i" class="h-4 bg-muted rounded animate-pulse"
                    :style="`width: ${(w / 12) * 100}%`"></div>
            </div>
        </div>
    </Card>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isValidIP } from '@/utils/valid-ip.js';
import FitText from '@/components/widgets/FitText.vue';
import { HERO_TIERS } from '@/composables/use-fit-text.js';
import IPErrorIcon from '../svgicons/IPError.vue';
import IpDetailPanel from './IpDetailPanel.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import CopyButton from '@/components/widgets/CopyButton.vue';
import {
    Monitor,
    RotateCw,
} from 'lucide-vue-next';

const { t } = useI18n();

const placeholderSizes = [12, 8, 6, 8, 4];

const props = defineProps({
    card: { type: Object, required: true },
    index: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true },
    isMobile: { type: Boolean, required: true },
    ipGeoSource: { type: Number, required: true },
    configs: { type: Object, required: true },
    asnInfos: { type: Object, required: true },
    asnHistoryInfos: { type: Object, default: () => ({}) },
    asnConnectivityInfos: { type: Object, default: () => ({}) }
});

defineEmits(['refresh-card']);

// Three state check: has data (normal) / error / loading
const hasData = computed(() =>
    Boolean(props.card.asn) || props.card.ip === '2001:4860:4860::8888'
);
const isErrorState = computed(() =>
    props.card.ip === t('ipInfos.IPv4Error') || props.card.ip === t('ipInfos.IPv6Error')
);
</script>
