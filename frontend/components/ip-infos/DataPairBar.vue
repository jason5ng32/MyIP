<template>
    <!-- 左右双值 bar：用 foreground / muted-foreground 形成对比，自动适配明暗模式 -->
    <div>
        <div class="flex h-2 w-full overflow-hidden rounded-full border border-border"
            role="progressbar"
            :aria-label="`${leftLabel} ${leftValue}% vs ${rightLabel} ${rightValue}%`">
            <div class="h-full bg-foreground transition-all" :style="{ width: leftValue + '%' }"></div>
            <div class="h-full bg-muted-foreground/40 transition-all" :style="{ width: rightValue + '%' }"></div>
        </div>
        <div class="flex justify-between mt-1 text-xs">
            <span class="flex items-center gap-1.5">
                <span class="size-2 rounded-full bg-foreground"></span>
                <span class="text-muted-foreground">{{ t('ipInfos.ASNInfo.' + leftLabel) }}</span>
                <span class="font-medium tabular-nums">{{ leftValue }}%</span>
            </span>
            <span class="flex items-center gap-1.5">
                <span class="font-medium tabular-nums">{{ rightValue }}%</span>
                <span class="text-muted-foreground">{{ t('ipInfos.ASNInfo.' + rightLabel) }}</span>
                <span class="size-2 rounded-full bg-muted-foreground/40"></span>
            </span>
        </div>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
    leftLabel: { type: String, required: true },
    leftValue: { type: Number, required: true },
    rightLabel: { type: String, required: true },
    rightValue: { type: Number, required: true },
});

const { t } = useI18n();
</script>
