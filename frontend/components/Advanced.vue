<template>
    <!-- Advanced Tools -->
    <section class="advanced-tools-section mb-10">
        <!-- Header -->
        <header class="mb-2 flex flex-col items-start justify-between gap-4">
            <div class="flex flex-row items-center justify-between gap-4 w-full">
            <h2 id="AdvancedTools" class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
                🧰 {{ t('advancedtools.Title') }}
            </h2>
            </div>
            <div class="text-base text-muted-foreground">
                <p v-if="!isSimpleMode">{{ t('advancedtools.Note') }}</p>
            </div>
        </header>

        <!-- Card grid. Each card is a real <a> to the standalone /tools/:slug
             page, so ⌘/Ctrl-click, middle-click and "open in new tab" all work.
             A plain left-click (or Enter / Space) is intercepted to open the
             in-page drawer instead. A dedicated ↗ corner button always opens the
             standalone page in a new tab. -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Card v-for="card in enabledCards" :key="card.slug"
                :data-adv-slug="card.slug"
                class="keyboard-shortcut-card jn-card jn-adv-card group relative overflow-visible transition-transform duration-300 ease-out hover:-translate-y-1.5 data-[keyboard-hover=true]:ring-2 data-[keyboard-hover=true]:ring-green-500/50">
                <a :href="`/tools/${card.slug}`"
                    class="block cursor-pointer no-underline text-inherit"
                    @click="onCardClick($event, card.slug)"
                    @keydown.enter.prevent="openTool(card.slug)"
                    @keydown.space.prevent="openTool(card.slug)">
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
                </a>

            </Card>
        </div>

        <!-- Tool details Drawer -->
        <Drawer :open="isOpen" @update:open="onOpenChange" :dismissible="true">
            <DrawerContent :title="activeTool ? t(activeTool.titleKey) : t('advancedtools.Title')"
                :safe-area-top="isMobile || isFullScreen"
                :class="['jn-tools-drawer overflow-hidden', (isMobile || isFullScreen) ? 'h-full rounded-none' : 'h-[85vh]']">
                <!-- Drawer internal header -->
                <div class="flex items-center gap-2 px-4 pt-1 pb-3 jn-drawer-header shrink-0">
                    <button v-if="!isMobile" type="button"
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        @click="fullScreen" :aria-label="isFullScreen ? 'Exit full screen' : 'Full screen'">
                        <Maximize v-if="!isFullScreen" class="size-4" />
                        <Minimize v-else class="size-4" />
                    </button>
                    <span v-if="activeTool" class="flex-1 text-base md:text-lg font-medium truncate"
                        :class="isMobile ? 'text-left' : 'text-center'">
                        <span class="mr-1">{{ activeTool.emoji }}</span>{{ t(activeTool.titleKey) }}
                    </span>
                    <span v-else class="flex-1" />
                    <!-- Open the current tool as a standalone page (hidden in a
                         PWA window, which has no new-tab affordance) -->
                    <a v-if="activeTool && !isPwa" :href="`/tools/${activeTool.slug}`" target="_blank" rel="noopener"
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        :title="t('advancedtools.OpenInNewTab')" :aria-label="t('advancedtools.OpenInNewTab')">
                        <SquareArrowOutUpRight class="size-4" />
                    </a>
                    <DrawerClose
                        class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
                </div>
                <!-- Content area (scrollable) -->
                <div class="flex-1 overflow-y-auto px-1 md:px-2 pb-6" ref="scrollContainer">
                    <div :class="isMobile ? 'w-full px-3' : 'jn-canvas-width px-6'">
                        <component :is="activeComponent" v-if="activeComponent" />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    </section>
</template>

<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { ADVANCED_TOOLS, TOOL_BY_SLUG } from '@/data/tools.js';
import { isRunningAsPwa } from '@/utils/pwa.js';
import { Drawer, DrawerContent, DrawerClose } from '@/components/ui/drawer';
import { Card, CardContent } from '@/components/ui/card';
import { Maximize, Minimize, PanelBottomOpen, SquareArrowOutUpRight } from '@lucide/vue';

const { t } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
// Running as an installed PWA → hide the "open in new tab" affordance (a PWA
// window has no tab strip; it would pop out to the browser). See utils/pwa.js.
const isPwa = isRunningAsPwa();
const configs = computed(() => store.configs);
const userPreferences = computed(() => store.userPreferences);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);
const scrollContainer = ref(null);
const route = useRoute();
const router = useRouter();

// Cards derive from the shared tool registry (frontend/data/tools.js). `icon`
// is mapped from the registry's `emoji` so the template key stays stable.
const cards = ADVANCED_TOOLS.map((tool) => ({ ...tool, icon: tool.emoji }));

// Gate: the invisibility + enhanced DNS-leak tools only show on the original
// site (they need the private API + sign-in). Reactive on configs, so they
// appear the moment configs land — no fixed timeout needed.
const enabledCards = computed(() =>
    cards.filter((c) => !c.requiresOriginalSite || configs.value.originalSite),
);

// ── Drawer state, driven by the `?tool=<slug>` query on the home route ───────
// `?tool=whois` ⇒ the drawer is open showing Whois. Closing clears the query.
const activeTool = computed(() => {
    const slug = route.query.tool;
    return (typeof slug === 'string' && TOOL_BY_SLUG.get(slug)) || null;
});
const isOpen = computed(() => !!activeTool.value);

// Resolve each tool's lazy component once and cache it, so re-renders don't
// rebuild the async wrapper (which would remount the tool).
const asyncToolCache = new Map();
const activeComponent = computed(() => {
    const tool = activeTool.value;
    if (!tool) return null;
    if (!asyncToolCache.has(tool.slug)) {
        asyncToolCache.set(tool.slug, defineAsyncComponent(tool.component));
    }
    return asyncToolCache.get(tool.slug);
});

const isFullScreen = ref(false);

// Open a tool in the in-page drawer (just sets the query; isOpen reacts).
const openTool = (slug) => {
    router.push({ path: '/', query: { tool: slug } });
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    trackEvent('Nav', 'NavClick', name);
};

// Card left-click: open the drawer. Modifier / middle clicks fall through to
// the <a href> default so the browser opens the standalone page in a new tab.
const onCardClick = (e, slug) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    openTool(slug);
};

const onOpenChange = (val) => {
    // Drawer closed (drag / overlay / Esc / close button) → drop the ?tool query.
    if (!val) {
        if (route.query.tool) router.push({ path: '/', query: {} });
        isFullScreen.value = false;
    }
};

// Full screen toggle: height determined by DrawerContent's class
const fullScreen = () => {
    isFullScreen.value = !isFullScreen.value;
};

onMounted(() => {
    store.setMountingStatus('AdvancedTools', true);
});

defineExpose({
    openTool, fullScreen,
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
