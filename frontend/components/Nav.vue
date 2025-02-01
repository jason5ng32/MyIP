<template>
  <!-- Nav -->
  <header class="navbar navbar-expand-lg bg-body-tertiary mb-3 jn-navbar-top "
    :class="{ 'dark-mode-nav navbar-dark bg-dark': isDarkMode }">
    <nav id="navbar-top" class="container-xxl">
      <button class="navbar-toggler jn-hamburger-button" type="button" data-bs-toggle="offcanvas"
        data-bs-target="#offcanvasNavbar" aria-controls="offcanvasNavbar">
        <span class="navbar-toggler-icon bg-transparent"></span>
      </button>

      <div class="jn-logo">
        <a class="navbar-brand d-flex align-items-center align-content-center" :class="{ 'text-white': isDarkMode }"
          href="#" @click="handleLogoClick">
          <brandIcon />
          <span class=" fw-bold  "> IP</span>
          <span class="fw-lighter">Check.</span>
          <span class="fw-lighter" :class="{
              'background-animation-dark': !loaded && isDarkMode,
              'background-animation-light': !loaded && !isDarkMode
            }">ing
          </span>
        </a>
      </div>

      <!-- Menu Bar, Expand on PC -->
      <div :data-bs-theme="isDarkMode ? 'dark' : ''" class="offcanvas offcanvas-bottom"
        :class="[isMobile ? 'h-50' : '']" tabindex="-1" id="offcanvasNavbar" aria-labelledby="offcanvasNavbarLabel">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title">{{t('nav.Navigation')}}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body" :class="[!isMobile ? 'd-flex align-items-center' : '']">
          <div class="navbar-nav">
            <a type="button"
              v-for="item in ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools']"
              :key="item" class="nav-link" :class="{ 
                'text-white': item === currentSection && isDarkMode,
                'text-dark': item === currentSection && !isDarkMode,
                }" @click="scrollToSection(item) ; trackEvent('Nav', 'NavClick', item)">
              {{ t(`nav.${item}`) }}
            </a>
          </div>
          <a :class="[isMobile ? 'mt-2':'ms-2']" :href="t('page.footerLink')" target="_blank"
            class="d-flex align-items-center">
            <img src="https://img.shields.io/github/stars/jason5ng32/MyIP" />
          </a>
        </div>
      </div>

      <div id="Preferences" class="preference-button" @click.prevent="OpenPreferences" role="button"
        aria-label="Preferences">
        <i class="bi bi-toggles"></i>
      </div>

      <!-- Sign In -->
      <div v-if="isFireBaseSet" id="signin" class="d-flex align-items-center ms-2">

        <div class="dropdown">
          <button class="btn dropdown-toggle d-flex align-items-center flex-row "
            :class="{ 'btn-outline-light': isDarkMode, 'btn-dark': !isDarkMode }" type="button"
            data-bs-toggle="dropdown" :data-bs-theme="isDarkMode ? 'dark' : ''" aria-expanded="false"
            @click="getUserInfo">
            <span v-if="!isSignedIn">
              {{ t('user.SignIn') }}
            </span>
            <span v-if="isSignedIn" class="jn-avatar">
              <img :src="userPhotoURL" alt="User Avatar" class="avatar" :title="userName">
            </span>
            <span v-if="isSignedIn && !isMobile">
              &nbsp;{{userName}}
            </span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" :data-bs-theme="isDarkMode ? 'dark' : ''">
            <li v-if="isSignedIn" class="dropdown-header d-flex flex-column">
              <span>{{ t('user.Fields.User') }} : {{ userName }}</span>
              <span>{{ t('user.Fields.CreatedAt') }} : {{ userCreatedAt }}</span>
              <span class="d-flex align-items-center">{{ t('user.Fields.Level') }} :&nbsp;
                <span v-if="remoteUserInfoFetched" class="badge" :class="{
                  'text-bg-secondary': remoteUserInfo.userLevel === 'Standard',
                  'text-bg-primary': remoteUserInfo.userLevel === 'Premium',
                  'text-bg-dark': remoteUserInfo.userLevel === 'Owner' && !isDarkMode,
                  'text-bg-light': remoteUserInfo.userLevel === 'Owner' && isDarkMode,
                  'text-bg-success': remoteUserInfo.userLevel === 'Developer',
                  'text-bg-warning': remoteUserInfo.userLevel === 'HonoraryMember',
                }">{{ t('user.Level.' + remoteUserInfo.userLevel)}}</span>
                <span v-else>{{ t('user.Fields.Fetching') }}</span>
              </span>
              <span>{{ t('user.Fields.FunctionUses') }} :&nbsp;
                <span v-if="remoteUserInfoFetched">{{ remoteUserInfo.functionUses.total }}
                  {{ t('user.Fields.Times') }}
                </span>
                <span v-else>{{ t('user.Fields.Fetching') }}</span>
              </span>
            </li>
            <template v-if="isSignedIn">
              <li>
                <button type="button" class="dropdown-item" @click="store.setTriggerAchievements(true)"><i
                    class="bi bi-award-fill"></i> {{t('user.MyAchievements')}} </button>
              </li>
              <li>
                <hr class="dropdown-divider" />
              </li>
            </template>
            <template v-if="!isSignedIn">
              <li><button type="button" class="dropdown-item" @click="store.signInWithGoogle"><i
                    class="bi bi-google"></i> {{ t('user.SignInWithGoogle') }}</button></li>
              <li><button type="button" class="dropdown-item" @click="store.signInWithGithub"><i
                    class="bi bi-github"></i> {{ t('user.SignInWithGithub') }}</button></li>
              <li>
                <hr class="dropdown-divider" />
              </li>
            </template>
            <li><button type="button" class="dropdown-item" @click="store.setTriggerUserBenefits(true)"><i
                  class="bi bi-person-hearts"></i>
                {{
                t('user.Benefits.Title') }}</button></li>
            <template v-if="isSignedIn">
              <li>
                <hr class="dropdown-divider" />
              </li>
              <li><button type="button" class="dropdown-item" @click="store.signOut"><i
                    class="bi bi-box-arrow-right"></i> {{ t('user.SignOut')
                  }}</button>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </nav>
  </header>

</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Offcanvas } from 'bootstrap';
import unixToDateTime from '@/utils/timestamp-to-date';

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

// 打开偏好设置
const OpenPreferences = () => {
  const offcanvasElement = document.getElementById('offcanvasPreferences');
  let offcanvas = Offcanvas.getInstance(offcanvasElement) || new Offcanvas(offcanvasElement);
  if (offcanvasElement.classList.contains('show')) {
    offcanvas.hide();
  } else {
    offcanvas.show();
  }

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

/* 大屏幕上隐藏汉堡包按钮 */
@media (min-width: 992px) {
  .jn-hamburger-button {
    display: none;
  }

  #offcanvasNavbar {
    display: flex;
  }

  .offcanvas.offcanvas-bottom {
    height: auto !important;
    transform: none !important;
    visibility: visible !important;
  }

  .offcanvas-header {
    display: none;
  }
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
