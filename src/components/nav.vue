<template>
  <!-- Nav -->
  <nav id="navbar-top" class="navbar navbar-expand-lg bg-body-tertiary px-3 mb-3 jn-navbar-top"
    :class="{ 'dark-mode-nav navbar-dark bg-dark': isDarkMode }">
    <div class="jn-logo">

      <a class="navbar-brand d-flex align-items-center align-content-center" :class="{ 'text-white': isDarkMode }"
        href="#" @click="handleLogoClick">
        <svg :style="{ fill: isDarkMode ? '#fff' : '#212529' }" class="me-1" width="23" height="23"
          xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision"
          image-rendering="optimizeQuality" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 511 512.35">
          <path
            d="M162.62,21.9026663 C157.13,27.3326663 151.99,33.9226663 147.2,41.6126663 C129.83,69.4326663 116.87,111.602666 107.28,164.772666 C50.98,175.412666 16.22,198.912666 17.38,222.912666 C18.42,244.652666 45.84,261.322666 87.05,272.832666 C84.34,281.212666 84.98,282.652666 88.65,292.962666 C57.87,305.942666 25.71,345.362666 0,379.892666 L100.03,447.502666 L64.71,512.352666 L449.12,512.352666 L411.86,447.502666 L511,378.632666 C481.92,337.782666 446.81,303.072666 424.88,293.652666 C429.51,281.632666 430.32,279.532666 426.44,272.862666 C467.65,261.142666 494.67,244.022666 494.61,221.392666 C494.55,196.712666 459.11,173.012666 406.3,164.772666 C393.66,111.272666 381.08,69.1526663 365.07,41.5026663 C362.16,36.4826663 359.14,31.9326663 355.98,27.8826663 C308.32,-33.2373337 291.62,25.1926663 257.84,25.1226663 C218.67,25.0426663 213.69,-28.5673337 162.62,21.9026663 Z M223.27,413.802666 C223.27,410.232666 226.17,407.332666 229.74,407.332666 L240.26,407.332666 C241.64,407.332666 242.92,407.772666 243.96,408.502666 C247.73,410.602666 251.42,411.832666 254.97,411.922666 C258.51,412.012666 262.11,410.962666 265.77,408.472666 C266.837339,407.754341 268.093464,407.368108 269.38,407.362666 L282.16,407.332666 C285.73,407.332666 288.62,410.232666 288.62,413.802666 C288.62,417.372666 285.73,420.272666 282.16,420.272666 L271.21,420.272666 C265.75,423.542666 260.23,424.942666 254.67,424.802666 C249.23,424.662666 243.89,423.032666 238.66,420.272666 L229.74,420.272666 C226.17,420.272666 223.27,417.372666 223.27,413.802666 Z M160.62,279.492666 C221.05,301.232666 281.49,300.872666 341.92,281.322666 C283.47,286.072666 219.13,284.942666 160.62,279.492666 Z M267.04,306.612666 L244.93,306.612666 C210.81,384.892666 122.79,350.782666 142.77,277.672666 C135.46,276.872666 128.26,275.992666 121.21,275.052666 L120.89,276.932666 L120.3,280.492666 L116.82,301.362666 C86.43,294.642666 103.46,373.132666 131.08,366.232666 C135.3,378.412666 138.77,388.852666 142.34,398.422666 C179.15,497.252666 333.22,503.232666 369.29,404.782666 C373.07,394.462666 376.14,383.142666 380.53,369.392666 C405.97,373.452666 426.88,296.082666 395.87,301.762666 L392.68,280.712666 L392.13,277.062666 L391.9,275.522666 C384.43,276.682666 376.78,277.722666 368.99,278.632666 C389.88,349.262666 300.46,385.132666 267.04,306.612666 Z M284.280512,176.166601 L284.280512,67.1666006 C366.547618,67.1666006 361.40053,176.166601 284.280512,176.166601 Z M256.254843,67.1117579 L229.254843,87.6169826 C229.254843,124.271828 229.254843,160.370447 229.254843,204.775426 L256.254843,208.111758 C256.254843,143.245746 256.254843,107.726499 256.254843,67.1117579 Z M207.254843,67.1117579 L180.254843,87.6169826 C180.254843,124.271828 180.254843,160.370447 180.254843,204.775426 L207.254843,208.111758 C207.254843,143.245746 207.254843,107.726499 207.254843,67.1117579 Z"
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
          aria-expanded="false">
          <i class="bi bi-translate"></i>
        </button>
        <ul class="dropdown-menu">
          <li><a class="dropdown-item" href="?hl=zh"><i class="fi fi-cn"></i> 中文</a></li>
          <li><a class="dropdown-item" href="?hl=en"><i class="fi fi-us"></i> English</a></li>
          <li><a class="dropdown-item" href="?hl=fr"><i class="fi fi-fr"></i> Français</a></li>
        </ul>
      </div>

      <div>
        <input type="checkbox" class="jn-checkbox" id="toggleBtn" v-model="isDarkMode" @click="toggleDarkMode" />
        <label class="switch" for="toggleBtn">
          <i class="bi bi-moon-stars text-light"></i>
          <i class="bi bi-brightness-high text-warning "></i>
          <div class="ball"></div>
        </label>
      </div>

    </div>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNavAltMarkup"
      aria-controls="navbarNavAltMarkup" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon bg-transparent "></span>
    </button>
    <div class="collapse navbar-collapse justify-content-end" id="navbarNavAltMarkup">
      <div class="navbar-nav ">
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#IPInfo"> {{ $t('nav.IPinfo') }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#Connectivity"> {{
          $t('nav.Connectivity') }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#WebRTC"> {{ $t('nav.WebRTC') }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#DNSLeakTest"> {{
          $t('nav.DNSLeakTest') }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#SpeedTest"> {{ $t('nav.SpeedTest')
        }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#PingTest"> {{ $t('nav.PingTest')
        }}</a>
        <a class="nav-link" :class="{ 'text-white jn-deactive': isDarkMode }" href="#MTRTest"> {{ $t('nav.MTRTest') }}</a>
      </div>
    </div>
  </nav>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'NavBar',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);

    return {
      isDarkMode,
    };
  },

  data() {
    return {
      loaded: false,
    }
  },
  methods: {

    // 切换暗黑模式
    toggleDarkMode() {
      this.$store.commit('toggleDarkMode');
      this.updateBodyClass();
      this.PWAColor();
    },

    // 更新 body class
    updateBodyClass() {
      if (this.isDarkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    },

    // 更新 PWA 颜色
    PWAColor() {
      if (this.isDarkMode) {
        document
          .querySelector('meta[name="theme-color"]')
          .setAttribute("content", "#171a1d");
        document
          .querySelector('meta[name="background-color"]')
          .setAttribute("content", "#212529");
      } else {
        document
          .querySelector('meta[name="theme-color"]')
          .setAttribute("content", "#f8f9fa");
        document
          .querySelector('meta[name="background-color"]')
          .setAttribute("content", "#ffffff");
      }
    },

    // 点击 Logo 事件处理
    handleLogoClick() {
      if (window.scrollY === 0) {
        this.$store.commit('setRefreshEveryThing', true);
      }
    },
  },
  mounted() {
    this.$store.dispatch('checkDarkMode');
    this.updateBodyClass();
    this.PWAColor();
  },
}
</script>

<style scoped>
/*==================== Dark Light Button Implementation ====================*/
.jn-checkbox {
  display: none;
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
</style>
