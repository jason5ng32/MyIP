<template>
    <!-- Advanced Tools -->
    <section class="advanced-tools-section mb-10">
        <!-- Header -->
        <header class="mb-3">
            <h2 id="AdvancedTools" class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
                🧰 {{ t('advancedtools.Title') }}
            </h2>
            <p class="my-3 text-base text-muted-foreground">{{ t('advancedtools.Note') }}</p>
        </header>

        <!-- Card grid -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card v-for="(card, index) in enabledCards" :key="index"
                :data-adv-path="card.path"
                class="keyboard-shortcut-card jn-card jn-adv-card group relative cursor-pointer overflow-visible transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50"
                role="button" tabindex="0" @click.prevent="navigateAndToggleOffcanvas(card.path)"
                @keydown.enter.prevent="navigateAndToggleOffcanvas(card.path)"
                @keydown.space.prevent="navigateAndToggleOffcanvas(card.path)">
                <CardContent class="p-4">
                    <h3 class="text-xl font-medium text-primary mb-2 pr-10">
                        <PanelBottomOpen
                            class="inline size-[1em] align-[-0.15em] mr-1.5 transition-colors duration-300" />
                        {{ t(card.titleKey) }}
                    </h3>
                    <!-- Description -->
                    <p class="text-base text-muted-foreground line-clamp-2 min-h-10">
                        {{ t(card.noteKey) }}
                    </p>
                    <!-- Top right emoji -->
                    <span class="jn-emoji" aria-hidden="true">{{ card.icon }}</span>
                </CardContent>
            </Card>
        </div>

        <!-- Tool details Drawer -->
        <Drawer :open="isOpen" @update:open="onOpenChange" :dismissible="true">
            <DrawerContent :title="openedCard >= 0 ? t(cards[openedCard].titleKey) : t('advancedtools.Title')"
                :class="['jn-tools-drawer overflow-hidden', (isMobile || isFullScreen) ? 'h-full rounded-none' : 'h-[85vh]']">
                <!-- Drawer internal header -->
                <div class="flex items-center gap-2 px-4 pt-1 pb-3 jn-drawer-header shrink-0">
                    <button v-if="!isMobile" type="button"
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        @click="fullScreen" :aria-label="isFullScreen ? 'Exit full screen' : 'Full screen'">
                        <Maximize v-if="!isFullScreen" class="size-4" />
                        <Minimize v-else class="size-4" />
                    </button>
                    <span v-if="openedCard >= 0" class="flex-1 text-base md:text-lg font-medium truncate"
                        :class="isMobile ? 'text-left' : 'text-center'">
                        <span class="mr-1">{{ cards[openedCard].icon }}</span>{{ t(cards[openedCard].titleKey) }}
                    </span>
                    <span v-else class="flex-1" />
                    <DrawerClose @click="resetNavigatorURL()"
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
                </div>
                <!-- Content area (scrollable) -->
                <div class="flex-1 overflow-y-auto px-1 md:px-2 pb-6" ref="scrollContainer">
                    <div :class="isMobile ? 'w-full px-3' : 'jn-canvas-width px-6'">
                        <router-view></router-view>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    </section>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Maximize, Minimize, PanelBottomOpen } from 'lucide-vue-next';

const { t } = useI18n();

const store = useMainStore();
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

const enabledCards = computed(() => cards.filter(c => c.enabled));

const isFullScreen = ref(false);
const openedCard = computed(() => store.currentPath.id);

// Drawer toggle and store.openSheet bidirectional binding
const isOpen = computed(() => store.openSheet === 'tools');
const onOpenChange = (val) => {
    // When closed, go back to '/'
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

// Navigate to specified page
// Toggle driven by router/index.js afterEach and store.setOpenSheet
const navigateAndToggleOffcanvas = (routePath) => {
    router.push(routePath);
    let capitalizedRoutePath = routePath.replace('/', '');
    capitalizedRoutePath = capitalizedRoutePath.charAt(0).toUpperCase() + capitalizedRoutePath.slice(1);
    trackEvent('Nav', 'NavClick', capitalizedRoutePath);
};

// Full screen toggle: height determined by DrawerContent's class
const fullScreen = () => {
    isFullScreen.value = !isFullScreen.value;
};

const resetNavigatorURL = () => {
    router.push('/');
};

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
.jn-emoji {
    position: absolute;
    top: 0.5rem;
    right: 0.75rem;
    font-size: 1.6rem;
    line-height: 1;
    transition: transform 0.4s ease, text-shadow 0.4s ease;
    pointer-events: none;
}

.jn-adv-card:hover .jn-emoji {
    transform: translateY(-10pt) scale(1.8);
    text-shadow: 0 0 10pt rgb(0 0 0 / 0.38);
}

:global(.dark) .jn-adv-card:hover .jn-emoji {
    text-shadow: 0 0 10pt rgb(255 255 255 / 0.15);
}

/* Drawer content area width (desktop) */
.jn-canvas-width {
    width: fit-content;
    margin: auto;
    max-width: 1400px;
}

.jn-drawer-header {
    border-bottom: 1px solid var(--border);
}

/* Drawer root container needs flex-col, so that the header is fixed + content scrollable */
.jn-tools-drawer {
    display: flex;
    flex-direction: column;
}

/* Full screen toggle height transition */
:global(.jn-tools-drawer) {
    transition:
        transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
        height 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
</style>
