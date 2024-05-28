<template>
  <!-- Nav -->
  <header class="navbar navbar-expand-lg bg-body-tertiary mb-3 jn-navbar-top "
    :class="{ 'dark-mode-nav navbar-dark bg-dark': isDarkMode }">
    <nav id="navbar-top" class="container-xxl">
      <div class="jn-logo">

        <a class="navbar-brand d-flex align-items-center align-content-center" :class="{ 'text-white': isDarkMode }"
          href="#" @click="handleLogoClick">
          <svg :style="{ fill: isDarkMode ? '#fff' : '#212529' }" class="me-1" width="23" height="23"
            xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision"
            image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 511 512.35">
            <path
              d="M162.62,21.9026663 C157.13,27.3326663 151.99,33.9226663 147.2,41.6126663 C129.83,69.4326663 116.87,111.602666 107.28,164.772666 C50.98,175.412666 16.22,198.912666 17.38,222.912666 C18.42,244.652666 45.84,261.322666 87.05,272.832666 C84.34,281.212666 84.98,282.652666 88.65,292.962666 C57.87,305.942666 25.71,345.362666 0,379.892666 L100.03,447.502666 L64.71,512.352666 L449.12,512.352666 L411.86,447.502666 L511,378.632666 C481.92,337.782666 446.81,303.072666 424.88,293.652666 C429.51,281.632666 430.32,279.532666 426.44,272.862666 C467.65,261.142666 494.67,244.022666 494.61,221.392666 C494.55,196.712666 459.11,173.012666 406.3,164.772666 C393.66,111.272666 381.08,69.1526663 365.07,41.5026663 C362.16,36.4826663 359.14,31.9326663 355.98,27.8826663 C308.32,-33.2373337 291.62,25.1926663 257.84,25.1226663 C218.67,25.0426663 213.69,-28.5673337 162.62,21.9026663 Z M223.27,419.802666 C223.27,416.232666 226.17,413.332666 229.74,413.332666 L240.26,413.332666 C241.64,413.332666 242.92,413.772666 243.96,414.502666 C247.73,416.602666 251.42,417.832666 254.97,417.922666 C256.256726,417.95538 257.551379,417.837477 258.853959,417.554552 C261.134997,417.059103 263.440344,416.057596 265.77,414.472666 C266.837339,413.754341 268.093464,413.368108 269.38,413.362666 L282.16,413.332666 C285.73,413.332666 288.62,416.232666 288.62,419.802666 C288.62,423.372666 285.73,426.272666 282.16,426.272666 L271.21,426.272666 C265.75,429.542666 260.23,430.942666 254.67,430.802666 C249.23,430.662666 243.89,429.032666 238.66,426.272666 L229.74,426.272666 C226.17,426.272666 223.27,423.372666 223.27,419.802666 Z M160.62,279.492666 C221.05,301.232666 281.49,300.872666 341.92,281.322666 C283.47,286.072666 219.13,284.942666 160.62,279.492666 Z M267.04,306.612666 L244.93,306.612666 C210.81,384.892666 122.79,350.782666 142.77,277.672666 C135.46,276.872666 128.26,275.992666 121.21,275.052666 L120.89,276.932666 L120.3,280.492666 L116.82,301.362666 C86.43,294.642666 103.46,373.132666 131.08,366.232666 C135.3,378.412666 136.442197,389.44711 142.34,398.422666 C171.368144,442.599077 205.648487,494.791988 256.040415,494.791988 C306.432342,494.791988 341.594767,438.778379 368.99,398.422666 C375.513955,388.812277 376.14,383.142666 380.53,369.392666 C405.97,373.452666 426.88,296.082666 395.87,301.762666 L392.68,280.712666 L392.13,277.062666 L391.9,275.522666 C384.43,276.682666 376.78,277.722666 368.99,278.632666 C389.88,349.262666 300.46,385.132666 267.04,306.612666 Z M284.280512,176.166601 L284.280512,67.1666006 C366.547618,67.1666006 361.40053,176.166601 284.280512,176.166601 Z M170.780508,409.666601 C182.571845,404.08157 211.029823,401.289054 256.154442,401.289054 C301.27906,401.289054 329.487749,404.08157 340.780508,409.666601 C340.780508,398.413948 339.802073,389.918194 323.84137,384.371704 C288.837937,372.207694 222.824258,373.335802 189.15409,384.371704 C170.816498,390.382125 170.780508,397.067154 170.780508,409.666601 Z M206.779566,446.766602 C218.286957,452.470688 235.027101,455.322731 257,455.322731 C278.972899,455.322731 295.566401,452.470688 306.780508,446.766602 C306.780508,458.019255 306.204953,466.515009 296.816215,472.061498 C286.632212,478.077798 271.985838,480.842479 257.386147,480.76502 C242.467564,480.685868 227.597726,477.639061 217.587657,472.061498 C206.800736,466.051077 206.779566,459.366048 206.779566,446.766602 Z M256.254843,67.1117579 L229.254843,87.6169826 C229.254843,124.271828 229.254843,160.370447 229.254843,204.775426 L256.254843,208.111758 C256.254843,143.245746 256.254843,107.726499 256.254843,67.1117579 Z M207.254843,67.1117579 L180.254843,87.6169826 C180.254843,124.271828 180.254843,160.370447 180.254843,204.775426 L207.254843,208.111758 C207.254843,143.245746 207.254843,107.726499 207.254843,67.1117579 Z"
              id="Logo"></path>
          </svg>
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
