<template>
    <!-- Advanced Tools -->
    <div class="advanced-tools-section mb-4">
        <div class="jn-title2">
            <h2 id="AdvancedTools" :class="{ 'mobile-h2': isMobile }">🧰 {{ t('advancedtools.Title') }}</h2>

        </div>
        <div class="text-secondary">
            <p>{{ t('advancedtools.Note') }}</p>
        </div>
        <div class="row">
            <div class="col-lg-3 col-md-6 col-12 mb-4" v-for="(card, index) in cards.filter(card => card.enabled)"
                :key="index">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas(card.path)" role="button">
                        <h3 :class="[isMobile ? 'mobile-h3' : 'fs-4']" class="jn-adv-title">
                            <i class="bi bi-arrow-up-right-circle"></i> {{ t(card.titleKey) }}
                        </h3>
                        <p class="opacity-75">{{ t(card.noteKey) }}</p>
                        <span :class="[isDarkMode ? 'jn-icon-dark' : 'jn-icon']">{{ card.icon }}</span>
                    </div>
                </div>
            </div>
        </div>
        <Sheet :open="isOpen" @update:open="onOpenChange">
            <SheetContent
                side="bottom"
                :title="openedCard >= 0 ? t(cards[openedCard].titleKey) : t('advancedtools.Title')"
                :class="cn('overflow-y-auto pt-0 jn-tools-sheet', isMobile ? 'h-full' : (isFullScreen ? 'h-full' : 'h-[80%]'))"
                :data-bs-theme="isDarkMode ? 'dark' : ''"
            >
            <div class="offcanvas-header d-flex justify-content-end jn-offcanvas-header px-3">
                <button v-if="!isMobile" type="button" class="btn opacity-50 jn-bold" @click="fullScreen">
                    <span v-if="!isFullScreen">
                        <i class="bi bi-arrows-fullscreen"></i>
                    </span>
                    <span v-else>
                        <i class="bi bi-fullscreen-exit"></i>
                    </span>
                </button>
                <span v-if="openedCard >= 0" class="fw-medium"
                    :class="[isMobile ? 'mobile-h2 text-left' : 'fs-5 text-center ms-auto']">{{
                    cards[openedCard].icon }}
                    {{ t(cards[openedCard].titleKey) }}</span>

                <SheetClose class="btn-close" @click="resetNavigatorURL()" />
            </div>
            <div class="offcanvas-body pt-0" :class="[isMobile ? ' w-100' : 'jn-canvas-width']" ref="scrollContainer">
                <router-view></router-view>
            </div>
            </SheetContent>
        </Sheet>
    </div>

</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const scrollContainer = ref(null);
const router = useRouter();

const cards = reactive([
    { path: '/pingtest', icon: '⏱️', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote', enabled: true },
    { path: '/mtrtest', icon: '📡', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote', enabled: true },
    { path: '/ruletest', icon: '🚏', titleKey: 'ruletest.Title', noteKey: 'advancedtools.RuleTestNote', enabled: true },
    { path: '/dnsresolver', icon: '🔦', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote', enabled: true },
    { path: '/censorshipcheck', icon: '🚧', titleKey: 'censorshipcheck.Title', noteKey: 'advancedtools.CensorshipCheck', enabled: true },
    { path: '/whois', icon: '📓', titleKey: 'whois.Title', noteKey: 'advancedtools.Whois', enabled: true },
    { path: '/macchecker', icon: '🗄️', titleKey: 'macchecker.Title', noteKey: 'advancedtools.MacChecker', enabled: true },
    { path: '/browserinfo', icon: '🖥️', titleKey: 'browserinfo.Title', noteKey: 'advancedtools.BrowserInfo', enabled: true },
    { path: '/securitychecklist', icon: '📋', titleKey: 'securitychecklist.Title', noteKey: 'advancedtools.SecurityChecklist', enabled: true },
    { path: '/invisibilitytest', icon: '🫣', titleKey: 'invisibilitytest.Title', noteKey: 'advancedtools.InvisibilityTest', enabled: false }
]);

const isFullScreen = ref(false);
const openedCard = computed(() => store.currentPath.id);

// Sheet 开关与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'tools');
const onOpenChange = (val) => {
    // 关闭时同步把 router 回到 '/'，与原 resetNavigatorURL 行为保持一致
    if (!val) {
        store.setOpenSheet(null);
        if (router.currentRoute.value.path !== '/') {
            router.push('/');
        }
        isFullScreen.value = false;
    } else {
        store.setOpenSheet('tools');
    }
};

// 跳转到指定页面并打开（开关由 router/index.js afterEach 驱动，通过 store.setOpenSheet）
const navigateAndToggleOffcanvas = (routePath) => {
    router.push(routePath);
    let capitalizedRoutePath = routePath.replace('/', '');
    capitalizedRoutePath = capitalizedRoutePath.charAt(0).toUpperCase() + capitalizedRoutePath.slice(1);
    trackEvent('Nav', 'NavClick', capitalizedRoutePath);
};

// 全屏显示：仅切换 ref，高度由 SheetContent 的 class 响应式计算
const fullScreen = () => {
    isFullScreen.value = !isFullScreen.value;
};

// 将浏览器地址重置
const resetNavigatorURL = () => {
    router.push('/');
}


onMounted(() => {
    store.setMountingStatus('advancedtools', true);
    setTimeout(() => {
        if (configs.value.originalSite) {
            cards.find(x => x.path === '/invisibilitytest').enabled = true;
        }
    }, 1500);
});

defineExpose({
    navigateAndToggleOffcanvas, fullScreen
});

</script>

<style scoped>
/* refactor/01：原 #offcanvasTools 与 .offcanvas-bottom 规则已由 SheetContent 的 side="bottom" + h-[80%]/h-full class 取代 */
.jn-h {
    height: 80%;
}

.jn-bold {
    -webkit-text-stroke: 1px;
    margin-left: -10pt;
}

.jn-bold:hover {
    opacity: 1 !important;
}

.jn-canvas-width {
    width: fit-content;
    margin: auto;
    max-width: 1400px;
}


.jn-adv-card {
    display: block;
    position: relative;
    text-decoration: none;
    z-index: 0;
    overflow: visible;
}

.jn-icon {
    top: 4pt;
    right: 6pt;
    font-size: 1.6rem;
    position: absolute;
    transition: all 0.4s;
}

.jn-icon-dark {
    top: 4pt;
    right: 6pt;
    font-size: 1.6rem;
    position: absolute;
    transition: all 0.4s;
}

.jn-adv-card:hover .jn-icon-dark {
    transform: translateY(-10pt) scale(1.8);
    text-shadow: 0 0 10pt #ffffff27;
}

.jn-adv-card:hover .jn-icon {
    transform: translateY(-10pt) scale(1.8);
    text-shadow: 0 0 10pt #00000060;
}

.jn-adv-title {
    width: 85%;
}

.jn-offcanvas-header {
    min-height: 40pt;
    border-bottom: 1px solid #ababab3f;
    transition: all 0.3s ease-out;
}

.jn-offcanvas-header-noborder {
    min-height: 40pt;
    border-bottom: 1px solid transparent;
    transition: all 0.3s ease-out;
}

.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.3s ease-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(20px);
    opacity: 0;
}
</style>