<template>
  <TooltipProvider :delay-duration="150">
    <NavBar ref="navBarRef" />
    <User ref="userRef" />
    <Achievements ref="achievementsRef" />
    <Preferences ref="preferencesRef" />
    <Alert />
    <div id="mainpart" class="mx-auto w-full px-4 jn-container">
      <div class="rounded-md" tabindex="0">
        <IPCheck ref="IPCheckRef" />
        <Connectivity ref="connectivityRef" />
        <DNSLeaks ref="dnsLeaksRef" />
        <WebRTC ref="webRTCRef" />
        <SpeedTest ref="speedTestRef" />
        <AdvancedTools ref="advancedToolsRef" />
      </div>
    </div>
    <InfoMask :showMaskButton.value="showMaskButton" :infoMaskLevel.value="infoMaskLevel"
      :toggleInfoMask="toggleInfoMask" />
    <QueryIP ref="queryIPRef" />
    <HelpModal ref="helpModalRef" />
    <Additional ref="additionalRef" />
    <Footer ref="footerRef" />
    <PWA />
  </TooltipProvider>
</template>

<script setup>
// Components
import NavBar from './components/Nav.vue';
import IPCheck from './components/IpInfos.vue';
import Connectivity from './components/ConnectivityTest.vue';
import WebRTC from './components/WebRtcTest.vue';
import DNSLeaks from './components/DnsLeaksTest.vue';
import SpeedTest from './components/SpeedTest.vue';
import AdvancedTools from './components/Advanced.vue';
import Additional from './components/Additional.vue';
import Footer from './components/Footer.vue';
import User from './components/User.vue';
import Achievements from './components/Achievements.vue';

// Widgets
import Preferences from './components/widgets/Preferences.vue';
import QueryIP from './components/widgets/QueryIP.vue';
import HelpModal from './components/widgets/Help.vue';
import PWA from './components/widgets/PWA.vue';
import Alert from './components/widgets/Toast.vue';
import InfoMask from './components/widgets/InfoMask.vue';

// UI
import { TooltipProvider } from './components/ui/tooltip';

// Vue + Store
import { ref, computed, onMounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';

// Composables
import { useInfoMask } from '@/composables/use-info-mask.js';
import { useRefreshOrchestrator } from '@/composables/use-refresh-orchestrator.js';
import { useShortcuts } from '@/composables/use-shortcuts.js';
import { useSectionTracking } from '@/composables/use-section-tracking.js';

const { t } = useI18n();
const store = useMainStore();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const isSignedIn = computed(() => store.isSignedIn);
const openedCard = computed(() => store.currentPath.id);

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

// Pre-Vue boot overlay → real app hand-off. CSS lives in index.html.
// Stages: text fade → logo shrink → remove overlay + reveal #app.
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

// Info mask
const { infoMaskLevel, isInfosLoaded, showMaskButton, toggleInfoMask } = useInfoMask({
    refs: { IPCheckRef, webRTCRef, dnsLeaksRef },
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
        isInfosLoaded, openedCard, toggleInfoMask,
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

<style scoped></style>
