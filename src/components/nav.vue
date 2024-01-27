<template>
    <!-- Nav -->
    <nav id="navbar-top" class="navbar navbar-expand-lg bg-body-tertiary px-3 mb-3 jn-navbar-top"
      :class="{ 'dark-mode-nav navbar-dark bg-dark': isDarkMode }">
      <div class="jn-logo">
        <a class="navbar-brand" :class="{ 'text-white': isDarkMode }" href="#" @click="handleLogoClick"><i
            class="bi bi-box-seam-fill"></i>
          {{ $t('nav.Title') }} </a>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="darkModeSwitch" @change="toggleDarkMode"
            :checked="isDarkMode">
          <label class="form-check-label" for="darkModeSwitch">
            <i v-if="isDarkMode" class="bi bi-moon-stars"></i>
            <i v-else class="bi bi-brightness-high"></i>
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

<style scoped></style>
