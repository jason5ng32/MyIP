<template>
    <Sonner 
    position="bottom-left"
    />
</template>

<script setup>
import { computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { Sonner, toast } from '@/components/ui/sonner';

const store = useMainStore();
const alert = computed(() => store.alert);

// Map old alertStyle (Bootstrap text-* class names) to sonner methods
const STYLE_TO_TOAST = {
    'text-success': toast.success,
    'text-warning': toast.warning,
    'text-danger': toast.error,
    'text-info': toast.info,
};

watch(alert, (newVal) => {
    if (!newVal || !newVal.alertToShow) {
        return;
    }
    const fn = STYLE_TO_TOAST[newVal.alertStyle] || toast.message;
    fn(newVal.alertTitle, {
        description: newVal.alertMessage,
        duration: newVal.alertDuration || 2000,
    });
}, { deep: true });
</script>
