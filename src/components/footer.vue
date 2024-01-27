<template>
  <footer>
    <p class="text-center">{{ $t('page.footerName') }} <a :href="$t('page.footerLink')" class="link-dark"
        target="_blank"><i class="bi bi-github" :class="{ 'dark-mode': isDarkMode }"></i></a>
    </p>
    <p v-if="!siteValidate" class="text-center fs-6 fw-light" style="opacity: 0.5;">
      {{ $t('page.copyRightName') }} <a :href="$t('page.copyRightLink')" class="link-underline-light" target="_blank"
        :class="[isDarkMode ? 'dark-mode link-light' : 'link-dark']">{{ $t('page.copyRightLinkName') }}</a>
    </p>
  </footer>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'Footer',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);
    const siteVal = computed(() => store.state.siteValidate);
    const siteValidate = ref(true);

    // 监控 siteVal 的变化
    watch(siteVal, (newVal) => {
      siteValidate.value = newVal;
      console.log('siteValidate: ', siteValidate.value);
    });


    return {
      isDarkMode,
      isMobile,
      siteValidate,
    };
  },

  data() {
    return {

    }
  },
}
</script>

<style scoped></style>
