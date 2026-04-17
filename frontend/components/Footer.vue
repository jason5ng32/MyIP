<template>
  <footer>
    <div id="copyleft">
      <p class="text-center">
        <span>Created by Jason Ng with love</span>
        <JnTooltip :text="t('Tooltips.GithubLink')" side="top">
          <a :href="t('page.footerLink')" target="_blank"
            class="ml-1 inline-flex items-center no-underline text-neutral-900 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
            @click="trackEvent('Footer', 'FooterClick', 'Github');" aria-label="Github">
            <i class="bi bi-github"></i>
          </a>
        </JnTooltip>
      </p>
    </div>

    <div id="about" class="text-center mb-2">
      <a class="jn-heart-color no-underline" aria-controls="Sponsor"
        href="https://github.com/sponsors/jason5ng32" target="_blank">
        {{ t('about.Sponsor') }} 💖
      </a>
      <span class="mx-1"></span>
      <a role="button" aria-controls="About" @click.prevent="openAbout"
        class="cursor-pointer no-underline hover:underline text-neutral-900 dark:text-neutral-100">
        {{ t('about.Title') }} <i class="bi bi-arrow-left-circle-fill"></i>
      </a>
    </div>

    <Sheet :open="isOpen" @update:open="onOpenChange">
      <SheetContent
        side="right"
        :title="t('about.Title')"
        :class="cn('overflow-y-auto pt-3', isMobile ? 'w-full max-w-full' : 'w-[500px] max-w-[500px]')"
      >
        <div class="mt-3 flex items-center justify-between px-3">
          <ToggleGroup v-model="content" type="single">
            <ToggleGroupItem v-for="show in ['about', 'changelog', 'specialthanks']" :key="show" :value="show">
              {{ t(show + '.Title') }}
            </ToggleGroupItem>
          </ToggleGroup>
          <SheetClose />
        </div>
        <div class="p-4" ref="sheetBody">
          <div v-if="content === 'about'">
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
                <a href="https://wujiaxian.com"
                  class="text-green-600 hover:text-green-700 no-underline" target="_blank">
                  <i class="bi bi-browser-safari"></i> {{ t('about.personal') }}
                </a>
              </p>
              <p>
                <a href="https://kenengba.com"
                  class="text-green-600 hover:text-green-700 no-underline" target="_blank">
                  <i class="bi bi-browser-safari"></i> {{ t('about.blog') }}
                </a>
              </p>
              <p>
                <a href="https://retire.money"
                  class="text-green-600 hover:text-green-700 no-underline" target="_blank">
                  <i class="bi bi-browser-safari"></i> {{ t('about.retiremoney') }}
                </a>
              </p>
              <p>
                <a href="https://twitter.com/jason5ng32"
                  class="text-green-600 hover:text-green-700 no-underline" target="_blank">
                  <i class="bi bi-browser-safari"></i> {{ t('about.twitter') }}
                </a>
              </p>
            </div>
            <h5>{{ t('about.contactTitle') }}</h5>
            <div v-html="t('about.contact')" class="mb-3"></div>
          </div>

          <div v-if="content === 'changelog'">
            <div v-for="(version, index) in changelog.slice().reverse()" :key="index" class="mb-4">
              <div class="flex items-center">
                <div class="w-1/2 font-bold text-lg">{{ version.version }}</div>
                <div class="w-1/2 flex flex-row-reverse text-neutral-500">{{ version.date }}</div>
              </div>
              <Separator class="my-2" />

              <div v-for="(item, idx) in version.content" :key="idx" class="pb-1 flex items-center gap-2">
                <Badge v-if="item.type === 'add'"
                  class="rounded-full bg-green-600 text-white font-normal border-transparent">
                  {{ t('changelog.add') }}
                </Badge>
                <Badge v-else-if="item.type === 'improve'"
                  class="rounded-full bg-sky-500 text-white font-normal border-transparent">
                  {{ t('changelog.improve') }}
                </Badge>
                <Badge v-else-if="item.type === 'fix'"
                  class="rounded-full bg-red-600 text-white font-normal border-transparent">
                  {{ t('changelog.fix') }}
                </Badge>
                <span>{{ item.change }}</span>
              </div>
            </div>
          </div>

          <div v-if="content === 'specialthanks'">
            <div class="mb-3">
              <p>{{ t('specialthanks.Note1') }}</p>
            </div>

            <div v-for="(item, index) in thanksList" :key="index" class="mb-3 italic">
              <i class="bi bi-emoji-smile-fill "></i> {{ item.name }}
              <a v-if="item.link" :href="item.link" target="_blank"
                class="ml-1 no-underline text-neutral-900 hover:underline dark:text-neutral-100">
                <i class="bi bi-arrow-up-right-square"></i>
              </a>
            </div>
          </div>

          <div class="h-6"></div>
        </div>
      </SheetContent>
    </Sheet>

    <div id="copyright" v-if="!configs.originalSite">
      <p class="text-center text-base font-light opacity-50">
        {{ t('page.copyRightName') }}
        <a :href="t('page.copyRightLink')" target="_blank"
          class="no-underline hover:underline text-neutral-900 dark:text-neutral-100">
          {{ t('page.copyRightLinkName') }}
        </a>
      </p>
    </div>
  </footer>
</template>

<script setup>
// refactor/01 阶段 C.2：Footer 模板从 Bootstrap class 改为 Tailwind + shadcn-vue
// - nav-tabs 风格的 about/changelog/thanks 三选一 → ToggleGroup
// - 版本列表的 <hr> → Separator
// - changelog 类型 badge → shadcn Badge + 颜色覆盖
// - 原 toggleContent + 三个布尔值改为单 content ref + v-if，简化
import { ref, computed, reactive, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { JnTooltip } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const { t, tm } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const content = ref('about');
const changelog = reactive(tm('changelog.versions'));
const sheetBody = ref(null);

const thanksList = [
  { name: 'Setilis Hu', link: '' },
  { name: 'Seven Yu', link: 'https://github.com/dofy' },
  { name: 'Nikolai Tschacher', link: 'https://incolumitas.com/pages/about/' },
  { name: 'Project Alexandria (Cloudflare)', link: 'https://www.cloudflare.com/lp/project-alexandria/' },
  { name: 'Cloudflare Speedtest', link: 'https://github.com/cloudflare/speedtest' },
  { name: 'Globalping by jsDelivr', link: 'https://globalping.io/' },
  { name: 'ProxyCheck.io', link: 'https://proxycheck.io/' },
  { name: 'Digital Defense', link: 'https://digital-defense.io/' },
  { name: 'ChatGPT', link: 'https://chatgpt.com/' },
];

// Sheet 开关与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'about');
const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'about' : null);
};

const openAbout = () => {
  store.toggleSheet('about');
  trackEvent('Footer', 'FooterClick', 'About');
};

// 切换内容时重置滚动位置到顶部（修了原代码 offcanvasBody.scrollTop 直接操作 ref 对象的 bug）
watch(content, () => {
  nextTick(() => {
    if (sheetBody.value) sheetBody.value.scrollTop = 0;
  });
});

defineExpose({
  openAbout,
});
</script>

<style scoped>
.jn-heart-color {
  color: #d63384;
}
</style>
