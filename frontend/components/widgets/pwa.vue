<template>
    <pwa-install manual-apple="true" manual-chrome="true" disable-screenshots="true"
        manifest-url="/manifest.webmanifest"></pwa-install>
</template>

<script>
import { computed } from 'vue';
import { useMainStore } from '@/store';
import '@khmyznikov/pwa-install';
import { detectBrowser , detectOS } from '@/utils/system-detect.js';
export default {
    name: 'PWA',
    
    // 引入 Store
    setup() {
        const store = useMainStore();
        const isDarkMode = computed(() => store.isDarkMode);
        const isMobile = computed(() => store.isMobile);

        return {
            isDarkMode,
            isMobile,
        };
    },

    data() {
        return {
            isDesktopChrome: true,
            isAndroidChrome: false,
            isMacSafari: false,
            isIosSafari: false,
            isOtherBrowser: false,
        }
    },
    methods: {
        showPWA() {
            const pwaInstall = document.getElementsByTagName('pwa-install')[0];

            if (this.isIosSafari) {
                pwaInstall.isAppleMobilePlatform = true;
                pwaInstall.isAppleDesktopPlatform = false;
            } else if (this.isMacSafari) {
                pwaInstall.isAppleMobilePlatform = false;
                pwaInstall.isAppleDesktopPlatform = true;
            } else {
                pwaInstall.isAppleMobilePlatform = false;
                pwaInstall.isAppleDesktopPlatform = false;
            }

            if (!pwaInstall.isUnderStandaloneMode && pwaInstall.isInstallAvailable) {
                pwaInstall.showDialog(true);
                this.$trackEvent('PWA', 'PWAPopup', 'Show');
                pwaInstall.addEventListener('pwa-install-success-event', (event) => {
                    if (event.detail.message.includes('success')) {
                        this.$trackEvent('PWA', 'PWAInstalled', 'Success');
                    }
                });
            }
        },
        detectBrowser() {
            const os = detectOS();
            const browser = detectBrowser();

            const isAndroidChrome = browser.isChrome && os.isAndroid;
            const isDesktopChrome = browser.isChrome && !os.isAndroid && !os.isIOS;
            const isMacSafari = os.isMac && browser.isSafari && !browser.isChrome;
            const isIosSafari = os.isIOS;

            if (!isAndroidChrome && !isDesktopChrome && !isMacSafari && !isIosSafari) {
                this.isOtherBrowser = true;
            }

            this.isAndroidChrome = isAndroidChrome;
            this.isDesktopChrome = isDesktopChrome;
            this.isMacSafari = isMacSafari;
            this.isIosSafari = isIosSafari;
        },

    },
    mounted() {
        this.detectBrowser();
        setTimeout(() => {
            this.showPWA();
        }, 10000);
    },
}
</script>

<style scoped></style>