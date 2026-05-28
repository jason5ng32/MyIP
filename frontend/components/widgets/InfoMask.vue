<template>
    <JnTooltip :text="t('Tooltips.InfoMask')" side="left">
        <Button v-show="showMaskButton"
            size="icon"
            type="button"
            variant="default"
            class="fixed bottom-[86px] z-1050 rounded-full shadow-lg cursor-pointer"
            :style="positionStyle"
            aria-label="Toggle Info Mask"
            @click="toggleInfoMask">
            <component :is="infoMaskLevel === 0 ? Eye : EyeOff" :size="16" />
        </Button>
    </JnTooltip>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
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

// Wide screen (>1600px) align to content area right (max-width 1600px), otherwise stick right 20px
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 18}px` };
    }
    return { right: '18px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };

onMounted(() => { window.addEventListener('resize', handleResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); });
</script>
