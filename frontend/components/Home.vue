<template>
  <NavBar />
  <User ref="userRef" />
  <Achievements ref="achievementsRef" />
  <Preferences />
  <main id="mainpart" class="mx-auto w-full px-4 jn-container">
    <div class="rounded-md" tabindex="0">
      <IPCheck ref="IPCheckRef" />
      <Connectivity ref="connectivityRef" />
      <WebRTC ref="webRTCRef" />
      <DNSLeaks ref="dnsLeaksRef" />
      <SpeedTest ref="speedTestRef" />
      <AdvancedTools ref="advancedToolsRef" />
    </div>
  </main>
  <FloatingDock :ready="showMaskButton" :mask-active="infoMaskLevel > 0">
    <InfoMask :showMaskButton.value="showMaskButton" :infoMaskLevel.value="infoMaskLevel"
      :toggleInfoMask="toggleInfoMask" />
    <ShareReport ref="shareReportRef" />
    <IPHistory />
    <QueryIP ref="queryIPRef" />
  </FloatingDock>
  <HelpModal ref="helpModalRef" />
  <Additional />
  <Footer />
</template>

<script setup>
// The homepage. Holds every top-level section plus the Advanced Tools drawer.
// Split out of App.vue when the app moved to history-mode routing: App is now a
// thin shell, and this component is what /'s <router-view> renders. The truly
// global widgets (tooltip provider, toast, PWA, theme) stay in App.
//
// Components — the test sections and the always-visible chrome load
// synchronously; everything the first paint can't show (dialogs, drawers,
// the below-fold Additional/Footer) is an async component so its code stays
// out of the route chunk and out of the mount's critical path. Their
// template refs are null until the chunk lands — consumers (use-shortcuts)
// must optional-chain.
import NavBar from './Nav.vue';
import IPCheck from './IpInfos.vue';
import Connectivity from './ConnectivityTest.vue';
import WebRTC from './WebRtcTest.vue';
import DNSLeaks from './DnsLeaksTest.vue';
import SpeedTest from './SpeedTest.vue';
import AdvancedTools from './Advanced.vue';
import InfoMask from './widgets/InfoMask.vue';
import FloatingDock from './widgets/FloatingDock.vue';

// Vue + Store
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';

// Async (off-critical-path) components
const Additional = defineAsyncComponent(() => import('./Additional.vue'));
const Footer = defineAsyncComponent(() => import('./Footer.vue'));
const User = defineAsyncComponent(() => import('./User.vue'));
const Achievements = defineAsyncComponent(() => import('./Achievements.vue'));
const Preferences = defineAsyncComponent(() => import('./widgets/Preferences.vue'));
const QueryIP = defineAsyncComponent(() => import('./widgets/QueryIP.vue'));
const HelpModal = defineAsyncComponent(() => import('./widgets/Help.vue'));
const IPHistory = defineAsyncComponent(() => import('./widgets/IPHistory.vue'));
const ShareReport = defineAsyncComponent(() => import('./report/ShareReportDialog.vue'));
import { useRoute } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';

// Composables
import { useInfoMask } from '@/composables/use-info-mask.js';
import { useRefreshOrchestrator } from '@/composables/use-refresh-orchestrator.js';
import { useShortcuts } from '@/composables/use-shortcuts.js';
import { useSectionTracking } from '@/composables/use-section-tracking.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';

const { t } = useI18n();
const store = useMainStore();
const route = useRoute();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
// A tool drawer is open iff the home route carries a `?tool=` query (set by
// Advanced.vue). Drives the `f` fullscreen shortcut gate.
const isToolOpen = computed(() => !!route.query.tool);

// Template refs
const userRef = ref(null);
const achievementsRef = ref(null);
const queryIPRef = ref(null);
const helpModalRef = ref(null);
const shareReportRef = ref(null);
const speedTestRef = ref(null);
const advancedToolsRef = ref(null);
const IPCheckRef = ref(null);
const connectivityRef = ref(null);
const webRTCRef = ref(null);
const dnsLeaksRef = ref(null);

// Info mask
const { infoMaskLevel, isInfosLoaded, showMaskButton, toggleInfoMask } = useInfoMask({
    store,
    t,
});

// Refresh / initial load sequence
const { loadingControl } = useRefreshOrchestrator({
    refs: { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef },
    store,
    t,
    userPreferences,
    infoMaskLevel,
});

// Shortcuts
const { loadShortcuts } = useShortcuts({
    refs: {
        queryIPRef, helpModalRef, shareReportRef,
        speedTestRef, advancedToolsRef, IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef,
        isInfosLoaded, isToolOpen, toggleInfoMask,
    },
    store, t, configs, userPreferences,
});

// Scroll monitoring + section tracking (logic from widgets/Patch.vue)
useSectionTracking();

// Localized homepage head. Provide title/description explicitly via t() rather
// than leaning on use-document-meta's DEFAULT_META snapshot: that snapshot is
// taken at module load, before the (now async) locale messages land, so it would
// pin the head to index.html's English title. Reactive t() also re-applies the
// right copy when SPA-navigating back from a /tools/:slug page.
useDocumentMeta(() => ({
    title: t('page.title'),
    description: t('page.description'),
    canonical: `${window.location.origin}/`,
}));

onMounted(() => {
    loadingControl();
    loadShortcuts();
});
</script>
