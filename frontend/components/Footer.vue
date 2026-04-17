<template>
  <footer class="mt-10 pb-6 text-sm text-muted-foreground">
    <!-- 第一行：作者 + Github —————————————————— -->
    <div class="flex items-center justify-center gap-1.5 mb-3">
      <span>Created by Jason Ng with love</span>
      <JnTooltip :text="t('Tooltips.GithubLink')" side="top">
        <Button variant="ghost" size="icon" as-child class="size-6 text-foreground/70 hover:text-foreground">
          <a :href="t('page.footerLink')" target="_blank" rel="noopener" aria-label="Github"
            @click="trackEvent('Footer', 'FooterClick', 'Github')">
            <Github />
          </a>
        </Button>
      </JnTooltip>
    </div>

    <!-- 第二行：Sponsor / About 入口 —————————————— -->
    <div class="flex items-center justify-center gap-2 mb-3">
      <!-- Sponsor 用 arbitrary value 直接表达粉色：Button ghost 的 hover:text-accent-foreground
           会覆盖普通 class，必须用 hover:text-[#d63384] 强表达，配合 cn/tw-merge 才会生效 -->
      <Button variant="link" size="sm" as-child
        class="text-[#d63384] hover:text-[#d63384]">
        <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener">
          {{ t('about.Sponsor') }} 💖
        </a>
      </Button>
      <Button variant="ghost" size="sm" @click="openAbout" class="cursor-pointer">
        {{ t('about.Title') }}
        <ArrowLeftCircle class="size-3.5" />
      </Button>
    </div>

    <!-- 第三行：版权（可选） —————————————————— -->
    <p v-if="!configs.originalSite" class="text-center text-xs opacity-70">
      {{ t('page.copyRightName') }}
      <a :href="t('page.copyRightLink')" target="_blank" rel="noopener"
        class="text-foreground/80 hover:text-foreground hover:underline">
        {{ t('page.copyRightLinkName') }}
      </a>
    </p>

    <!-- About Sheet（右侧滑入：阅读型侧栏更适合长文本浏览） -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
      <SheetContent side="right" :title="t('about.Title')"
        :class="cn('flex flex-col p-0 gap-0', isMobile ? 'w-full max-w-full' : 'w-[500px] max-w-[500px]')">
        <!-- Tabs 包住整个 Sheet 内容：TabsList 留在 header，TabsContent 进 body 滚动区 -->
        <Tabs v-model="content" class="flex flex-col h-full">
          <!-- 顶部：tabs + 关闭 -->
          <div class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
            <TabsList>
              <TabsTrigger v-for="tab in tabs" :key="tab" :value="tab">
                {{ t(tab + '.Title') }}
              </TabsTrigger>
            </TabsList>
            <SheetClose
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
          </div>

          <!-- 内容区（独立滚动） -->
          <div class="flex-1 overflow-y-auto px-5 py-5" ref="sheetBody">
            <!-- About ———————————————————————————— -->
            <TabsContent value="about" class="space-y-6 mt-0">
              <section class="space-y-2">
                <p v-for="i in 3" :key="i" class="text-sm leading-relaxed text-foreground/85">
                  {{ t(`about.product${i}`) }}
                </p>
              </section>

              <section>
                <h3 class="text-base font-semibold mb-2">{{ t('about.meTitle') }}</h3>
                <div class="space-y-2 mb-3">
                  <p v-for="i in 3" :key="i" class="text-sm leading-relaxed text-foreground/85">
                    {{ t(`about.me${i}`) }}
                  </p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button v-for="link in personalLinks" :key="link.href"
                    variant="outline" size="sm" as-child class="justify-start">
                    <a :href="link.href" target="_blank" rel="noopener">
                      <Compass />
                      <span class="flex-1 text-left">{{ t(link.labelKey) }}</span>
                      <ExternalLink class="opacity-50" />
                    </a>
                  </Button>
                </div>
              </section>

              <section>
                <h3 class="text-base font-semibold mb-2">{{ t('about.contactTitle') }}</h3>
                <div class="text-sm leading-relaxed text-foreground/85" v-html="t('about.contact')"></div>
              </section>
            </TabsContent>

            <!-- Changelog ———————————————————————— -->
            <TabsContent value="changelog" class="space-y-6 mt-0">
              <section v-for="(version, vi) in changelog.slice().reverse()" :key="vi">
                <header class="flex items-baseline justify-between mb-2">
                  <h3 class="text-lg font-semibold tracking-tight">{{ version.version }}</h3>
                  <span class="text-xs text-muted-foreground tabular-nums">{{ version.date }}</span>
                </header>
                <Separator class="mb-3" />
                <ul class="space-y-2">
                  <li v-for="(item, idx) in version.content" :key="idx" class="flex items-start gap-2 text-sm">
                    <!-- Badge 去 shadow：changelog 的条目 Badge 是标签色块，不需要阴影抢戏 -->
                    <Badge :class="changelogBadgeClass(item.type)"
                      class="shrink-0 !shadow-none rounded-full font-normal mt-0.5 min-w-16 justify-center">
                      {{ t('changelog.' + item.type) }}
                    </Badge>
                    <span class="leading-relaxed">{{ item.change }}</span>
                  </li>
                </ul>
              </section>
            </TabsContent>

            <!-- Special Thanks ———————————————————— -->
            <TabsContent value="specialthanks" class="space-y-4 mt-0">
              <p class="text-sm text-muted-foreground leading-relaxed">{{ t('specialthanks.Note1') }}</p>
              <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2 list-none p-0">
                <li v-for="(item, idx) in thanksList" :key="idx">
                  <Button v-if="item.link" variant="outline" size="sm" as-child class="w-full justify-start">
                    <a :href="item.link" target="_blank" rel="noopener">
                      <Smile />
                      <span class="flex-1 text-left truncate">{{ item.name }}</span>
                      <SquareArrowOutUpRight class="opacity-50" />
                    </a>
                  </Button>
                  <div v-else
                    class="flex items-center gap-2 h-8 px-3 text-sm rounded-md border bg-card text-foreground/80">
                    <Smile class="size-4 text-muted-foreground shrink-0" />
                    <span class="truncate">{{ item.name }}</span>
                  </div>
                </li>
              </ul>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  </footer>
</template>

<script setup>
// refactor/02：Footer 全部走 shadcn primitive
// - 链接/按钮一律 <Button>（ghost / outline / link 变体）
// - About 弹窗用 Sheet（右侧滑入），内部 tab 用 Tabs / TabsList / TabsTrigger / TabsContent
// - Changelog Badge 取消阴影
import { ref, computed, reactive, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ArrowLeftCircle, Compass, ExternalLink, Github, Smile, SquareArrowOutUpRight } from 'lucide-vue-next';

const { t, tm } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const tabs = ['about', 'changelog', 'specialthanks'];
const content = ref('about');
const changelog = reactive(tm('changelog.versions'));
const sheetBody = ref(null);

const personalLinks = [
  { href: 'https://wujiaxian.com', labelKey: 'about.personal' },
  { href: 'https://kenengba.com', labelKey: 'about.blog' },
  { href: 'https://retire.money', labelKey: 'about.retiremoney' },
  { href: 'https://twitter.com/jason5ng32', labelKey: 'about.twitter' },
];

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

// changelog 类型 → 语义色 token：add → success；improve → info；fix → destructive
const changelogBadgeClass = (type) => {
  if (type === 'add') return 'bg-success text-success-foreground border-transparent';
  if (type === 'improve') return 'bg-info text-info-foreground border-transparent';
  if (type === 'fix') return 'bg-destructive text-destructive-foreground border-transparent';
  return '';
};

// Sheet 开关与 store.openSheet 双向绑定（refactor/01）
const isOpen = computed(() => store.openSheet === 'about');
const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'about' : null);
};

const openAbout = () => {
  store.toggleSheet('about');
  trackEvent('Footer', 'FooterClick', 'About');
};

watch(content, () => {
  nextTick(() => {
    if (sheetBody.value) sheetBody.value.scrollTop = 0;
  });
});

defineExpose({
  openAbout,
});
</script>
