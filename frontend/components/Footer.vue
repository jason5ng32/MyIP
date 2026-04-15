<template>
  <footer>
    <div id="copyleft">
      <p class="text-center"><span>Created by Jason Ng with love</span>
        <JnTooltip :text="t('Tooltips.GithubLink')" side="top">
          <a :href="t('page.footerLink')" class="link-dark" target="_blank"
            @click="trackEvent('Footer', 'FooterClick', 'Github');" aria-label="Github"><i
              class="bi bi-github" :class="{ 'dark-mode': isDarkMode }"></i></a>
        </JnTooltip>
      </p>
    </div>

    <div id="about" class="text-center mb-2">
      <a class="link link-underline-offset link-underline-opacity-0 jn-heart-color" role="button"
        aria-controls="Sponsor" href="https://github.com/sponsors/jason5ng32" target="_blank">
        {{ t('about.Sponsor') }} 💖
      </a>&nbsp;&nbsp;
      <a class="link link-underline-offset link-underline-opacity-0" :class="[isDarkMode ? 'link-light' : 'link-dark']"
        role="button" aria-controls="About" @click.prevent="openAbout">
        {{ t('about.Title') }} <i class="bi bi-arrow-left-circle-fill"></i>
      </a>
    </div>

    <Sheet :open="isOpen" @update:open="onOpenChange">
      <SheetContent
        side="right"
        :title="t('about.Title')"
        :class="cn('overflow-y-auto pt-3', isMobile ? 'w-full max-w-full' : 'w-[500px] max-w-[500px]')"
        :data-bs-theme="isDarkMode ? 'dark' : 'light'"
      >
      <div class="offcanvas-header mt-3 d-flex align-items-center justify-content-between px-3">
        <div class="btn-group" role="group">
          <template v-for="show in ['about', 'changelog', 'specialthanks']">
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
        <SheetClose class="btn-close" />
      </div>
      <div class="offcanvas-body" ref="offcanvasBody">
        <div v-if="showAbout">
          <div class="mb-3">
            <p v-for="i in 3" :key="i">
              {{ t(`about.product${i}`) }}
            </p>
          </div>
          <h5>{{ t('about.meTitle') }}</h5>
          <div class="mb-3">
            <p v-for="i in 3" :key="i">
              {{ t(`about.me${i}`) }}
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
        <div v-if="showSpecialThanks">
          <div class="mb-3">
            <p>
              {{ t('specialthanks.Note1') }}
            </p>
          </div>

          <div v-for="(item, index) in thanksList" :key="index" class="mb-3 fst-italic">
            <i class="bi bi-emoji-smile-fill "></i> {{ item.name }}
            <a v-if="item.link" :class="[isDarkMode ? 'link-light' : 'link-dark']" :href="item.link" target="_blank">
              <i class="bi bi-arrow-up-right-square"></i>
            </a>
          </div>

        </div>

        <div id="offcanvasPlaceholder mb-5" class="jn-placeholder mb-5">
        </div>

      </div>
      </SheetContent>
    </Sheet>

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
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { JnTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const { t, tm } = useI18n();

const store = useMainStore();
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const content = ref('about');
const showAbout = ref(true);
const showChangelog = ref(false);
const showSpecialThanks = ref(false);
const changelog = reactive(tm('changelog.versions'));

const thanksList = [
  {
    name: 'Setilis Hu',
    link: ''
  },
  {
    name: 'Seven Yu',
    link: 'https://github.com/dofy'
  },
  {
    name: 'Nikolai Tschacher',
    link: 'https://incolumitas.com/pages/about/'
  },
  {
    name: 'Project Alexandria (Cloudflare)',
    link: 'https://www.cloudflare.com/lp/project-alexandria/'
  },
  {
    name: 'Cloudflare Speedtest',
    link: 'https://github.com/cloudflare/speedtest'
  },
  {
    name: 'Globalping by jsDelivr',
    link: 'https://globalping.io/'
  },
  {
    name: 'ProxyCheck.io',
    link: 'https://proxycheck.io/'
  },
  {
    name: 'Digital Defense',
    link: 'https://digital-defense.io/'
  },
  {
    name: 'ChatGPT',
    link: 'https://chatgpt.com/'
  }
]

// Sheet 开关与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'about');
const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'about' : null);
};

const openAbout = () => {
  store.toggleSheet('about');
  trackEvent('Footer', 'FooterClick', 'About');
};

const offcanvasBody = ref(null);

const toggleContent = (contentType) => {
  showAbout.value = contentType === 'about';
  showChangelog.value = contentType === 'changelog';
  showSpecialThanks.value = contentType === 'specialthanks';
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

.jn-heart-color {
  color: #d63384;
  text-decoration: none;
}
</style>
