<template>
    <div class="toast-container position-fixed bottom-0 end-0 p-3 jn-toast">
        <div id="toastInfoMask" class="toast" :class="{ 'dark-mode': isDarkMode }" role="alert" ref="toast"
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

<script>
import { computed } from 'vue';
import { useMainStore } from '@/store';
import { Toast } from 'bootstrap';

export default {
    setup() {
        const store = useMainStore();
        const isDarkMode = computed(() => store.isDarkMode);
        const isMobile = computed(() => store.isMobile);
        const alert = computed(() => store.alert);

        return {
            store,
            isDarkMode,
            isMobile,
            alert,
        };
    },
    methods: {
        showToast(duration = 2000) {
            const toastEl = this.$refs.toast;
            if (toastEl) {
                const toastInfoMask = new Toast(toastEl, {
                    delay: duration
                });
                toastInfoMask.show();
            } else {
                console.error("Toast element not found");
            }
        }
    },
    watch: {
        alert: {
            handler(newVal) {
                if (newVal.alertToShow) {
                    this.showToast();
                }
            },
            immediate: true,
            deep: true
        }
    }
};
</script>

<style scoped></style>