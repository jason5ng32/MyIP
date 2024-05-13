<template>
  <footer>
    <div id="copyleft">
      <p class="text-center">{{ t('page.footerName') }} <a :href="t('page.footerLink')" class="link-dark"
          target="_blank" @click="trackEvent('Footer', 'FooterClick', 'Github');" aria-label="Github"><i
            class="bi bi-github" :class="{ 'dark-mode': isDarkMode }"
            v-tooltip="{ title: t('Tooltips.GithubLink'), placement: 'top' }"></i></a>
      </p>
    </div>

    <div id="about" class="text-center mb-2">
      <a class="link link-underline-offset link-underline-opacity-0" :class="[isDarkMode ? 'link-light' : 'link-dark']"
        role="button" aria-controls="About" @click.prevent="openAbout">
        {{ t('about.Title') }} <i class="bi bi-arrow-left-circle-fill"></i>
      </a>
    </div>


    <div class="offcanvas offcanvas-end mt-5 border-0 h-100" :class="[isMobile ? ' w-100' : '']" tabindex="-1"
      id="About" aria-labelledby="AboutLabel" :data-bs-theme="isDarkMode ? 'dark' : 'light'">
      <div class="offcanvas-header mt-3">
        <div class="btn-group" role="group">
          <template v-for="show in ['about', 'changelog']">
            <input v-model="content" type="radio" class="btn-check" :name="'About_' + show" :id="'About_' + show"
              autocomplete="off" :value=show @change="toggleContent(show)">
            <label class="btn jn-number" :class="{
              'btn-outline-dark': !isDarkMode,
              'btn-outline-light': isDarkMode,
              'active fw-bold': show === content
            }" :for="'About_' + show">
              {{ t(show + '.Title') }}
            </label>
          </template>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
      </div>
      <div class="offcanvas-body" ref="offcanvasBody">
        <div v-if="showAbout">
          <div class="mb-3">
            <p>
              {{ t('about.product1') }}
            </p>
            <p>
              {{ t('about.product2') }}
            </p>
            <p>
              {{ t('about.product3') }}
            </p>
          </div>
          <h5>{{ t('about.meTitle') }}</h5>
          <div class="mb-3">
            <p>
              {{ t('about.me1') }}
            </p>
            <p>
              {{ t('about.me2') }}
            </p>
            <p>
              {{ t('about.me3') }}
            </p>
          </div>
          <div class="mb-3 mx-2">
            <p>
              <a href="https://wujiaxian.com" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ t('about.personal') }}</a>
            </p>
            <p>
              <a href="https://kenengba.com" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ t('about.blog') }}</a>
            </p>
            <p>
              <a href="https://retire.money" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ t('about.retiremoney') }}</a>
            </p>
            <p>
              <a href="https://twitter.com/jason5ng32" class="link-success link-underline-opacity-0" target="_blank"><i
                  class="bi bi-browser-safari"></i> {{ t('about.twitter') }}</a>
            </p>
          </div>
          <h5>{{ t('about.contactTitle') }}</h5>
          <div v-html="t('about.contact')" class="mb-3">
          </div>
        </div>
        <div v-if="showChangelog">
          <div v-for="(version, index) in changelog.slice().reverse()" :key="index" class="mb-4">
            <div class="row align-items-center">
              <div class="col-6 fw-bold fs-5">{{ version.version }}</div>
              <div class="col-6 row flex-row-reverse text-secondary">{{ version.date }}</div>
            </div>
            <hr>

            <div v-for="(item, idx) in version.content" :key="idx" class="pb-1 ">
              <span v-if="item.type === 'add'" class="badge  rounded-pill bg-success fw-normal ">{{ t('changelog.add')
                }}</span>
              <span v-else-if="item.type === 'improve'" class="badge rounded-pill bg-info fw-normal">{{
                t('changelog.improve') }}</span>
              <span v-else-if="item.type === 'fix'" class="badge  rounded-pill bg-danger fw-normal">{{
                t('changelog.fix')
                }}</span>
              <span class="mx-2">{{ item.change }}</span>
            </div>
          </div>
        </div>

        <div id="offcanvasPlaceholder mb-5" class="jn-placeholder mb-5">
        </div>

      </div>
    </div>

    <div id="copyright" v-if="!configs.originalSite">
      <p class="text-center fs-6 fw-light" style="opacity: 0.5;">
        {{ t('page.copyRightName') }} <a :href="t('page.copyRightLink')" class="link-underline-light" target="_blank"
          :class="[isDarkMode ? 'link-light' : 'link-dark']">{{ t('page.copyRightLinkName') }}</a>
      </p>
    </div>
  </footer>
</template>

<script setup>
import { ref, computed, reactive } from 'vue';
import { useMainStore } from '@/store';
import { Offcanvas } from 'bootstrap';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';

const {t,tm} = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const content = ref('about');
const showAbout = ref(true);
const showChangelog = ref(false);
const changelog = reactive(tm('changelog.versions'));

const openAbout = () => {
  var offcanvasElement = document.getElementById('About');
  var offcanvas = Offcanvas.getInstance(offcanvasElement) || new Offcanvas(offcanvasElement);
  if (offcanvasElement.classList.contains('show')) {
    offcanvas.hide();
  } else {
    offcanvas.show();
  }

  trackEvent('Footer', 'FooterClick', 'About');

};

const offcanvasBody = ref(null);

const toggleContent = (contentType) => {
  showAbout.value = contentType === 'about';
  showChangelog.value = contentType === 'changelog';
  content.value = contentType;
  offcanvasBody.scrollTop = 0;
};

defineExpose({
  openAbout
});
</script>

<style scoped>
#About {
  z-index: 1051;
}

.jn-placeholder {
  height: 20pt;
}
</style>
