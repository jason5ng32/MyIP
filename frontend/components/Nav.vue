<template>
  <!-- Nav -->
  <header class="navbar navbar-expand-lg bg-body-tertiary mb-3 jn-navbar-top "
    :class="{ 'dark-mode-nav navbar-dark bg-dark': isDarkMode }">
    <nav id="navbar-top" class="container-xxl">
      <div class="jn-logo">

        <a class="navbar-brand d-flex align-items-center align-content-center" :class="{ 'text-white': isDarkMode }"
          href="#" @click="handleLogoClick">
          <brandIcon />
          <span class=" fw-bold  "> IP</span>
          <span class="fw-lighter">Check.</span>
          <span class="fw-lighter" :class="{
          'background-animation-dark': !loaded && isDarkMode,
          'background-animation-light': !loaded && !isDarkMode
        }">ing</span>
        </a>

        <div class="btn-group mx-1" :data-bs-theme="isDarkMode ? 'dark' : 'light'">
          <button type="button" class="btn btn-sm dropdown-toggle jn-button" data-bs-toggle="dropdown"
            aria-expanded="false" aria-label="Language Selection">
            <i class="bi bi-translate"></i>
          </button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" href="?hl=zh" @click="trackEvent('Nav', 'ToggleClick', 'LanguageChange')"><i
                  class="fi fi-cn"></i> 中文</a></li>
            <li><a class="dropdown-item" href="?hl=en" @click="trackEvent('Nav', 'ToggleClick', 'LanguageChange')"><i
                  class="fi fi-us"></i> English</a></li>
            <li><a class="dropdown-item" href="?hl=fr" @click="trackEvent('Nav', 'ToggleClick', 'LanguageChange')"><i
                  class="fi fi-fr"></i> Français</a></li>
          </ul>
        </div>

        <div id="Preferences" class="preference-button" @click.prevent="OpenPreferences" role="button"
          aria-label="Preferences">
          <i class="bi bi-toggles"></i>
        </div>

      </div>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup"
        aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation"
        @click="closeAllOffCanvas">
        <span class="navbar-toggler-icon bg-transparent "></span>
      </button>
      <div class="collapse navbar-collapse justify-content-end" id="navbarNavAltMarkup">
        <!-- 导航循环 -->
        <div class="navbar-nav ">
          <a v-for="item in ['IPInfo', 'Connectivity', 'WebRTC', 'DNSLeakTest', 'SpeedTest', 'AdvancedTools']"
            :key="item" class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" :href="`#${item}`"
            @click="collapseNav(); trackEvent('Nav', 'NavClick', item)">{{
            t(`nav.${item}`) }}</a>
        </div>
        <a :href="t('page.footerLink')" class="btn jn-fs" id="githubStars"
          :class="{ 'btn-outline-light': isDarkMode, 'btn-dark': !isDarkMode, 'mt-2': isMobile, 'ms-2': !isMobile }"
          target="_blank" @click="trackEvent('Footer', 'FooterClick', 'Github');" aria-label="Github">
          <div><i class="bi bi-github"></i></div>
          <div class="row flex-column ">
            <TransitionGroup name="slide-fade">
              <span key="default" class="col-12 jn-w" v-if="githubStars === 0">&nbsp;GitHub</span>
              <span key="stars" class="col-12 jn-w" v-if="githubStars > 0">
                &nbsp;{{ githubStars }}
                <i class="bi bi-star-fill" :class="[isDarkMode ? 'redstar' : 'yellowstar']"></i>
              </span>
            </TransitionGroup>

          </div>
        </a>
      </div>
    </nav>
  </header>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Offcanvas } from 'bootstrap';

const { t } = useI18n();

// 导入 Logo 图标
import brandIcon from './svgicons/Brand.vue';

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);

const loaded = ref(false);
const githubStars = ref(0);

const closeAllOffCanvas = () => {
  const offcanvasElements = document.querySelectorAll('.offcanvas');
  if (offcanvasElements.length === 0) {
    return;
  }
  document.querySelectorAll('.offcanvas').forEach((offcanvas) => {
    const instance = Offcanvas.getInstance(offcanvas);
    if (instance) {
      instance.hide();
    }
  });
};

// 打开偏好设置
const OpenPreferences = () => {
  var offcanvasElement = document.getElementById('offcanvasPreferences');
  var offcanvas = Offcanvas.getInstance(offcanvasElement) || new Offcanvas(offcanvasElement);
  if (offcanvasElement.classList.contains('show')) {
    offcanvas.hide();
  } else {
    offcanvas.show();
  }

  trackEvent('Nav', 'NavClick', 'Preferences');
};

//获取 GitHub stars
const getGitHubStars = async () => {
  const url = `https://api.github.com/repos/jason5ng32/MyIP`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    setTimeout(() => {
      githubStars.value = data.stargazers_count;
    }, 1000);
  } catch (error) {
    console.error('Failed to fetch Github data:', error);
    githubStars.value = 0;
  }
};

// 收起导航栏
const collapseNav = () => {
  document.querySelector('#navbarNavAltMarkup').classList.remove('show');
};


// 点击 Logo 事件处理
const handleLogoClick = () => {
  if (window.scrollY === 0) {
    store.setRefreshEveryThing(true);
    // loaded.value = false;
  }
  trackEvent('Nav', 'NavClick', 'Logo');
};

// 开始时获取 GitHub stars
onMounted(() => {
  setTimeout(() => {
    getGitHubStars();
  }, 1000)
});

watch(() => store.allHasLoaded, (newValue) => {
  loaded.value = newValue;
});

// 暴露给 App.vue 的数据
defineExpose({
  OpenPreferences,
});
</script>

<style scoped>
.jn-checkbox {
  display: none;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-in-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from {
  transform: translateY(30px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-30px);
  opacity: 0;
}

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

.redstar {
  color: rgb(253 131 3);
}

.yellowstar {
  color: rgb(255 216 0);
}

.switch {
  background-color: #111;
  border-radius: 50px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px;
  position: relative;
  height: 26px;
  width: 50px;
  transform: scale(0.7);
  box-shadow: 0 0 2px white;
}

.switch .ball {
  background-color: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  height: 22px;
  width: 22px;
  transform: translateX(0px);
  transition: transform 0.2s linear;
}

.jn-checkbox:checked+.switch .ball {
  transform: translateX(24px);
}

.jn-button:hover {
  border: 0;
}

.jn-button:active {
  border: 0;
}

.jn-button:focus {
  border: 0;
}

.jn-button {
  border: 0;
}

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

.preference-button {
  margin-left: 8pt;
}

.container-xxl {
  max-width: 1600px;
}
</style>
