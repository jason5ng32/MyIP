<template>
    <div class="toast-container position-fixed bottom-0 end-0 p-3 jn-toast">
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
import { computed, ref, watch } from 'vue';
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
</script>

<style scoped></style>