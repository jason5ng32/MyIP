<template>
  <!-- Nav — refactor/UI: 粘顶 + backdrop-blur，现代 shadcn-vue 视觉 -->
  <header
    class="sticky top-0 z-40 w-full border-b border-neutral-200/70 dark:border-neutral-800/70 bg-neutral-50/80 dark:bg-neutral-900/80 supports-[backdrop-filter:blur(0px)]:bg-neutral-50/60 supports-[backdrop-filter:blur(0px)]:dark:bg-neutral-900/60 backdrop-blur">
    <nav id="navbar-top"
      class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-3 sm:px-4 h-14">

      <!-- 左：汉堡包（仅移动端） + 品牌 -->
      <div class="flex items-center gap-2">
        <Button v-if="isMobile" variant="ghost" size="icon" class="size-8"
          :aria-expanded="isNavMenuOpen" aria-label="Toggle navigation menu"
          @click="store.toggleSheet('navMenu')">
          <Menu />
        </Button>
        <a href="#" @click="handleLogoClick"
          class="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-lg font-semibold text-neutral-900 no-underline hover:opacity-80 transition-opacity dark:text-white">
          <brandIcon />
          <span class="tracking-tight">
            <span class="font-bold">IP</span><span class="font-extralight">Check.</span><span
              class="font-extralight"
              :class="{ 'jn-shimmer-light': !loaded && !isDarkMode, 'jn-shimmer-dark': !loaded && isDarkMode }">ing</span>
          </span>
        </a>
      </div>

      <!-- 中：桌面 nav 链接 + GitHub 星数徽章（左对齐，紧挨品牌） -->
      <div v-if="!isMobile" class="flex items-center gap-0.5">
        <a v-for="item in navItems" :key="item" href="#"
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

      <!-- 右：动作区（ml-auto 推到最右） -->
      <div class="ml-auto flex items-center gap-2">
        <!-- 移动端：GitHub icon -->
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

        <!-- Sign In / User 下拉 -->
        <DropdownMenu v-if="isFireBaseSet">
          <DropdownMenuTrigger as-child>
            <!-- 未登录：用 outline 与 GitHub 视觉权重一致，不喧宾夺主 -->
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

          <DropdownMenuContent align="end" class="w-56 border-neutral-200 dark:border-neutral-700 shadow-md">
            <!-- 已登录：用户信息卡（头像 + 名字 + Level Badge + 元信息） -->
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

            <!-- 未登录：登录入口 -->
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

    <!-- 移动端导航抽屉 -->
    <Sheet v-if="isMobile" :open="isNavMenuOpen" @update:open="onNavMenuChange">
      <SheetContent side="left" class="w-72 p-0" :title="t('nav.Navigation')">
        <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
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
            class="mt-3 inline-flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">
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

const { t } = useI18n();
const store = useMainStore();

// 基础状态
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const currentSection = computed(() => store.currentSection);
const loaded = ref(false);

// 导航项定义（桌面 + 移动共用一份）
const navItems = ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools'];

// nav 链接样式 —— 当前段落高亮用 bg-accent 而不是只有 bold
const navLinkClass = (item, { block = false } = {}) => {
  const base = 'rounded-md px-3 py-1.5 text-sm font-medium no-underline cursor-pointer transition-colors';
  const state = item === currentSection.value
    ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800 dark:text-white'
    : 'text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-white';
  return [base, state, block ? 'block' : ''].filter(Boolean).join(' ');
};

// Firebase / 用户
const isFireBaseSet = computed(() => store.isFireBaseSet);
const isSignedIn = computed(() => store.isSignedIn);
const userName = computed(() => store.user?.displayName);
const userPhotoURL = computed(() => store.user?.photoURL);
const userCreatedAt = computed(() => unixToDateTime(store.user?.metadata.createdAt));
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

// Level Badge 配色：原来是模板里硬编码 5 分支，抽到 computed 里更整洁
const levelBadgeClass = computed(() => {
  const level = remoteUserInfo.value?.userLevel;
  switch (level) {
    case 'Premium':        return 'bg-blue-600 text-white';
    case 'Owner':          return 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900';
    case 'Developer':      return 'bg-green-600 text-white';
    case 'HonoraryMember': return 'bg-yellow-500 text-neutral-900';
    case 'Standard':
    default:               return 'bg-neutral-500 text-white';
  }
});

const getUserInfo = async () => {
  if (remoteUserInfoFetched.value || !isSignedIn.value) return;
  store.setTriggerRemoteUserInfo(true);
};

// 移动端导航 Sheet 与 store 联动（refactor/01）
const isNavMenuOpen = computed(() => store.openSheet === 'navMenu');
const onNavMenuChange = (val) => {
  store.setOpenSheet(val ? 'navMenu' : null);
};

// 打开偏好设置 — 被 use-shortcuts.js 的 `p` 键 defineExpose 消费
const OpenPreferences = () => {
  store.toggleSheet('preferences');
  trackEvent('Nav', 'NavClick', 'Preferences');
};

// Logo 点击：页面顶端时触发全量刷新
const handleLogoClick = () => {
  if (window.scrollY === 0) store.setRefreshEveryThing(true);
  trackEvent('Nav', 'NavClick', 'Logo');
};

// 菜单栏滚动（留出 sticky header 的偏移量）
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
/* Logo "ing" 加载时的底边微光扫动 —— 产品标识，保留 */
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
