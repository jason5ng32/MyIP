<template>
    <!-- IP 信息卡 — shadcn Card 架构，三个可能的主体：正常 / 错误 / 加载 -->
    <Card
        class="keyboard-shortcut-card jn-card flex flex-col h-full overflow-hidden transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
        <!-- 卡头：数字徽章 + 来源 + 刷新 -->
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

        <!-- 主体分三态：正常 / 错误 / 加载 -->
        <div class="flex-1 flex flex-col">
            <template v-if="hasData">
                <!-- Hero IP 区（带 Copy 按钮；Map 触发在 IpDetailPanel 内的 City 单元里） -->
                <div class="px-4 py-3 flex items-center gap-2 min-w-0">
                    <Monitor class="size-5 text-muted-foreground shrink-0" />
                    <span class="font-mono font-semibold whitespace-nowrap truncate min-w-0 min-h-5"
                        :class="heroIpSizeClass(card.ip)" :title="card.ip">{{ card.ip }}</span>
                    <JnTooltip v-if="isValidIP(card.ip)" :text="t('Tooltips.CopyIP')" side="left">
                        <button type="button"
                            class="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            @click="copyToClipboard(card.ip, card.id)" :aria-label="'Copy ' + card.ip">
                            <component :is="copiedStatus[card.id] ? ClipboardCheck : ClipboardPlus" class="size-4" />
                        </button>
                    </JnTooltip>
                </div>

                <IpDetailPanel :data="card" :index="index" :ip-geo-source="ipGeoSource" :asn-infos="asnInfos"
                    :configs="configs" :is-dark-mode="isDarkMode" :collapsed="isMobile && isCardsCollapsed"
                    :enable-map="true" />
            </template>

            <!-- 错误态 -->
            <div v-else-if="isErrorState"
                class="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
                <IPErrorIcon />
                <p class="text-sm text-destructive font-medium">{{ card.ip }}</p>
            </div>

            <!-- 加载态：skeleton rows -->
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
import { heroIpSizeClass } from '@/utils/hero-ip-size.js';
import IPErrorIcon from '../svgicons/IPError.vue';
import IpDetailPanel from './IpDetailPanel.vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    ClipboardCheck,
    ClipboardPlus,
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
    isCardsCollapsed: { type: Boolean, required: true },
    copiedStatus: { type: Object, required: true },
    configs: { type: Object, required: true },
    asnInfos: { type: Object, required: true }
});

defineEmits(['refresh-card']);

// 三态判定：有数据（正常）/ 错误 / 加载
// 原版是 `(card.asn) || card.ip === '2001:4860:4860::8888'`，后者是 masked-info 在 signed-out 时兜底的假 IP
const hasData = computed(() =>
    Boolean(props.card.asn) || props.card.ip === '2001:4860:4860::8888'
);
const isErrorState = computed(() =>
    props.card.ip === t('ipInfos.IPv4Error') || props.card.ip === t('ipInfos.IPv6Error')
);

const copyToClipboard = (ip, id) => {
    navigator.clipboard.writeText(ip).then(() => {
        props.copiedStatus[id] = true;
        setTimeout(() => { props.copiedStatus[id] = false; }, 5000);
    }).catch(err => {
        console.error('Copy error', err);
    });
};
</script>
