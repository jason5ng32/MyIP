<template>
  <div id="sponsor-thor-data" class="mb-4 mt-2 jn-thor-data card jn-card"
    :class="{ 'dark-mode dark-mode-border': isDarkMode}" @click="openThorData">
    <img :src="selectSponsorPicture" alt="ThorData" class="img-fluid">
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

const basePath = 'res/thordata/';
const supportedLangs = ['zh', 'en', 'fr', 'tr'];

const selectSponsorPicture = computed(() => {

  let device;
  let picLang;
  if (supportedLangs.includes(lang.value)) {
    picLang = lang.value;
  } else {
    picLang = 'en';
  }

  if (isMobile.value) {
    device = 'mobile';
  } else {
    device = 'desktop';
  }

  return `${basePath}${picLang}_${device}.png`;

});

const openThorData = () => {
  window.open('https://dashboard.thordata.com/register?invitation_code=XS193IM5', '_blank');
  trackEvent('Sponsor', 'BannerClick', 'ThorData');
};
</script>

<style scoped>
.jn-thor-data {
  margin-top: -16pt;
  cursor: pointer;
}

.jn-thor-data img {
  width: 100%;
  height: auto;
  border-radius: 4pt;
  overflow: hidden;
}
</style>
