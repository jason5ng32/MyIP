<template>
    <pwa-install manual-apple="true" manual-chrome="true" disable-screenshots="true"
        manifest-url="/manifest.webmanifest"></pwa-install>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import '@khmyznikov/pwa-install';
import { detectBrowser, detectOS } from '@/utils/system-detect.js';
import { trackEvent } from '@/utils/use-analytics';


// 定义数据
const isDesktopChrome = ref(true);
const isAndroidChrome = ref(false);
const isMacSafari = ref(false);
const isIosSafari = ref(false);
const isOtherBrowser = ref(false);

// 定义方法
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

const showPWA = () => {
    const pwaInstall = document.getElementsByTagName('pwa-install')[0];
    if (!pwaInstall) return;

    pwaInstall.isAppleMobilePlatform = isIosSafari.value;
    pwaInstall.isAppleDesktopPlatform = isMacSafari.value;

    if (!pwaInstall.isUnderStandaloneMode && pwaInstall.isInstallAvailable) {
        pwaInstall.showDialog(true);
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
    setTimeout(() => {
        showPWA();
    }, 30000);
});
</script>

<style scoped></style>