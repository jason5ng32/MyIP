<template>
  <!-- iOS PWA safe-area painter. Pairs with apple-mobile-web-app-status-bar-style=black-translucent
       in index.html — the only way to get a live status-bar tint on iOS PWA, since WebKit
       ignores JS theme-color writes and media-variant theme-color tags in standalone mode.
       Color tracks --page-bg (style.css), which follows .dark class. -->
  <div class="fixed top-0 left-0 right-0 z-50 pointer-events-none transition-colors duration-300"
    style="height: env(safe-area-inset-top); background: var(--page-bg);" aria-hidden="true"></div>
  <header
    class="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-40 w-full border-b transition-transform duration-300 ease-out will-change-transform"
    :class="{ '-translate-y-full': isNavHidden,
    'bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur': !isPwa || (isPwa && !isMobile),
    'bg-page-bg': isPwa && isMobile }">
    <nav id="navbar-top" class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 sm:px-4 h-14">

      <!-- Left: Hamburger (only mobile) + Brand -->
      <div class="flex items-center gap-2">
        <Button v-if="isMobile" variant="ghost" size="icon" class="size-8" :aria-expanded="isNavMenuOpen"
          aria-label="Toggle navigation menu" @click="store.toggleSheet('navMenu')">
          <Menu />
        </Button>
        <a href="#" @click="handleLogoClick"
          class="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-lg font-semibold text-foreground no-underline hover:opacity-80 transition-opacity">
          <brandIcon />
          <span class="tracking-tight truncate">
            <span class="font-bold">IP</span><span class="font-extralight">Check.</span>
            <span class="font-extralight"
              :class="{ 'jn-shimmer-light': !loaded && !isDarkMode, 'jn-shimmer-dark': !loaded && isDarkMode }">ing</span>
          </span>
        </a>
      </div>

      <!-- Middle: Desktop nav links + GitHub star badge (left aligned, next to brand) -->
      <div v-if="!isMobile" class="flex items-center gap-0.5">
        <template v-for="item in navItems" :key="item">
          <!-- Advanced Tools: hover reveals the sub-tools, click scrolls to the
               section (disable-click-trigger frees the click from toggling the
               menu; viewport=false anchors the panel under the trigger). -->
          <NavigationMenu v-if="item === 'AdvancedTools'" as="div" :viewport="false" :disable-click-trigger="true"
            class="flex-none">
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuTrigger :class="['h-auto bg-transparent', navLinkClass(item)]"
                  @click="scrollToSection('AdvancedTools'); trackEvent('Nav', 'NavClick', item)">
                  {{ t(`nav.${item}`) }}
                </NavigationMenuTrigger>
                <NavigationMenuContent class="z-50">
                  <!-- Two-column grid on PC -->
                  <ul class="relative grid grid-cols-2 gap-x-4 gap-y-0.5 min-w-[28rem]">
                    <span aria-hidden="true"
                      class="pointer-events-none absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border"></span>
                    <li v-for="tool in advancedTools" :key="tool.slug">
                      <NavigationMenuLink as-child class="cursor-pointer">
                        <button type="button" class="w-full text-left leading-snug" @click="openTool(tool.slug)">
                          {{ t(tool.titleKey) }}
                        </button>
                      </NavigationMenuLink>
                    </li>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <!-- All other sections stay plain smooth-scroll anchors. -->
          <a v-else href="#" :class="navLinkClass(item)"
            @click.prevent="scrollToSection(item); trackEvent('Nav', 'NavClick', item)">
            {{ t(`nav.${item}`) }}
          </a>
        </template>
        <!-- GitHub repo link + star count from our own /api/github-stars
             (edge-cached). The count is hidden until it lands / on error, so the
             link itself never depends on the fetch. -->
        <Badge variant="outline" v-if="githubStarsLabel">
          <a :href="t('page.footerLink')" target="_blank" rel="noopener" class="inline-flex items-center gap-1"
            aria-label="Star on GitHub" title="Star on GitHub">
            <Icon icon="ri:star-fill" class="size-3.5 text-yellow-400" />
            <span class="tabular-nums">{{ githubStarsLabel }}</span>
            <Icon icon="ri:github-line" class="size-3.5" />
          </a>
        </Badge>
      </div>

      <!-- Right: Action area (ml-auto push to the right) -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Earth Online entry (code name: pulse) -->
        <Pulse />

        <!-- Docs assistant entry point (ask box on desktop, icon on mobile) -->
        <DocsSearch />

        <!-- Account menu: preferences cog (Firebase-less) or the user dropdown -->
        <UserMenu />
      </div>
    </nav>

    <!-- Mobile navigation sheet. Flex column so the link list scrolls instead
         of clipping on short screens when Advanced Tools is expanded. -->
    <Sheet v-if="isMobile" :open="isNavMenuOpen" @update:open="onNavMenuChange">
      <SheetContent side="left" class="w-80 p-0 flex flex-col gap-0" :title="t('nav.Navigation')">
        <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h5 class="m-0 text-base font-semibold">{{ t('nav.Navigation') }}</h5>
          <SheetClose />
        </div>
        <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          <template v-for="item in navItems" :key="item">
            <!-- Advanced Tools expands inline into its sub-tools (open by default)
                 so they're discoverable, not hidden behind a bare label. -->
            <Collapsible v-if="item === 'AdvancedTools'" v-model:open="mobileToolsOpen">
              <CollapsibleTrigger as-child>
                <button type="button"
                  :class="[navLinkClass(item, { block: true }), 'flex w-full items-center justify-between']">
                  <span>{{ t(`nav.${item}`) }}</span>
                  <ChevronDown class="size-4 shrink-0 opacity-60 transition-transform duration-200"
                    :class="{ 'rotate-180': mobileToolsOpen }" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div class="my-0.5 ml-3 flex flex-col gap-0.5 border-l pl-3">
                  <button v-for="tool in advancedTools" :key="tool.slug" type="button"
                    class="block w-full rounded-md px-3 py-1.5 text-left text-sm leading-snug text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                    @click="openTool(tool.slug)">
                    {{ t(tool.titleKey) }}
                  </button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <!-- All other sections stay plain smooth-scroll anchors. -->
            <a v-else href="#" :class="navLinkClass(item, { block: true })"
              @click.prevent="scrollToSection(item); trackEvent('Nav', 'NavClick', item); store.setOpenSheet(null)">
              {{ t(`nav.${item}`) }}
            </a>
          </template>
          <a :href="t('page.footerLink')" target="_blank" rel="noopener"
            class="mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Icon icon="ri:github-line" class="size-4" />
            <span>Star on GitHub</span>
            <!-- Same /api/github-stars count as the desktop badge (fetched on
                 mount); hidden until it lands / on error. -->
            <span v-if="githubStarsLabel"
              class="ml-auto tabular-nums text-muted-foreground inline-flex items-center gap-1">
              <Icon icon="ri:star-fill" class="size-3.5 text-yellow-400" />
              {{ githubStarsLabel }}
            </span>
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  </header>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from '@/components/ui/navigation-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Menu } from '@lucide/vue';
import DocsSearch from '@/components/widgets/DocsSearch.vue';
import Pulse from '@/components/widgets/Pulse.vue';
import UserMenu from '@/components/UserMenu.vue';
import { Icon } from '@iconify/vue';
import brandIcon from './svgicons/Brand.vue';
import { SECTION_IDS } from '@/data/sections';
import { ADVANCED_TOOLS } from '@/data/tools.js';
import { listedTools } from '@/utils/tool-availability.js';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { formatStarCount } from '@/utils/format-star-count.js';
import { isRunningAsPwa } from '@/utils/pwa.js';
import { useRouteActive } from '@/composables/use-route-active.js';

