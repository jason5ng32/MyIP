<template>
    <!-- Thin app shell: the globals every route shares (Nav, account and
    preferences dialogs, tooltip context, toast host, PWA prompt, theme).
    Home and ToolPage stay alive, so coming back neither re-runs the tests nor
    loses a tool's state; keyed by route name, every tool route shares one
    ToolPage, which caches each tool per slug itself. -->
    <TooltipProvider :delay-duration="150">
        <NavBar />
        <router-view v-slot="{ Component, route: viewRoute }">
            <KeepAlive :include="['Home', 'ToolPage']">
                <component :is="Component" :key="viewRoute.name" />
            </KeepAlive>
        </router-view>
        <!-- Dialog hosts for the Nav's account menu and the tools' quota hints. -->
        <User />
        <Preferences />
        <Alert />
        <DocsAssistant />
        <PWA v-if="offerPwaInstall" />
    </TooltipProvider>
</template>

<script setup>
import { watch, ref, onMounted, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import NavBar from '@/components/Nav.vue';
import Alert from '@/components/widgets/Toast.vue';
import DocsAssistant from '@/components/widgets/DocsAssistant.vue';
import { shouldOfferPwaInstall } from '@/utils/pwa.js';
import { sendVisitBeacon } from '@/utils/features/pulse-beacon.js';
import { useTheme } from '@/composables/use-theme.js';
import { useMainStore } from '@/store';

// PWA install prompt — async and eligibility-gated: ineligible visits (too
// few 12h-deduped uses, prompt cap reached, already installed) never load
// pwa-install or trigger its manifest fetch; eligible ones load it at the
// prompt's 30s mark.
const PWA = defineAsyncComponent(() => import('@/components/widgets/PWA.vue'));
// Dialogs nothing shows on first paint: their code stays off the boot path.
const User = defineAsyncComponent(() => import('@/components/User.vue'));
const Preferences = defineAsyncComponent(() => import('@/components/widgets/Preferences.vue'));
const offerPwaInstall = ref(false);
onMounted(() => {
    if (shouldOfferPwaInstall()) {
        setTimeout(() => { offerPwaInstall.value = true; }, 30 * 1000);
    }
    // Earth Online visit tick — app-level so every route counts, once per
    // page load; the backend dedups per IP (utils/features/pulse-beacon.js).
    sendVisitBeacon();
});
import { useAchievementEngine } from '@/composables/use-achievement-engine.js';
import { useReportCollector } from '@/composables/use-report-collector.js';
import { useAppPersonaCollector } from '@/composables/use-persona-collector.js';

// A page change closes store.openSheet: a site-wide sheet would stay open over
// the next page, and one a left page hosted would reopen when it returns.
const store = useMainStore();
const route = useRoute();
watch(() => route.path, () => {
    if (store.openSheet) store.setOpenSheet(null);
});

// Pre-Vue boot overlay → real app hand-off. CSS lives in index.html.
// #app is revealed IMMEDIATELY at mount: it fades in underneath the opaque
// overlay while the overlay plays its exit (text fade → logo shrink →
// removal). Runs once at root mount, whichever page loads first.
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

// Persona collector: same bus, different consumer — keeps the normalized
// snapshots the Persona Check cross-references, so opening the tool costs no
// re-run of tests the visitor already went through.
useAppPersonaCollector();
</script>

<style scoped></style>
