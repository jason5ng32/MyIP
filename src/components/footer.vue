<template>
  <footer>
    <div id="copyleft">
      <p class="text-center">{{ $t('page.footerName') }} <a :href="$t('page.footerLink')" class="link-dark"
          target="_blank" @click="$trackEvent('Footer', 'FooterClick', 'Github');" aria-label="Github"><i
            class="bi bi-github" :class="{ 'dark-mode': isDarkMode }"
            v-tooltip="{ title: $t('Tooltips.GithubLink'), placement: 'top' }"></i></a>
      </p>
    </div>

    <div id="about" class="text-center mb-2">
      <a class="link link-underline-offset link-underline-opacity-0" :class="[isDarkMode ? 'link-info' : 'link-dark']"
        data-bs-toggle="offcanvas" href="#About" role="button" aria-controls="About"
        @click="$trackEvent('Footer', 'FooterClick', 'About');">
        {{ $t('about.Title') }} <i class="bi bi-arrow-left-circle-fill"></i>
      </a>
    </div>


    <div class="offcanvas offcanvas-end mt-5" :class="[isMobile ? ' w-100' : '']" tabindex="-1" id="About"
      aria-labelledby="AboutLabel" :data-bs-theme="isDarkMode ? 'dark' : 'light'">
      <div class="offcanvas-header mt-3">
        <div class="btn-group" role="group">
          <button type="button" class="btn" @click="toggleContent('about')"
            :class="[showAbout ? 'btn-primary' : 'btn-outline-secondary']">{{ $t('about.Title') }}</button>
          <button type="button" class="btn" @click="toggleContent('changlog')"
            :class="[showChanglog ? 'btn-primary' : 'btn-outline-secondary']">
            {{ $t('changelog.Title') }}
          </button>

        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body" ref="offcanvasBody">
        <div v-if="showAbout">
          <div class="mb-3">
            <p>
              {{ $t('about.product1') }}
            </p>
            <p>
              {{ $t('about.product2') }}
            </p>
            <p>
              {{ $t('about.product3') }}
            </p>
          </div>
          <h5>{{ $t('about.meTitle') }}</h5>
          <div class="mb-3">
            <p>
              {{ $t('about.me1') }}
            </p>
            <p>
              {{ $t('about.me2') }}
            </p>
            <p>
              {{ $t('about.me3') }}
            </p>
          </div>
          <div class="mb-3 mx-2">
            <p>
              <a href="https://wujiaxian.com" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ $t('about.personal') }}</a>
            </p>
            <p>
              <a href="https://kenengba.com" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ $t('about.blog') }}</a>
            </p>
            <p>
              <a href="https://retire.money" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ $t('about.retiremoney') }}</a>
            </p>
            <p>
              <a href="https://twitter.com/jason5ng32" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ $t('about.twitter') }}</a>
            </p>
          </div>
          <h5>{{ $t('about.contactTitle') }}</h5>
          <div v-html="$t('about.contact')" class="mb-3">
          </div>
        </div>
        <div v-if="showChanglog">
          <div v-for="(version, index) in changelog.slice().reverse()" :key="index" class="mb-4">
            <div class="row align-items-center">
              <div class="col-6 fw-bold fs-5">{{ version.version }}</div>
              <div class="col-6 row flex-row-reverse text-secondary">{{ version.date }}</div>
            </div>
            <hr>

            <div v-for="(item, idx) in version.content" :key="idx" class="pb-1 ">
              <span v-if="item.type === 'add'" class="badge  rounded-pill bg-success fw-normal ">{{ $t('changelog.add')
                }}</span>
              <span v-else-if="item.type === 'improve'" class="badge rounded-pill bg-info fw-normal">{{
                $t('changelog.improve') }}</span>
              <span v-else-if="item.type === 'fix'" class="badge  rounded-pill bg-danger fw-normal">{{
                $t('changelog.fix')
                }}</span>
              <span class="mx-2">{{ item.change }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="copyright" v-if="!configs.originalSite">
      <p class="text-center fs-6 fw-light" style="opacity: 0.5;">
        {{ $t('page.copyRightName') }} <a :href="$t('page.copyRightLink')" class="link-underline-light" target="_blank"
          :class="[isDarkMode ? 'dark-mode link-light' : 'link-dark']">{{ $t('page.copyRightLinkName') }}</a>
      </p>
    </div>
  </footer>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import '@khmyznikov/pwa-install';

export default {
  name: 'Footer',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);
    const configs = computed(() => store.state.configs);

    return {
      isDarkMode,
      isMobile,
      configs,
    };
  },

  data() {
    return {
      showAbout: true,
      showChanglog: false,
      changelog: this.$tm('changelog.versions'),
    }
  },
  methods: {
    toggleContent(contentType) {
      this.showAbout = contentType === 'about';
      this.showChanglog = contentType === 'changlog';
      this.$refs.offcanvasBody.scrollTop = 0;
    },
  },
}
</script>

<style scoped>
#About {
  z-index: 1051;
}
</style>
