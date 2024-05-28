<template>
    <button v-show="showMaskButton" class="btn infomask"
        :class="infoMaskLevel === 0 ? 'btn-success' : infoMaskLevel === 1 ? 'btn-warning' : 'btn-secondary'"
        @click="toggleInfoMask" aria-label="Toggle Info Mask"
        v-tooltip="t('Tooltips.InfoMask')">
        <i :class="infoMaskLevel === 0 ? 'bi bi-eye' : 'bi bi-eye-slash'"></i>
    </button>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

const {t} = useI18n();

const { showMaskButton, infoMaskLevel, toggleInfoMask } = defineProps({
    showMaskButton: Boolean,
    infoMaskLevel: Number,
    toggleInfoMask: Function,
});

const adjustButtonPosition = () => {
    const screenWidth = window.innerWidth;
    const contentWidth = 1600; // 主内容区域的宽度
    const spaceOnRight = (screenWidth - contentWidth) / 2;

    const button = document.querySelector('.infomask');
    if (screenWidth > 1600) { // 只在屏幕宽度大于1600px时调整
        button.style.right = `${spaceOnRight + 20}px`; // 保持20px的距离
    } else {
        button.style.right = '20px'; // 在小屏幕上使用默认位置
    }
}

onMounted(() => {
    window.addEventListener('resize', adjustButtonPosition);
    adjustButtonPosition();
});


</script>

<style scoped>
.infomask {
    position: fixed;
    bottom: 66px; 
    right: 20px; 
    z-index: 1050;
}
</style>