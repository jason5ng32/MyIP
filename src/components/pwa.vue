<template>
    <pwa-install manual-apple="true" manual-chrome="true" disable-screenshots="true"
        manifest-url="/manifest.webmanifest"></pwa-install>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';
import '@khmyznikov/pwa-install';

export default {
    name: 'PWA',

    // 引入 Store
    setup() {
        const store = useStore();
        const isDarkMode = computed(() => store.state.isDarkMode);
        const isMobile = computed(() => store.state.isMobile);


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
            isInstalled: true,
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
            const userAgent = navigator.userAgent;

            const isAndroidChrome = /Chrome/.test(userAgent) && /Android/.test(userAgent);
            const isDesktopChrome = /Chrome/.test(userAgent) && !/(iPhone|iPad|iPod|Android)/.test(userAgent);
            const isMacSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && navigator.platform.includes('Mac');
            const isIosSafari = /(iPhone|iPad)/.test(userAgent);

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