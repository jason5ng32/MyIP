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
            <div class="col-lg-3 col-md-6 col-12 mb-4" v-for="(card, index) in cards" :key="index">
                <div class="jn-adv-card card jn-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
                    <div class="card-body" @click.prevent="navigateAndToggleOffcanvas(card.path)" role="button">
                        <h3 :class="[isMobile ? 'mobile-h3' : 'fs-4']">
                            <i class="bi bi-arrow-up-right-circle"></i> {{ t(card.titleKey) }}
                        </h3>
                        <p class="opacity-75">{{ t(card.noteKey) }}</p>
                        <span :class="[isDarkMode ? 'jn-icon-dark' : 'jn-icon']">{{ card.icon }}</span>
                    </div>
                </div>
            </div>
        </div>
        <div :data-bs-theme="isDarkMode ? 'dark' : ''" class="offcanvas offcanvas-bottom" tabindex="-1"
            :class="[isMobile ? 'h-100' : '']" id="offcanvasTools" aria-labelledby="offcanvasToolsLabel">
            <div class="offcanvas-header d-flex justify-content-end"
                :class="[showTitle ? 'jn-offcanvas-header' : 'jn-offcanvas-header-noborder']">
                <button v-if="!isMobile" type="button" class="btn opacity-50 jn-bold" @click="fullScreen">
                    <span v-if="!isFullScreen">
                        <i class="bi bi-arrows-fullscreen"></i>
                    </span>
                    <span v-else>
                        <i class="bi bi-fullscreen-exit"></i>
                    </span>
                </button>
                <Transition name="slide-fade">
                    <span v-if="showTitle" class="fw-medium"
                        :class="[isMobile ? 'mobile-h2 text-left' : 'fs-5 text-center ms-auto']">{{
                        cards[openedCard].icon }}
                        {{ t(cards[openedCard].titleKey) }}</span>
                </Transition>

                <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
            </div>
            <div class="offcanvas-body pt-0" :class="[isMobile ? ' w-100' : 'jn-canvas-width']" ref="scrollContainer">
                <router-view></router-view>
            </div>
        </div>
    </div>

</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { Offcanvas } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

const { t } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const scrollContainer = ref(null);
const router = useRouter();

const cards = reactive([
    { path: '/pingtest', icon: '⏱️', titleKey: 'pingtest.Title', noteKey: 'advancedtools.PingTestNote' },
    { path: '/mtrtest', icon: '📡', titleKey: 'mtrtest.Title', noteKey: 'advancedtools.MTRTestNote' },
    { path: '/ruletest', icon: '🚏', titleKey: 'ruletest.Title', noteKey: 'advancedtools.RuleTestNote' },
    { path: '/dnsresolver', icon: '🔦', titleKey: 'dnsresolver.Title', noteKey: 'advancedtools.DNSResolverNote' },
    { path: '/censorshipcheck', icon: '🚧', titleKey: 'censorshipcheck.Title', noteKey: 'advancedtools.CensorshipCheck' },
    { path: '/whois', icon: '📓', titleKey: 'whois.Title', noteKey: 'advancedtools.Whois' },
    { path: '/macchecker', icon: '🗄️', titleKey: 'macchecker.Title', noteKey: 'advancedtools.MacChecker' },
]);

const cardInvisibilityTest = { path: '/invisibilitytest', icon: '🫣', titleKey: 'invisibilitytest.Title', noteKey: 'advancedtools.InvisibilityTest' };
const isFullScreen = ref(false);
const showTitle = ref(false);
const openedCard = ref(null);


// 控制标题显示
const handleScroll = () => {
    const scrollTop = scrollContainer.value.scrollTop;
    if (scrollTop > 60) {
        showTitle.value = true;
    } else {
        showTitle.value = false;
    }
};

// 跳转到指定页面并打开
const navigateAndToggleOffcanvas = (routePath) => {
    router.push(routePath);
    switch (routePath) {
        case '/pingtest':
            trackEvent('Nav', 'NavClick', 'PingTest');
            openedCard.value = 0;
            break;
        case '/mtrtest':
            trackEvent('Nav', 'NavClick', 'MTRTest');
            openedCard.value = 1;
            break;
        case '/ruletest':
            trackEvent('Nav', 'NavClick', 'RuleTest');
            openedCard.value = 2;
            break;
        case '/dnsresolver':
            trackEvent('Nav', 'NavClick', 'DNSResolver');
            openedCard.value = 3;
            break;
        case '/censorshipcheck':
            trackEvent('Nav', 'NavClick', 'CensorshipCheck');
            openedCard.value = 4;
            break;
        case '/whois':
            trackEvent('Nav', 'NavClick', 'Whois');
            openedCard.value = 5;
            break;
        case '/macchecker':
            trackEvent('Nav', 'NavClick', 'MacChecker');
            openedCard.value = 6;
            break;
        case '/invisibilitytest':
            trackEvent('Nav', 'NavClick', 'InvisibilityTest');
            openedCard.value = 7;
            break;
    }
    var offcanvas = new Offcanvas(document.getElementById('offcanvasTools'));
    offcanvas.show();
};

// 全屏显示
const fullScreen = () => {
    const offcanvas = document.getElementById('offcanvasTools');
    if (offcanvas) {
        offcanvas.style.transition = 'height 0.5s ease-in-out';
        if (!isFullScreen.value) {
            offcanvas.style.height = '100%';
            isFullScreen.value = true;
        } else {
            offcanvas.style.height = '80%';
            isFullScreen.value = false;
        }
        setTimeout(() => {
            offcanvas.style.transition = '';
        }, 500);
    }
};


onMounted(() => {
    store.setMountingStatus('advancedtools', true);
    // 监听滚动事件
    scrollContainer.value.addEventListener('scroll', handleScroll);

    setTimeout(() => {
        if (configs.value.originalSite) {
            cards.push(cardInvisibilityTest);
        }
    }, 2000);
});

defineExpose({
    navigateAndToggleOffcanvas,
});

</script>

<style scoped>
.offcanvas.offcanvas-bottom {
    height: 80%;
}

#offcanvasTools {
    z-index: 10000;
}

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