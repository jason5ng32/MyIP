<template>
  <!-- Nav -->
  <header class="mb-3 jn-navbar-top bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
    <nav id="navbar-top" class="mx-auto w-full max-w-[1600px] flex flex-wrap items-center justify-between py-2 px-3">
      <button class="jn-hamburger-button p-1 border border-neutral-300 dark:border-neutral-600 rounded bg-transparent cursor-pointer"
        type="button" @click="store.toggleSheet('navMenu')" aria-controls="offcanvasNavbar">
        <span class="inline-block w-6 h-6 jn-hamburger-icon"></span>
      </button>

      <div class="jn-logo flex items-center">
        <a class="inline-flex items-center mr-4 text-lg font-semibold no-underline text-neutral-900 dark:text-white"
          href="#" @click="handleLogoClick">
          <brandIcon />
          <span class="font-bold">IP</span>
          <span class="font-extralight">Check.</span>
          <span class="font-extralight" :class="{
              'background-animation-dark': !loaded && isDarkMode,
              'background-animation-light': !loaded && !isDarkMode
            }">ing</span>
        </a>
      </div>

      <!-- 桌面端：直接渲染菜单 -->
      <div v-if="!isMobile" class="flex items-center">
        <div class="flex flex-row list-none m-0 p-0">
          <a type="button"
            v-for="item in ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools']"
            :key="item"
            class="block px-3 py-2 no-underline cursor-pointer text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
            :class="{
              'text-neutral-900 dark:text-white font-semibold': item === currentSection,
            }"
            @click="scrollToSection(item); trackEvent('Nav', 'NavClick', item)">
            {{ t(`nav.${item}`) }}
          </a>
        </div>
        <a class="ms-2 flex items-center" :href="t('page.footerLink')" target="_blank">
          <img src="https://img.shields.io/github/stars/jason5ng32/MyIP" />
        </a>
      </div>

      <!-- 移动端：Sheet 菜单 -->
      <Sheet v-if="isMobile" :open="isNavMenuOpen" @update:open="onNavMenuChange">
        <SheetContent side="bottom" :title="t('nav.Navigation')"
          :class="cn('h-1/2 overflow-y-auto pt-3')">
          <div class="flex items-center justify-between px-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
            <h5 class="m-0 text-lg font-semibold">{{ t('nav.Navigation') }}</h5>
            <SheetClose />
          </div>
          <div class="p-4">
            <div class="flex flex-col">
              <a type="button"
                v-for="item in ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools']"
                :key="item"
                class="block px-3 py-2 no-underline cursor-pointer text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
                :class="{
                  'text-neutral-900 dark:text-white font-semibold': item === currentSection,
                }"
                @click="scrollToSection(item); trackEvent('Nav', 'NavClick', item); store.setOpenSheet(null)">
                {{ t(`nav.${item}`) }}
              </a>
            </div>
            <a class="mt-2 flex items-center" :href="t('page.footerLink')" target="_blank">
              <img src="https://img.shields.io/github/stars/jason5ng32/MyIP" />
            </a>
          </div>
        </SheetContent>
      </Sheet>

      <div id="Preferences" class="preference-button ml-2 cursor-pointer" @click.prevent="OpenPreferences" role="button"
        aria-label="Preferences">
        <SlidersHorizontal class="inline size-[1em] align-[-0.125em]" />
      </div>

      <!-- Sign In -->
      <div v-if="isFireBaseSet" id="signin" class="flex items-center ms-2">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button type="button" @click="getUserInfo"
              class="inline-flex items-center px-3 py-1.5 rounded-md border text-sm font-medium transition-colors cursor-pointer"
              :class="isDarkMode
                ? 'border-neutral-100 text-neutral-100 bg-transparent hover:bg-neutral-100 hover:text-neutral-900'
                : 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800'">
              <span v-if="!isSignedIn">{{ t('user.SignIn') }}</span>
              <span v-if="isSignedIn" class="jn-avatar">
                <img :src="userPhotoURL" alt="User Avatar" class="avatar" :title="userName">
              </span>
              <span v-if="isSignedIn && !isMobile">&nbsp;{{ userName }}</span>
              <span class="inline-block ml-1 border-t-[0.3em] border-x-[0.3em] border-x-transparent" aria-hidden="true"></span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel v-if="isSignedIn" class="flex flex-col">
              <span>{{ t('user.Fields.User') }} : {{ userName }}</span>
              <span>{{ t('user.Fields.CreatedAt') }} : {{ userCreatedAt }}</span>
              <span class="flex items-center">{{ t('user.Fields.Level') }} :&nbsp;
                <Badge v-if="remoteUserInfoFetched"
                  :class="{
                    'bg-neutral-500 text-white border-transparent': remoteUserInfo.userLevel === 'Standard',
                    'bg-blue-600 text-white border-transparent': remoteUserInfo.userLevel === 'Premium',
                    'bg-neutral-900 text-white border-transparent dark:bg-neutral-100 dark:text-neutral-900': remoteUserInfo.userLevel === 'Owner',
                    'bg-green-600 text-white border-transparent': remoteUserInfo.userLevel === 'Developer',
                    'bg-yellow-500 text-neutral-900 border-transparent': remoteUserInfo.userLevel === 'HonoraryMember',
                  }">
                  {{ t('user.Level.' + remoteUserInfo.userLevel) }}
                </Badge>
                <span v-else>{{ t('user.Fields.Fetching') }}</span>
              </span>
              <span>{{ t('user.Fields.FunctionUses') }} :&nbsp;
                <span v-if="remoteUserInfoFetched">{{ remoteUserInfo.functionUses.total }} {{ t('user.Fields.Times') }}</span>
                <span v-else>{{ t('user.Fields.Fetching') }}</span>
              </span>
            </DropdownMenuLabel>
            <template v-if="isSignedIn">
              <DropdownMenuItem @select="store.setTriggerAchievements(true)">
                <Award class="inline size-[1em] align-[-0.125em]" />&nbsp;{{ t('user.MyAchievements') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </template>
            <template v-if="!isSignedIn">
              <DropdownMenuItem @select="store.signInWithGoogle">
                <Chrome class="inline size-[1em] align-[-0.125em]" />&nbsp;{{ t('user.SignInWithGoogle') }}
              </DropdownMenuItem>
              <DropdownMenuItem @select="store.signInWithGithub">
                <Github class="inline size-[1em] align-[-0.125em]" />&nbsp;{{ t('user.SignInWithGithub') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </template>
            <DropdownMenuItem @select="store.setTriggerUserBenefits(true)">
              <HeartHandshake class="inline size-[1em] align-[-0.125em]" />&nbsp;{{ t('user.Benefits.Title') }}
            </DropdownMenuItem>
            <template v-if="isSignedIn">
              <DropdownMenuSeparator />
              <DropdownMenuItem @select="store.signOut">
                <LogOut class="inline size-[1em] align-[-0.125em]" />&nbsp;{{ t('user.SignOut') }}
              </DropdownMenuItem>
            </template>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Award, Chrome, Github, HeartHandshake, LogOut, SlidersHorizontal } from 'lucide-vue-next';

const { t } = useI18n();

// 导入 Logo 图标
import brandIcon from './svgicons/Brand.vue';

// 基础数据
const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const loaded = ref(false);

// 导航
const currentSection = computed(() => store.currentSection);

// 判断是否启用 Firebase
const isFireBaseSet = computed(() => store.isFireBaseSet);

// 本地用户信息
const isSignedIn = computed(() => store.isSignedIn);
const userName = computed(() => store.user?.displayName);
const userPhotoURL = computed(() => store.user?.photoURL);
const userCreatedAt = computed(() => unixToDateTime(store.user?.metadata.createdAt));

// 远程用户信息
const remoteUserInfo = computed(() => store.remoteUserInfo);
const remoteUserInfoFetched = computed(() => store.remoteUserInfoFetched);

// 触发远程获取用户信息
const getUserInfo = async () => {
  if (remoteUserInfoFetched.value || !isSignedIn.value) {
    return;
  }
  // 获取一次用户信息，以防没有
  store.setTriggerRemoteUserInfo(true);
}

// 移动端导航菜单 Sheet 开关（refactor/01）
const isNavMenuOpen = computed(() => store.openSheet === 'navMenu');
const onNavMenuChange = (val) => {
  store.setOpenSheet(val ? 'navMenu' : null);
};

// 打开偏好设置（通过 store 驱动 Preferences.vue 里的 Sheet）
const OpenPreferences = () => {
  store.toggleSheet('preferences');
  trackEvent('Nav', 'NavClick', 'Preferences');
};

// 点击 Logo 事件处理
const handleLogoClick = () => {
  if (window.scrollY === 0) {
    store.setRefreshEveryThing(true);
    // loaded.value = false;
  }
  trackEvent('Nav', 'NavClick', 'Logo');
};

// 菜单栏滚动
const scrollToSection = (el, offset = 70) => {
  const element = typeof el === "string" ? document.getElementById(el) : el;
  const y = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top: y, behavior: "smooth" });
}

watch(() => store.allHasLoaded, (newValue) => {
  loaded.value = newValue;
});

// 暴露给 App.vue 的数据
defineExpose({
  OpenPreferences,
});
</script>

<style scoped>
.jn-fs {
  font-size: smaller;
  display: flex;
  max-height: 25pt;
  overflow: hidden;
  width: fit-content;
}

.jn-w {
  width: 60pt;
}

.preference-button {
  margin-left: 8pt;
}

.container-xxl {
  max-width: 1600px;
}

.jn-avatar {
  display: flex;
  width: 18pt;
  height: 18pt;
  overflow: hidden;
  border-radius: 50%;
}

/* 大屏幕上隐藏汉堡包按钮（桌面端菜单由 v-if="!isMobile" 直接渲染，refactor/01） */
@media (min-width: 992px) {
  .jn-hamburger-button {
    display: none;
  }
}

/* refactor/01 C.2：汉堡包图标（原 navbar-toggler-icon 背景图） */
.jn-hamburger-icon {
  background: center/100% no-repeat url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%2833, 37, 41, 0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
}
:global(.dark) .jn-hamburger-icon {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255,255,255,0.75%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
}

/* Logo 上的加载动画 */
.background-animation-light {
  position: relative;
  overflow: hidden;
  display: inline-flex;
}

.background-animation-light::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: -100%;
  width: 100%;
  height: 10%;
  background-color: rgb(0, 0, 0);
  animation: backgroundSlide 1s linear infinite;
}

.background-animation-dark {
  position: relative;
  overflow: hidden;
  display: inline-flex;
}

.background-animation-dark::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: -100%;
  width: 100%;
  height: 10%;
  background-color: rgb(255, 255, 255);
  animation: backgroundSlide 1s linear infinite;
}

@keyframes backgroundSlide {
  from {
    left: -100%;
  }

  to {
    left: 100%;
  }
}
</style>
