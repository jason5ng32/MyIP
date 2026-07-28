<template>
  <!-- Thin app shell: only the globals that must exist on every route live
       here (tooltip context, toast host, PWA install prompt, theme). The
       homepage and the standalone tool pages are swapped in via <router-view>. -->
  <TooltipProvider :delay-duration="150">
    <router-view />
    <Alert />
    <DocsAssistant />
    <PWA v-if="offerPwaInstall" />
  </TooltipProvider>
</template>

<script setup>
import { watch, ref, onMounted, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import Alert from '@/components/widgets/Toast.vue';
import DocsAssistant from '@/components/widgets/DocsAssistant.vue';
import { shouldOfferPwaInstall } from '@/utils/pwa.js';
import { useTheme } from '@/composables/use-theme.js';

// PWA install prompt — async and eligibility-gated: ineligible visits (first
// visit, prompt cap reached, already installed) never load pwa-install or
// trigger its manifest fetch; eligible ones load it at the prompt's 30s mark.
const PWA = defineAsyncComponent(() => import('@/components/widgets/PWA.vue'));
const offerPwaInstall = ref(false);
onMounted(() => {
    if (shouldOfferPwaInstall()) {
        setTimeout(() => { offerPwaInstall.value = true; }, 30 * 1000);
    }
});
import { useAchievementEngine } from '@/composables/use-achievement-engine.js';
import { useReportCollector } from '@/composables/use-report-collector.js';

// The standalone pages (/tools/:slug, /privacy) carry their own header, so they
// drop the homepage's fixed-Nav body padding (see the `body.jn-standalone-page`
// rule in index.html) — otherwise a blank strip shows above their header. Toggle
// the marker class as the route changes. NB: "standalone" here is unrelated to
// PWA display mode — that's `isRunningAsPwa()` in utils/pwa.js.
const STANDALONE_ROUTES = new Set(['tool', 'privacy', 'report']);
const route = useRoute();
watch(
    () => STANDALONE_ROUTES.has(route.name),
    (isStandalone) => {
        document.body.classList.toggle('jn-standalone-page', isStandalone);
    },
    { immediate: true },
);

// Pre-Vue boot overlay → real app hand-off. CSS lives in index.html.
// #app is revealed IMMEDIATELY at mount: it fades in underneath the opaque
// overlay while the overlay plays its exit (text fade → logo shrink →
// removal). 
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

revealApp();
if (loadingElement) {
    requestAnimationFrame(() => loadingElement.classList.add('jn-loading-stage-1'));
    loadingElement.classList.add('jn-loading-stage-2');
    setTimeout(() => loadingElement.remove(), 200);
}

// Theme orchestration: initial apply, OS flip listener, preference watcher.
useTheme();

// Achievement engine: listens for domain events emitted across the app and
// evaluates the rules in data/achievement-rules.js.
useAchievementEngine();

// Report collector: keeps the latest schema-shaped snapshot of every finished
// test for the shareable diagnostic report.
useReportCollector();
</script>

<style scoped></style>
