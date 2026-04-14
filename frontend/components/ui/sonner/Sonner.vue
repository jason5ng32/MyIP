<script setup>
// shadcn-vue 风格的 Sonner 包装：暗色模式从 Pinia store 同步
// 见 refactor/01 阶段 B
import { computed } from 'vue';
import { Toaster } from 'vue-sonner';
import { useMainStore } from '@/store';

import 'vue-sonner/style.css';

const store = useMainStore();
const theme = computed(() => (store.isDarkMode ? 'dark' : 'light'));
</script>

<template>
  <Toaster
    :theme="theme"
    position="bottom-right"
    rich-colors
    close-button
  />
</template>
