<template>
  <!-- Nav -->
  <header
    class="sticky top-0 z-40 w-full border-b bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur">
    <nav id="navbar-top"
      class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 sm:px-4 h-14">

      <!-- Left: Hamburger (only mobile) + Brand -->
      <div class="flex items-center gap-2">
        <Button v-if="isMobile" variant="ghost" size="icon" class="size-8"
          :aria-expanded="isNavMenuOpen" aria-label="Toggle navigation menu"
          @click="store.toggleSheet('navMenu')">
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
        <a v-for="item in navItems" :key="item" href="#"
        class=""
          :class="navLinkClass(item)"
          @click.prevent="scrollToSection(item); trackEvent('Nav', 'NavClick', item)">
          {{ t(`nav.${item}`) }}
        </a>
        <a :href="t('page.footerLink')" target="_blank" rel="noopener"
          class="ml-2 inline-flex items-center hover:opacity-80 transition-opacity"
          aria-label="View source on GitHub">
          <img src="https://img.shields.io/github/stars/jason5ng32/MyIP"
            alt="GitHub stars" class="h-5">
        </a>
      </div>

      <!-- Right: Action area (ml-auto push to the right) -->
      <div class="ml-auto flex items-center gap-2">
        <!-- Mobile: GitHub icon -->
        <Button v-if="isMobile" variant="ghost" size="icon" class="size-8" as-child>
          <a :href="t('page.footerLink')" target="_blank" rel="noopener"
            aria-label="View source on GitHub">
            <Github />
          </a>
        </Button>

        <!-- Preferences -->
        <JnTooltip :text="t('shortcutKeys.Preferences')">
          <Button variant="ghost" size="icon" class="size-8"
            aria-label="Open preferences" @click="OpenPreferences">
            <SlidersHorizontal />
          </Button>
        </JnTooltip>

        <!-- Sign In / User Dropdown -->
        <DropdownMenu v-if="isFireBaseSet">
          <DropdownMenuTrigger as-child>
            <!-- Not signed in -->
            <Button v-if="!isSignedIn"  size="sm" @click="getUserInfo" class="h-8 gap-1.5">
              <span>{{ t('user.SignIn') }}</span>
              <ChevronDown class="opacity-60" />
            </Button>
            <Button v-else variant="ghost" size="sm" @click="getUserInfo"
              class="h-8 gap-1.5 px-1.5" aria-label="User menu">
              <span class="inline-flex size-6 overflow-hidden rounded-full">
                <img :src="userPhotoURL" :alt="userName" :title="userName"
                  class="size-full object-cover" referrerpolicy="no-referrer">
              </span>
              <span v-if="!isMobile" class="text-sm font-medium max-w-40 truncate">{{ userName }}</span>
              <ChevronDown class="opacity-60" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" class="w-56 shadow-md">
            <!-- Signed in -->
            <template v-if="isSignedIn">
              <div class="px-2 pt-2 pb-3">
                <div class="flex items-center gap-3">
                  <span class="inline-flex size-10 overflow-hidden rounded-full shrink-0">
                    <img :src="userPhotoURL" :alt="userName" class="size-full object-cover" referrerpolicy="no-referrer">
                  </span>
                  <div class="flex min-w-0 flex-1 flex-col gap-1">
                    <span class="truncate text-sm font-semibold leading-none">{{ userName }}</span>
                    <span v-if="remoteUserInfoFetched">
                      <Badge :class="levelBadgeClass" class="border-transparent text-[10px] font-medium px-1.5 py-0 h-4">
                        {{ t('user.Level.' + remoteUserInfo.userLevel) }}
                      </Badge>
                    </span>
                    <span v-else class="text-xs text-muted-foreground">{{ t('user.Fields.Fetching') }}</span>
                  </div>
                </div>
                <dl class="mt-3 space-y-1 text-xs">
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-muted-foreground">{{ t('user.Fields.CreatedAt') }}</dt>
                    <dd class="font-medium">{{ userCreatedAt }}</dd>
                  </div>
                  <div class="flex items-baseline justify-between gap-2">
                    <dt class="text-muted-foreground">{{ t('user.Fields.FunctionUses') }}</dt>
                    <dd class="font-medium">
                      <span v-if="remoteUserInfoFetched">{{ remoteUserInfo.functionUses.total }} {{ t('user.Fields.Times') }}</span>
                      <span v-else class="text-muted-foreground">{{ t('user.Fields.Fetching') }}</span>
                    </dd>
                  </div>
                </dl>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="store.setTriggerAchievements(true)">
                <Award />
                <span>{{ t('user.MyAchievements') }}</span>
              </DropdownMenuItem>
            </template>

            <!-- Not signed in -->
            <template v-else>
              <DropdownMenuItem @select="store.signInWithGoogle">
                <Chrome />
                <span>{{ t('user.SignInWithGoogle') }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="store.signInWithGithub">
                <Github />
                <span>{{ t('user.SignInWithGithub') }}</span>
              </DropdownMenuItem>
            </template>

            <DropdownMenuSeparator />
            <DropdownMenuItem @select="store.setTriggerUserBenefits(true)">
              <HeartHandshake />
              <span>{{ t('user.Benefits.Title') }}</span>
            </DropdownMenuItem>

            <template v-if="isSignedIn">
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="store.signOut">
                <LogOut />
                <span>{{ t('user.SignOut') }}</span>
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>

    <!-- Mobile navigation drawer -->
    <Sheet v-if="isMobile" :open="isNavMenuOpen" @update:open="onNavMenuChange">
      <SheetContent side="left" class="w-72 p-0" :title="t('nav.Navigation')">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <h5 class="m-0 text-base font-semibold">{{ t('nav.Navigation') }}</h5>
          <SheetClose />
        </div>
        <nav class="flex flex-col gap-0.5 p-3">
          <a v-for="item in navItems" :key="item" href="#"
            :class="navLinkClass(item, { block: true })"
            @click.prevent="scrollToSection(item); trackEvent('Nav', 'NavClick', item); store.setOpenSheet(null)">
            {{ t(`nav.${item}`) }}
          </a>
          <a :href="t('page.footerLink')" target="_blank" rel="noopener"
            class="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Github class="size-4" />
            <span>Star on GitHub</span>
          </a>
        </nav>
      </SheetContent>
    </Sheet>
  </header>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import unixToDateTime from '@/utils/timestamp-to-date';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Award, ChevronDown, Chrome, Github, HeartHandshake,
  LogOut, Menu, SlidersHorizontal,
} from 'lucide-vue-next';
import brandIcon from './svgicons/Brand.vue';
import { SECTION_IDS } from '@/data/sections';

