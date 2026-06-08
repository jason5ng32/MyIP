<template>
  <NavBar ref="navBarRef" />
  <User ref="userRef" />
  <Achievements ref="achievementsRef" />
  <Preferences ref="preferencesRef" />
  <div id="mainpart" class="mx-auto w-full px-4 jn-container">
    <div class="rounded-md" tabindex="0">
      <IPCheck ref="IPCheckRef" />
      <Connectivity ref="connectivityRef" />
      <WebRTC ref="webRTCRef" />
      <DNSLeaks ref="dnsLeaksRef" />
      <SpeedTest ref="speedTestRef" />
      <AdvancedTools ref="advancedToolsRef" />
    </div>
  </div>
  <FloatingDock>
    <InfoMask :showMaskButton.value="showMaskButton" :infoMaskLevel.value="infoMaskLevel"
      :toggleInfoMask="toggleInfoMask" />
    <QueryIP ref="queryIPRef" />
  </FloatingDock>
  <HelpModal ref="helpModalRef" />
  <Additional ref="additionalRef" />
  <Footer ref="footerRef" />
</template>

<script setup>
// The homepage. Holds every top-level section plus the Advanced Tools drawer.
// Split out of App.vue when the app moved to history-mode routing: App is now a
// thin shell, and this component is what /'s <router-view> renders. The truly
// global widgets (tooltip provider, toast, PWA, theme) stay in App.
//
// Components
import NavBar from './Nav.vue';
import IPCheck from './IpInfos.vue';
import Connectivity from './ConnectivityTest.vue';
import WebRTC from './WebRtcTest.vue';
import DNSLeaks from './DnsLeaksTest.vue';
import SpeedTest from './SpeedTest.vue';
import AdvancedTools from './Advanced.vue';
import Additional from './Additional.vue';
import Footer from './Footer.vue';
import User from './User.vue';
import Achievements from './Achievements.vue';

// Widgets
import Preferences from './widgets/Preferences.vue';
import QueryIP from './widgets/QueryIP.vue';
import HelpModal from './widgets/Help.vue';
import InfoMask from './widgets/InfoMask.vue';
import FloatingDock from './widgets/FloatingDock.vue';

// Vue + Store
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';

// Composables
import { useInfoMask } from '@/composables/use-info-mask.js';
import { useRefreshOrchestrator } from '@/composables/use-refresh-orchestrator.js';
import { useShortcuts } from '@/composables/use-shortcuts.js';
import { useSectionTracking } from '@/composables/use-section-tracking.js';

const { t } = useI18n();
const store = useMainStore();
const route = useRoute();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const isSignedIn = computed(() => store.isSignedIn);
// A tool drawer is open iff the home route carries a `?tool=` query (set by
// Advanced.vue). Drives the `f` fullscreen shortcut gate.
const isToolOpen = computed(() => !!route.query.tool);

// Template refs
const navBarRef = ref(null);
const userRef = ref(null);
const achievementsRef = ref(null);
const preferencesRef = ref(null);
const queryIPRef = ref(null);
const helpModalRef = ref(null);
const additionalRef = ref(null);
const footerRef = ref(null);
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
        navBarRef, preferencesRef, queryIPRef, helpModalRef, additionalRef, footerRef,
        speedTestRef, advancedToolsRef, IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef,
        isInfosLoaded, isToolOpen, toggleInfoMask,
    },
    store, t, configs, userPreferences, isSignedIn,
});

// Scroll monitoring + section tracking (logic from widgets/Patch.vue)
useSectionTracking();

onMounted(() => {
    loadingControl();
    loadShortcuts();
});
</script>
