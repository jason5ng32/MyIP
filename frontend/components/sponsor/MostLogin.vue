<template>
  <div id="sponsor-most-login" class="mb-4 jn-most-login card jn-card"
    :class="{ 'dark-mode dark-mode-border': isDarkMode}" @click="openMostLogin">
    <img :src="selectSponsorPicture" alt="Most Login" class="img-fluid">
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/use-analytics';

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const isDarkMode = computed(() => store.isDarkMode);
const lang = computed(() => store.lang);

const basePath = 'res/mostlogin/';
const supportedLangs = ['en', 'fr', 'tr'];

const selectSponsorPicture = computed(() => {

  let device;
  let picLang;
  if (supportedLangs.includes(lang.value)) {
    picLang = lang.value;
  } else {
    picLang = 'en';
  }

  if (isMobile.value) {
    device = 'mo';
  } else {
    device = 'pc';
  }

  return `${basePath}${picLang}_${device}.png`;

});

const openMostLogin = () => {
  window.open('https://www.mostlogin.com/?invite-code=ipcheak1', '_blank');
  trackEvent('Sponsor', 'BannerClick', 'MostLogin');
};
</script>

<style scoped>
.jn-most-login {
  margin-top: -16pt;
  cursor: pointer;
}

.jn-most-login img {
  width: 100%;
  height: auto;
  border-radius: 4pt;
  overflow: hidden;
}
</style>
