<template>
  <div id="sponsor-most-login" class="mb-4 jn-most-login card jn-card"
    :class="{ 'dark-mode dark-mode-border': isDarkMode}"
    @click="openMostLogin"
    >
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

const sponsorPicBasePath = 'res/mostlogin';

const selectSponsorPicture = computed(() => {

  let path;
  let picName = 'en';
  if (isMobile.value) {
    path = `${sponsorPicBasePath}/mobile/`;
  } else {
    path = `${sponsorPicBasePath}/desktop/`;
  }

  if (lang.value === 'fr') {
    picName = 'fr';
  } else if (lang.value === 'tr') {
    picName = 'tr';
  } else {
    picName = 'en';
  }

  return `${path}${picName}.png`;

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
