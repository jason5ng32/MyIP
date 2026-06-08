<template>
  <!-- Thin app shell: only the globals that must exist on every route live
       here (tooltip context, toast host, PWA install prompt, theme). The
       homepage and the standalone tool pages are swapped in via <router-view>. -->
  <TooltipProvider :delay-duration="150">
    <router-view />
    <Alert />
    <PWA />
  </TooltipProvider>
</template>

<script setup>
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { TooltipProvider } from './components/ui/tooltip';
import Alert from './components/widgets/Toast.vue';
import PWA from './components/widgets/PWA.vue';
import { useTheme } from '@/composables/use-theme.js';

// Standalone tool pages drop the homepage's fixed-Nav body padding (see the
// `body.jn-standalone-page` rule in index.html). Toggle the marker class as the
// route changes so the override applies on the /tools/:slug route only.
const route = useRoute();
watch(
    () => route.name === 'tool',
    (isStandalone) => {
        document.body.classList.toggle('jn-standalone-page', isStandalone);
    },
    { immediate: true },
);

// Pre-Vue boot overlay → real app hand-off. CSS lives in index.html.
// Stages: text fade → logo shrink → remove overlay + reveal #app.
// Runs once at root mount, so it covers both the homepage and a fresh load of
// a standalone tool page.
const loadingElement = document.getElementById('jn-loading');
const appElement = document.getElementById('app');

const revealApp = () => {
    document.documentElement.removeAttribute('data-booting');
    if (appElement) {
        requestAnimationFrame(() => appElement.classList.add('jn-app-enter'));
    }
};

if (loadingElement) {
    requestAnimationFrame(() => loadingElement.classList.add('jn-loading-stage-1'));
    setTimeout(() => loadingElement.classList.add('jn-loading-stage-2'), 160);
    setTimeout(() => {
        loadingElement.remove();
        revealApp();
    }, 380);
} else {
    // Overlay already gone (e.g. HMR remount) — still reveal the app.
    revealApp();
}

// Theme orchestration: initial apply, OS flip listener, preference watcher.
useTheme();
</script>

<style scoped></style>
