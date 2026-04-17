<template>
    <div class="my-3">
        <!-- 进度条 -->
        <div class="flex h-4 w-full overflow-hidden rounded-lg border"
            :class="[isDarkMode ? 'border-neutral-100 bg-neutral-900' : 'border-neutral-500']"
            role="progressbar" :aria-label="`${leftLabel} ${leftValue}% vs ${rightLabel} ${rightValue}%`">
            <div class="h-full transition-all"
                :class="[isDarkMode ? 'bg-neutral-100' : 'bg-neutral-500']"
                :style="{ width: leftValue + '%' }"></div>
            <div class="h-full transition-all"
                :class="[isDarkMode ? 'bg-neutral-500' : 'bg-neutral-100']"
                :style="{ width: rightValue + '%' }"></div>
        </div>

        <!-- 文字标签 -->
        <div class="flex justify-between mt-0.5 text-sm">
            <span class="flex items-center">
                <Badge class="font-light rounded-full mr-1"
                    :class="isDarkMode ? 'bg-neutral-900 text-white border-transparent' : 'bg-neutral-100 text-neutral-900 border-transparent'">
                    {{ t('ipInfos.ASNInfo.' + leftLabel) }}
                </Badge>
                <span class="font-bold">{{ leftValue }}%</span>
            </span>
            <span class="flex items-center">
                <Badge class="font-light rounded-full mr-1"
                    :class="isDarkMode ? 'bg-neutral-900 text-white border-transparent' : 'bg-neutral-100 text-neutral-900 border-transparent'">
                    {{ t('ipInfos.ASNInfo.' + rightLabel) }}
                </Badge>
                <span class="font-bold">{{ rightValue }}%</span>
            </span>
        </div>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Badge } from '@/components/ui/badge';

defineProps({
    leftLabel: { type: String, required: true },
    leftValue: { type: Number, required: true },
    rightLabel: { type: String, required: true },
    rightValue: { type: Number, required: true },
    isDarkMode: { type: Boolean, required: true }
});

const { t } = useI18n();
</script>
