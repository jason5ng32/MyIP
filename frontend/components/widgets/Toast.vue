<template>
    <div class="toast-container  p-3 jn-toast">
        <div id="toastInfoMask" class="toast" :class="{ 'dark-mode': isDarkMode }" role="alert" ref="toastEl"
            aria-live="assertive" aria-atomic="true">
            <div class="toast-header" :class="{ 'dark-mode-title': isDarkMode }">
                <strong class="me-auto" :class="alert.alertStyle">{{ alert.alertTitle }}</strong>
                <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
                    data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                {{ alert.alertMessage }}
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { Toast } from 'bootstrap';

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const alert = computed(() => store.alert);

const toastEl = ref(null);

// 监听 Pinia store 中的 alert 变化
watch(alert, (newVal) => {
    if (newVal.alertToShow) {
        showToast();
    }
}, { immediate: true, deep: true });

// 显示 Toast
const showToast = (duration = 2000) => {
    if (toastEl.value) {
        const toastInfoMask = new Toast(toastEl.value, {
            delay: duration
        });
        toastInfoMask.show();
    } else {
        console.error("Toast element not found");
    }
}

const adjustButtonPosition = () => {
    const screenWidth = window.innerWidth;
    const contentWidth = 1600; // 主内容区域的宽度
    const spaceOnRight = (screenWidth - contentWidth) / 2;

    const button = document.querySelector('.jn-toast');
    if (screenWidth > 1600) { // 只在屏幕宽度大于1600px时调整
        button.style.right = `${spaceOnRight + 0}px`; // 保持20px的距离
    } else {
        button.style.right = '0'; // 在小屏幕上使用默认位置
    }
}

onMounted(() => {
    window.addEventListener('resize', adjustButtonPosition);
    adjustButtonPosition();
});

</script>

<style scoped>
.jn-toast {
    position: fixed;
    z-index: 9999;
    right: 0;
    bottom: 0;
    margin-bottom: 2pt;
    margin-right: 40pt;
    max-width: 80vw;
}
</style>