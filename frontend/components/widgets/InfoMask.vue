<template>
    <JnTooltip :text="t('Tooltips.InfoMask')" side="left">
        <Button v-show="showMaskButton"
            size="icon"
            type="button"
            class="fixed bottom-[66px] z-[1050]"
            :class="stateClasses"
            :style="positionStyle"
            aria-label="Toggle Info Mask"
            @click="toggleInfoMask">
            <i :class="infoMaskLevel === 0 ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
        </Button>
    </JnTooltip>
</template>

<script setup>
// refactor/01 阶段 C.2：基于 shadcn-vue Button (size="icon") + 内联 Tailwind
// 状态色，避免自己从头写 <button>。Button 无 success/warning 变体，因此
// 背景色由 :class 响应 infoMaskLevel 覆盖 default 变体的 bg-primary。
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const { t } = useI18n();

const { showMaskButton, infoMaskLevel, toggleInfoMask } = defineProps({
    showMaskButton: Boolean,
    infoMaskLevel: Number,
    toggleInfoMask: Function,
});

// 三态颜色 —— 对照旧版 btn-success / btn-warning / btn-secondary
const stateClasses = computed(() => ({
    'bg-green-600 text-white hover:bg-green-700': infoMaskLevel === 0,
    'bg-yellow-500 text-neutral-900 hover:bg-yellow-600': infoMaskLevel === 1,
    'bg-neutral-500 text-white hover:bg-neutral-600': infoMaskLevel === 2,
}));

// 超宽屏（>1600px）时对齐到内容区右侧（max-width 1600px），否则贴右 20px
const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0);
const positionStyle = computed(() => {
    if (screenWidth.value > 1600) {
        const spaceOnRight = (screenWidth.value - 1600) / 2;
        return { right: `${spaceOnRight + 20}px` };
    }
    return { right: '20px' };
});
const handleResize = () => { screenWidth.value = window.innerWidth; };

onMounted(() => { window.addEventListener('resize', handleResize); });
onBeforeUnmount(() => { window.removeEventListener('resize', handleResize); });
</script>
