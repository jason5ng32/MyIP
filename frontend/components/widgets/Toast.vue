<template>
    <Sonner />
</template>

<script setup>
// 重构于 refactor/01 阶段 B：Bootstrap Toast → vue-sonner
// 对外契约不变：组件挂载一次，监听 store.alert，调用 store.setAlert(...) 即弹出
import { computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { Sonner, toast } from '@/components/ui/sonner';

const store = useMainStore();
const alert = computed(() => store.alert);

// 将旧的 alertStyle（Bootstrap text-* 类名）映射为 sonner 的方法
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
