<template>
    <pwa-install manual-apple="true" manual-chrome="true" disable-screenshots="true"
        manifest-url="/manifest.webmanifest"></pwa-install>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import '@khmyznikov/pwa-install';
import { detectBrowser, detectOS } from '@/utils/system-detect.js';
import { getPwaVisitCount } from '@/utils/pwa.js';
import { trackEvent } from '@/utils/analytics';

const { t } = useI18n();


// Define data
const isDesktopChrome = ref(true);
const isAndroidChrome = ref(false);
const isMacSafari = ref(false);
const isIosSafari = ref(false);
const isOtherBrowser = ref(false);

// Define methods
const getBrowser = () => {
    const os = detectOS();
    const browser = detectBrowser();

    const androidChrome = browser.isChrome && os.isAndroid;
    const desktopChrome = browser.isChrome && !os.isAndroid && !os.isIOS;
    const macSafari = os.isMac && browser.isSafari && !browser.isChrome;
    const iosSafari = os.isIOS;

    isAndroidChrome.value = androidChrome;
    isDesktopChrome.value = desktopChrome;
    isMacSafari.value = macSafari;
    isIosSafari.value = iosSafari;
    isOtherBrowser.value = !(androidChrome || desktopChrome || macSafari || iosSafari);
}

const popupCount = () => {
    let currentCount = localStorage.getItem('pwaPopupCount') || 0;
    currentCount = parseInt(currentCount, 10);
    return currentCount;
}

const showPWA = () => {
    const pwaInstall = document.getElementsByTagName('pwa-install')[0];
    if (!pwaInstall) return;

    pwaInstall.isAppleMobilePlatform = isIosSafari.value;
    pwaInstall.isAppleDesktopPlatform = isMacSafari.value;
    pwaInstall.externalPromptEvent = window.ipcheckInstallPromptEvent || pwaInstall.externalPromptEvent;
    pwaInstall.installDescription = t('pwa.installDescription', { count: getPwaVisitCount() });
    pwaInstall.description = t('pwa.appDescription');

    if (!pwaInstall.isUnderStandaloneMode && pwaInstall.isInstallAvailable) {
        pwaInstall.showDialog(true);
        const totalPopupCount = popupCount() + 1;
        localStorage.setItem('pwaPopupCount', totalPopupCount);
        trackEvent('PWA', 'PWAPopup', 'Show');
        pwaInstall.addEventListener('pwa-install-success-event', event => {
            if (event.detail.message.includes('success')) {
                trackEvent('PWA', 'PWAInstalled', 'Success');
            }
        });
    }
};

onMounted(() => {
    getBrowser();
    const pwaInstall = document.getElementsByTagName('pwa-install')[0];
    if (pwaInstall && window.ipcheckInstallPromptEvent) {
        pwaInstall.externalPromptEvent = window.ipcheckInstallPromptEvent;
    }

    window.addEventListener('beforeinstallprompt', event => {
        if (pwaInstall) {
            pwaInstall.externalPromptEvent = event;
        }
    });

    // Eligibility (visit count, prompt cap, standalone) was already decided
    // by App.vue via shouldOfferPwaInstall() — this component only mounts at
    // the prompt moment. The short delay lets the pwa-install element
    // upgrade and process the manifest before the dialog opens.
    setTimeout(() => {
        showPWA();
    }, 3000);
});
</script>

<style scoped></style>