const { t } = useI18n();
const store = useMainStore();

// Basic state
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const currentSection = computed(() => store.currentSection);
const loaded = ref(false);

// Navigation items (desktop + mobile share the same list)
const navItems = SECTION_IDS;

// nav link style — current section highlight use bg-accent instead of only bold
const navLinkClass = (item, { block = false } = {}) => {
  const base = 'rounded-md px-3 py-1.5 text-sm font-medium no-underline cursor-pointer transition-colors';
  const state = item === currentSection.value
    ? 'bg-accent text-accent-foreground'
    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
  return [base, state, block ? 'block' : ''].filter(Boolean).join(' ');
};

// Firebase / User
const isFireBaseSet = computed(() => store.isFireBaseSet);
const isSignedIn = computed(() => store.isSignedIn);
const userName = computed(() => store.user?.displayName);
const userPhotoURL = computed(() => store.user?.photoURL);
const userCreatedAt = computed(() => unixToDateTime(store.user?.metadata.createdAt));
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

// Level Badge Color: mapped to semantic token, keep each level color distinction
const levelBadgeClass = computed(() => {
  const level = remoteUserInfo.value?.userLevel;
  switch (level) {
    case 'Premium':        return 'bg-action text-action-foreground';   
    case 'Owner':          return 'bg-foreground text-background';      
    case 'Developer':      return 'bg-success text-success-foreground'; 
    case 'HonoraryMember': return 'bg-warning text-warning-foreground'; 
    case 'Standard':
    default:               return 'bg-muted-foreground text-background';
  }
});

const getUserInfo = async () => {
  if (remoteUserInfoFetched.value || !isSignedIn.value) return;
  store.setTriggerRemoteUserInfo(true);
};


const isNavMenuOpen = computed(() => store.openSheet === 'navMenu');
const onNavMenuChange = (val) => {
  store.setOpenSheet(val ? 'navMenu' : null);
};

// Open preferences — consumed by `p` key in use-shortcuts.js defineExpose
const OpenPreferences = () => {
  store.toggleSheet('preferences');
  trackEvent('Nav', 'NavClick', 'Preferences');
};

// Logo click:
//   - Page middle → smooth scroll to top
//   - Already at top → trigger full refresh
// Note: native behavior of <a href="#"> is to jump to top instantly, not smooth scrolling.
// Here we prevent the default behavior and use window.scrollTo + smooth to ensure the animation effect.
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

watch(() => store.allHasLoaded, (newValue) => { loaded.value = newValue; });

defineExpose({ OpenPreferences });
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

.jn-shimmer-light::before { background-color: rgb(0, 0, 0); }
.jn-shimmer-dark::before  { background-color: rgb(255, 255, 255); }

@keyframes jn-shimmer-slide {
  from { left: -100%; }
  to   { left: 100%; }
}
</style>
