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
            data-bs-toggle="dropdown" :data-bs-theme="isDarkMode ? 'dark' : ''" aria-expanded="false">
            <span v-if="!store.user">
              {{ t('user.SignIn') }}
            </span>
            <span v-if="store.user" class="jn-avatar">
              <img :src="store.user.photoURL" alt="User Avatar" class="avatar" :title="store.user.displayName">
            </span>
            <span v-if="store.user && !isMobile">
              &nbsp;{{store.user.displayName}}
            </span>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" :data-bs-theme="isDarkMode ? 'dark' : ''">
            <li v-if="!store.user"><a type="button" class="dropdown-item" @click="store.signInWithGoogle"><i
                  class="bi bi-google"></i> {{ t('user.SignInWithGoogle') }}</a></li>
            <li v-if="!store.user"><a type="button" class="dropdown-item" @click="store.signInWithGithub"><i
                  class="bi bi-github"></i> {{ t('user.SignInWithGithub') }}</a></li>
            <li v-if="store.user"><a type="button" class="dropdown-item" @click="store.signOut"><i
                  class="bi bi-box-arrow-right"></i> {{ t('user.SignOut')
                }}</a></li>
            <li>
              <hr class="dropdown-divider" />
            </li>
            <li><a type="button" class="dropdown-item" @click="openUserBenefits"><i class="bi bi-award-fill"></i> {{
                t('user.Benefits.Title') }}</a></li>
          </ul>
        </div>
      </div>
    </nav>
  </header>

  <!-- User Benefits Modal -->
  <div class="modal fade" id="Benefits" tabindex="-1" aria-labelledby="Benefits">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
        <div class="modal-header" :class="{ 'dark-mode-border': isDarkMode }">
          <h5 class="modal-title" id="BenefitsTitle"><i class="bi bi-award-fill"></i> {{ t('user.Benefits.Title') }}
          </h5>
          <button type="button" class="btn-close" :class="{ 'dark-mode-close-button': isDarkMode }"
            data-bs-dismiss="modal" aria-label="Close"></button>

        </div>
        <div class="modal-body m-2" :class="{ 'dark-mode': isDarkMode }">
          <p class="opacity-75">{{ t('user.Benefits.Note1') }}</p>
          <p class="opacity-75">{{ t('user.Benefits.Note2') }}</p>
          <div class="table-responsive text-nowrap">
            <table class="table" :class="{ 'table-dark': isDarkMode }">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{{ t('user.Benefits.Benefit') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">1</th>
                  <td>{{ t('user.Benefits.Benifit1') }}</td>
                </tr>
                <tr>
                  <th scope="row">2</th>
                  <td>{{ t('user.Benefits.Benifit2') }}</td>
                </tr>
                <tr>
                  <th scope="row">3</th>
                  <td>{{ t('user.Benefits.Benifit3') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="opacity-75">{{ t('user.Benefits.FootNote') }}</p>
        </div>
        <div class="modal-footer" :class="{ 'dark-mode-border': isDarkMode }">
        </div>
      </div>
    </div>
  </div>

</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Offcanvas, Modal } from 'bootstrap';

const { t } = useI18n();

// 导入 Logo 图标
import brandIcon from './svgicons/Brand.vue';

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const loaded = ref(false);

const currentSection = computed(() => store.currentSection);
const isFireBaseSet = computed(() => store.isFireBaseSet);

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

// 打开 Modal
const openUserBenefits = () => {
  const modalElement = document.getElementById('Benefits');
  const modalInstance = Modal.getOrCreateInstance(modalElement);
  if (modalInstance) {
    modalInstance.show();
  }

  trackEvent('Nav', 'NavClick', 'UserBenefits');
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
