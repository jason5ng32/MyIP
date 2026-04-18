<template>
    <!-- Advanced Tools — 与 Connectivity / WebRTC 等模块一致的 header + card grid 结构 -->
    <section class="advanced-tools-section mb-10">
        <!-- 章节头 -->
        <header class="mb-3">
            <h2 id="AdvancedTools" class="text-xl md:text-3xl font-semibold tracking-tight leading-tight">
                🧰 {{ t('advancedtools.Title') }}
            </h2>
            <p class="my-3 text-base text-muted-foreground">{{ t('advancedtools.Note') }}</p>
        </header>

        <!-- 工具卡片网格 -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <!-- 不加 keyboard-shortcut-card：快捷键导航只用于主页状态卡片，
                 高级工具是"打开子页"的 tile，键盘导航语义不一致 -->
            <Card v-for="(card, index) in enabledCards" :key="index"
                class="jn-card jn-adv-card group relative cursor-pointer overflow-visible transition-transform duration-300 ease-out hover:-translate-y-1.5"
                role="button" tabindex="0" @click.prevent="navigateAndToggleOffcanvas(card.path)"
                @keydown.enter.prevent="navigateAndToggleOffcanvas(card.path)"
                @keydown.space.prevent="navigateAndToggleOffcanvas(card.path)">
                <CardContent class="p-4">
                    <!-- 标题行：icon 走 inline + baseline 对齐
                         CircleArrowOutUpRight 的 arrow 往右上伸，它的视觉中心不在 viewBox 几何中心，
                         用 flex items-center 对齐盒子时肉眼会看到 icon 比文字偏高。
                         inline 模式下 size 跟字号绑定 + vertical-align 微调，字号变化也能自适应 -->
                    <h3 class="text-xl md:text-2xl font-medium text-primary mb-2 pr-10">
                        <CircleArrowOutUpRight
                            class="inline size-[1em] align-[-0.15em] mr-1.5 transition-colors duration-300" />
                        {{ t(card.titleKey) }}
                    </h3>
                    <!-- 描述 -->
                    <p class="text-base text-muted-foreground line-clamp-2 min-h-10">
                        {{ t(card.noteKey) }}
                    </p>
                    <!-- 右上角 emoji（保留 MyIP 的玩味特征：hover 放大上浮） -->
                    <span class="jn-emoji" aria-hidden="true">{{ card.icon }}</span>
                </CardContent>
            </Card>
        </div>

        <!-- 工具详情 Drawer（替代原 Sheet）：vaul 自带拖拽关闭 + body scale -->
        <Drawer :open="isOpen" @update:open="onOpenChange" :dismissible="true">
            <DrawerContent :title="openedCard >= 0 ? t(cards[openedCard].titleKey) : t('advancedtools.Title')"
                :class="['jn-tools-drawer overflow-hidden', (isMobile || isFullScreen) ? 'h-full rounded-none' : 'h-[85vh]']">
                <!-- Drawer 内部 header：全屏切换 + 标题 + 关闭 -->
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
                <!-- 内容区（可滚动） -->
                <div class="flex-1 overflow-y-auto px-1 md:px-2 pb-6" ref="scrollContainer">
                    <div :class="isMobile ? 'w-full' : 'jn-canvas-width'">
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
import { CircleArrowOutUpRight, Maximize, Minimize } from 'lucide-vue-next';

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

// Drawer 开关与 store.openSheet 双向绑定（沿用 refactor/01 的 openSheet 语义）
const isOpen = computed(() => store.openSheet === 'tools');
const onOpenChange = (val) => {
    // 关闭时把 router 回到 '/'，与原 resetNavigatorURL 行为保持一致
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

// 跳转到指定页面（开关由 router/index.js afterEach 驱动 store.setOpenSheet）
const navigateAndToggleOffcanvas = (routePath) => {
    router.push(routePath);
    let capitalizedRoutePath = routePath.replace('/', '');
    capitalizedRoutePath = capitalizedRoutePath.charAt(0).toUpperCase() + capitalizedRoutePath.slice(1);
    trackEvent('Nav', 'NavClick', capitalizedRoutePath);
};

// 全屏切换：高度由 DrawerContent 的 class 响应式决定
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
/* 右上角 emoji：保留 MyIP 原有的 hover 放大上浮玩味特征 */
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

/* Drawer 内容区宽度（桌面） */
.jn-canvas-width {
    width: fit-content;
    margin: auto;
    max-width: 1400px;
}

.jn-drawer-header {
    border-bottom: 1px solid var(--border);
}

/* Drawer 根容器需要 flex-col，让 header 固定 + 内容滚动 */
.jn-tools-drawer {
    display: flex;
    flex-direction: column;
}

/* 全屏切换的 height 过渡 —— 必须满足两个条件：
   1) 用 :global 透穿 scoped 边界：class 最终落在 vaul+reka-ui 嵌套组件的根 DOM 上
   2) 同时声明 transform —— 否则会覆盖 vaul 自己的 transition:transform 0.5s，
      破坏打开/拖拽的滑动动画 */
:global(.jn-tools-drawer) {
    transition:
        transform 0.5s cubic-bezier(0.32, 0.72, 0, 1),
        height 0.3s cubic-bezier(0.32, 0.72, 0, 1) !important;
}
</style>
