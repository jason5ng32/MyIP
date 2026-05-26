// Theme orchestrator. Reads userPreferences.theme + OS color-scheme,
// resolves the effective dark state, and pushes it to the store and
// body class. Reacts to OS theme flips and preference changes. Mount
// once at the app root (App.vue) — multiple instances would attach
// duplicate listeners.

import { onMounted, onUnmounted, watch } from 'vue';
import { useMainStore } from '@/store';

export function useTheme() {
    const store = useMainStore();
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
        const theme = store.userPreferences.theme;
        const isDark =
            theme === 'dark' ||
            (theme === 'auto' && mediaQueryList.matches);
        store.setDarkMode(isDark);
        document.body.classList.toggle('body-dark-mode', isDark);
    };

    const handleMediaChange = () => applyTheme();

    onMounted(() => {
        mediaQueryList.addEventListener('change', handleMediaChange);
        applyTheme();
    });

    onUnmounted(() => {
        mediaQueryList.removeEventListener('change', handleMediaChange);
    });

    watch(() => store.userPreferences.theme, applyTheme);
}