const { t } = useI18n();
const store = useMainStore();
const router = useRouter();

const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const currentSection = computed(() => store.currentSection);
const loaded = computed(() => store.allHasLoaded);

// Running as an installed PWA (chromeless window). Distinct from the app's
// "standalone tool pages" — see utils/pwa.js.
const isPwa = isRunningAsPwa();

const navItems = SECTION_IDS;

// Tools shown in the nav, mirroring Advanced.vue's enabledCards: gated tools
// stay hidden where the deployment lacks them. Reactive on configs.
const configs = computed(() => store.configs);
const advancedTools = computed(() => listedTools(ADVANCED_TOOLS, configs.value));

// Mobile: Advanced Tools sub-list expanded by default for discoverability.
const mobileToolsOpen = ref(true);

// GitHub star count for the repo badge. Fetched from our own edge-cached
// endpoint; stays null (badge hides the count) if the request fails.
const githubStars = ref(null);
const githubStarsLabel = computed(() => formatStarCount(githubStars.value));
const fetchGithubStars = async () => {
  try {
    const res = await fetchWithTimeout('/api/github-stars');
    if (!res.ok) return;
    const data = await res.json();
    if (typeof data.stars === 'number') githubStars.value = data.stars;
  } catch {
    /* leave the badge without a count */
  }
};

