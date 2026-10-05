<template>
    <!-- Thin app shell: only the globals that must exist on every route live
    here (the site Nav, the account and preferences dialogs, tooltip context,
    toast host, PWA install prompt, theme). Pages swap in via <router-view>
    below the fixed Nav (index.html pads the body for it); the homepage and
    the tool page stay alive in the KeepAlive (never evicted), so leaving and
    coming back neither re-runs the homepage tests nor loses a tool's state. Every tool route shares the one
    ToolPage instance (key 'tool'), which caches each tool per slug itself.
    Cached pages pause while hidden — see composables/use-route-active.js. -->
    <TooltipProvider :delay-duration="150">
        <NavBar />
        <router-view v-slot="{ Component, route: viewRoute }">
            <KeepAlive :include="['Home', 'ToolPage']">
                <component :is="Component" :key="viewRoute.name === 'tool' ? 'tool' : viewRoute.name" />
            </KeepAlive>
        </router-view>
        <!-- Dialog hosts for the Nav's account menu and the sign-in tools'
             quota hints: Benefits & Usage, Preferences. One each, site-wide. -->
        <User />
        <Preferences />
        <Alert />
        <DocsAssistant />
        <PWA v-if="offerPwaInstall" />
        <!-- TEMPORARY: ?debug=nav diagnostic overlay (widgets/NavDebug.vue). -->
        <NavDebug v-if="navDebug" />
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
// TEMPORARY diagnostic overlay for the iOS Nav animation stall: ?debug=nav
// turns it on (kept in localStorage), ?debug=off turns it off.
const NavDebug = defineAsyncComponent(() => import('@/components/widgets/NavDebug.vue'));
const navDebug = ref(false);
try {
    const asked = new URLSearchParams(window.location.search).get('debug');
    if (asked === 'nav') localStorage.setItem('jn-debug', 'nav');
    if (asked === 'off') localStorage.removeItem('jn-debug');
    navDebug.value = localStorage.getItem('jn-debug') === 'nav';
} catch { /* storage disabled */ }
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

// A page change closes the sheet held in store.openSheet (preferences, Earth
// Online, the nav menu, …): the site-wide ones would otherwise stay open over
// the next page, and one a left page hosted would reopen when it returns.
const store = useMainStore();
const route = useRoute();
watch(() => route.path, () => {
    if (store.openSheet) store.setOpenSheet(null);
});

// Pre-Vue boot overlay → real app hand-off. CSS lives in index.html.
// #app is revealed IMMEDIATELY at mount: it fades in underneath the opaque
// overlay while the overlay plays its exit (text fade → logo shrink →
// removal). 
// Runs once at root mount, so it covers both the homepage and a fresh load of
// a tool page.
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
