<template>
    <JnTooltip :text="t('Tooltips.InfoMask')" side="left">
        <Button v-show="showMaskButton"
            size="icon"
            type="button"
            variant="default"
            class="rounded-full shadow-lg cursor-pointer"
            aria-label="Toggle Info Mask"
            @click="toggleInfoMask">
            <component :is="infoMaskLevel === 0 ? Eye : EyeOff" :size="16" />
        </Button>
    </JnTooltip>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { Eye, EyeOff } from '@lucide/vue';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const { showMaskButton, infoMaskLevel, toggleInfoMask } = defineProps({
    showMaskButton: Boolean,
    infoMaskLevel: Number,
    toggleInfoMask: Function,
});
</script>