// nav link style — current section highlight use bg-accent instead of only bold
const navLinkClass = (item, { block = false } = {}) => {
  const base = 'rounded-md px-3 py-1.5 text-sm font-medium no-underline cursor-pointer transition-colors';
  const state = item === currentSection.value
    ? 'bg-accent text-accent-foreground'
    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
  return [base, state, block ? 'block' : ''].filter(Boolean).join(' ');
};

const isNavMenuOpen = computed(() => store.openSheet === 'navMenu');
const onNavMenuChange = (val) => {
  store.setOpenSheet(val ? 'navMenu' : null);
};

// At top → full refresh; mid-page → smooth scroll up. preventDefault
// avoids the native instant-jump of <a href="#">.
const handleLogoClick = (e) => {
  if (window.scrollY === 0) {
    store.setRefreshEveryThing(true);
  } else {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  trackEvent('Nav', 'NavClick', 'Logo');
};

// Menu scroll (leave space for sticky header)
const scrollToSection = (el, offset = 70) => {
  const element = typeof el === 'string' ? document.getElementById(el) : el;
  if (!element) return;
  const y = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

// Open a tool's page from the nav, closing the mobile nav Sheet first (a
// no-op on desktop) so it isn't left open behind the tool.
const openTool = (slug) => {
  store.setOpenSheet(null);
  router.push(`/tools/${slug}`);
  const name = slug.charAt(0).toUpperCase() + slug.slice(1);
  trackEvent('Nav', 'NavClick', name);
};

// Mobile: hide nav on scroll-down, show on scroll-up.
// SCROLL_DELTA filters out micro-jitter; SHOW_AT_TOP forces the nav
// visible near the top of the page regardless of direction.
const isNavHidden = ref(false);
let lastScrollY = 0;
let scrollTicking = false;
const SCROLL_DELTA = 5;
const SHOW_AT_TOP = 48;

const onScroll = () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    const dy = y - lastScrollY;
    if (y <= SHOW_AT_TOP) {
      isNavHidden.value = false;
    } else if (Math.abs(dy) > SCROLL_DELTA) {
      // Keep nav visible while the menu sheet is open so its close
      // affordance stays in place.
      if (dy > 0 && !isNavMenuOpen.value) {
        isNavHidden.value = true;
      } else if (dy < 0) {
        isNavHidden.value = false;
      }
    }
    lastScrollY = y;
    scrollTicking = false;
  });
};

// The listener runs on mobile while the homepage is the page on screen (it
// stays alive in a KeepAlive while a tool page shows); re-attaching resyncs
// lastScrollY so the first scroll after coming back isn't a phantom jump.
const navActive = useRouteActive();
const tracksScroll = computed(() => isMobile.value && navActive.value);
const setScrollListener = (on) => {
  if (on) {
    lastScrollY = window.scrollY;
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    window.removeEventListener('scroll', onScroll);
  }
};

watch(isMobile, (mobile) => {
  if (!mobile) isNavHidden.value = false;
});
watch(tracksScroll, setScrollListener);

onMounted(() => {
  if (tracksScroll.value) setScrollListener(true);
  fetchGithubStars();
});

onBeforeUnmount(() => {
  setScrollListener(false);
});
</script>

<style scoped>
.jn-shimmer-light,
.jn-shimmer-dark {
  position: relative;
  overflow: hidden;
  display: inline-flex;
}

.jn-shimmer-light::before,
.jn-shimmer-dark::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: -100%;
  width: 100%;
  height: 10%;
  animation: jn-shimmer-slide 1s linear infinite;
}

.jn-shimmer-light::before {
  background-color: rgb(0, 0, 0);
}

.jn-shimmer-dark::before {
  background-color: rgb(255, 255, 255);
}

@keyframes jn-shimmer-slide {
  from {
    left: -100%;
  }

  to {
    left: 100%;
  }
}
</style>
