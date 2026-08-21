<template>
  <footer class="pb-6 text-sm text-muted-foreground">
    <!-- Primary footer links: Sponsor / Privacy / About / Changelog / Special
         Thanks. The last three open the same About sheet on their own tab.
         Text-only (no per-button icons) to keep the row calm. -->
    <div class="flex flex-wrap items-center justify-center gap-x-3 mb-2 mx-auto">
      <Button variant="link" size="default" as-child class="text-[#d63384] hover:text-[#d63384]">
        <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener">
          {{ t('about.Sponsor') }}
        </a>
      </Button>
      <Button variant="link" size="default" as-child class="cursor-pointer">
        <RouterLink to="/privacy" @click="trackEvent('Footer', 'FooterClick', 'Privacy')">
          {{ t('about.Privacy') }}
        </RouterLink>
      </Button>
      <Button variant="link" size="default" as-child class="cursor-pointer">
        <a :href="'https://docs.ipcheck.ing/knowledge-base/'+(locale === 'en' ? '' : locale)" target="_blank"
          rel="noopener" @click="trackEvent('Footer', 'FooterClick', 'HelpCenter')">
          {{ t('about.HelpCenter') }}
        </a>
      </Button>
      <Button variant="link" size="default" as-child class="cursor-pointer">
        <a :href="'https://docs.ipcheck.ing/developer/'+(locale === 'en' ? '' : locale)" target="_blank" rel="noopener"
          @click="trackEvent('Footer', 'FooterClick', 'Contribute')">
          {{ t('about.Contribute') }}
        </a>
      </Button>
      <Button variant="link" size="default" @click="openAboutTab('changelog', 'Changelog')" class="cursor-pointer">
        {{ t('changelog.Title') }}
      </Button>
      <Button variant="link" size="default" @click="openAboutTab('acknowledgement', 'Acknowledgement')"
        class="cursor-pointer">
        {{ t('acknowledgement.Title') }}
      </Button>
      <Button variant="link" size="default" @click="openAbout" class="cursor-pointer">
        {{ t('about.Title') }}
      </Button>
    </div>

    <!-- Author + GitHub on one line, copyright dimmed beneath — low-emphasis signature block -->
    <div class="flex flex-col items-center justify-center gap-y-1.5 text-xs opacity-70">
      <div class="flex items-center justify-center gap-x-2">
        <span>Created by Jason Ng with love</span>
        <JnTooltip :text="t('Tooltips.GithubLink')" side="top">
          <Button variant="ghost" size="icon" as-child class="size-5 text-foreground/70 hover:text-foreground">
            <a :href="t('page.footerLink')" target="_blank" rel="noopener" aria-label="Github"
              @click="trackEvent('Footer', 'FooterClick', 'Github')">
              <Icon icon="ri:github-line" />
            </a>
          </Button>
        </JnTooltip>
      </div>
      <template v-if="!configs.originalSite">
        <span>
          {{ t('page.copyRightName') }}
          <a :href="t('page.copyRightLink')" target="_blank" rel="noopener"
            class="text-foreground/80 hover:text-foreground hover:underline">
            {{ t('page.copyRightLinkName') }}
          </a>
        </span>
      </template>
    </div>

    <!-- About Sheet -->
    <Sheet :open="isOpen" @update:open="onOpenChange">
      <SheetContent side="right" :title="t('about.Title')"
        :class="['flex flex-col p-0 gap-0 w-full max-w-full md:w-125 md:max-w-125']">
        <Tabs v-model="content" class="flex flex-col h-full">
          <!-- Top: tabs + close -->
          <div class="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0">
            <TabsList>
              <TabsTrigger v-for="tab in tabs" :key="tab" :value="tab">
                {{ t(tab + '.Title') }}
              </TabsTrigger>
            </TabsList>
            <SheetClose
              class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
          </div>

          <!-- Content area (independent scrolling) -->
          <div class="flex-1 overflow-y-auto px-5 py-5" ref="sheetBody">
            <!-- About: sections come from aboutSections, each one's paragraphs an array
                 in the locale file — adding or reordering copy is a locale-only edit. -->
            <TabsContent value="about" class="space-y-6 mt-0">
              <section v-for="section in aboutSections" :key="section.key">
                <h3 v-if="section.titleKey" class="text-base font-semibold mb-2">{{ t(section.titleKey) }}</h3>
                <div class="space-y-2" :class="section.links && 'mb-3'">
                  <p v-for="(paragraph, idx) in tm(`about.${section.key}`)" :key="idx"
                    class="text-sm leading-relaxed text-foreground/85">
                    {{ rt(paragraph) }}
                  </p>
                </div>
                <div v-if="section.links" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button v-for="link in section.links" :key="link.href" variant="outline" size="sm" as-child
                    class="justify-start">
                    <a :href="link.href" target="_blank" rel="noopener">
                      <Compass />
                      <span class="flex-1 text-left">{{ t(link.labelKey) }}</span>
                      <ExternalLink class="opacity-50" />
                    </a>
                  </Button>
                </div>
              </section>
            </TabsContent>

            <!-- Changelog -->
            <!-- Data lives in frontend/data/changelog.json (shared version, ISO date, per-lang change
                text). Dates localize at render via formatIsoDate; badge labels and the section title
                stay in locale files as UI chrome. -->
            <TabsContent value="changelog" class="space-y-6 mt-0">
              <section v-for="(version, vi) in changelogReversed" :key="vi">
                <header class="flex items-baseline justify-between mb-2">
                  <h3 class="text-lg font-semibold tracking-tight">{{ version.version }}</h3>
                  <span class="text-xs text-muted-foreground tabular-nums">{{ formatIsoDate(version.date, locale)
                    }}</span>
                </header>
                <Separator class="mb-3" />
                <ul class="space-y-2">
                  <li v-for="(item, idx) in version.content" :key="idx" class="flex items-start gap-2 text-sm">
                    <Badge :class="changelogBadgeClass(item.type)"
                      class="shrink-0 shadow-none! rounded-full justify-center text-secondary p-1"
                      :title="t('changelog.' + item.type)">
                      <CircleFadingArrowUp v-if="item.type === 'improve'" class="size-3.5" />
                      <CirclePlus v-if="item.type === 'add'" class="size-3.5" />
                      <BugOff v-if="item.type === 'fix'" class="size-3.5" />
                    </Badge>
                    <span class="leading-relaxed">{{ item.change[locale] || item.change.en }}</span>
                  </li>
                </ul>
              </section>
            </TabsContent>

            <!-- Acknowledgement -->
            <TabsContent value="acknowledgement" class="space-y-4 mt-0">
              <p class="text-sm text-muted-foreground leading-relaxed">{{ t('acknowledgement.Note1') }}</p>
              <ul class="grid grid-cols-1 gap-2 list-none p-0">
                <li v-for="(item, idx) in acknowledgementsList" :key="idx">
                  <Button v-if="item.link" variant="outline" size="sm" as-child class="w-full justify-start">
                    <a :href="item.link" target="_blank" rel="noopener">
                      <Smile />
                      <span class="flex-1 text-left truncate text-xs">{{ item.name }}</span>
                      <ExternalLink class="opacity-50" />
                    </a>
                  </Button>
                  <div v-else
                    class="flex items-center gap-2 h-8 px-3 text-sm rounded-md border bg-card text-foreground/80">
                    <Smile class="size-4 text-muted-foreground shrink-0" />
                    <span class="truncate text-xs">{{ item.name }}</span>
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
import { ref, computed, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import changelogData from '@/data/changelog.json';
import { trackEvent } from '@/utils/analytics';
import { formatIsoDate } from '@/utils/time-utils';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Compass, ExternalLink, CircleFadingArrowUp, CirclePlus, BugOff, Smile } from '@lucide/vue';
import { Icon } from '@iconify/vue';

const { t, tm, rt, locale } = useI18n();

const store = useMainStore();
const isMobile = computed(() => store.isMobile);
const configs = computed(() => store.configs);

const tabs = ['about', 'changelog', 'acknowledgement'];
const content = ref('about');
// Static data from JSON — reverse once via computed so the template stays tidy.
const changelogReversed = computed(() => changelogData.slice().reverse());
const sheetBody = ref(null);

const personalLinks = [
  { href: 'https://wujiaxian.com', labelKey: 'about.personal' },
  { href: 'https://kenengba.com', labelKey: 'about.blog' },
  { href: 'https://www.linkedin.com/in/jason5ng32/', labelKey: 'about.linkedIn' },
  { href: 'https://twitter.com/jason5ng32', labelKey: 'about.twitter' },
];

// About tab layout: one entry per section, rendered in order. `key` names the
// paragraph array under `about.` in the locale files; `titleKey` is omitted for
// the lead-in section, and `links` appends a link grid under the paragraphs.
const aboutSections = [
  { key: 'project' },
  { key: 'founder', titleKey: 'about.founderTitle', links: personalLinks },
  { key: 'contact', titleKey: 'about.contactTitle' },
];

const acknowledgementsList = [
  { name: 'Setilis Hu', link: '' },
  { name: 'Seven Yu', link: 'https://github.com/dofy' },
  { name: 'Nikolai Tschacher', link: 'https://incolumitas.com/pages/about/' },
  { name: 'Project Alexandria (Cloudflare)', link: 'https://www.cloudflare.com/lp/project-alexandria/' },
  { name: 'Cloudflare Speedtest', link: 'https://github.com/cloudflare/speedtest' },
  { name: 'DigitalOcean', link: 'https://www.digitalocean.com/?refcode=fd2634a3981b&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge' },
  { name: 'V.PS', link: 'https://v.ps/?utm_source=ipcheck.ing&utm_medium=acknowledgement&utm_campaign=footer' },
  { name: 'Sentry', link: 'https://www.sentry.io/' },
  { name: '1Password', link: 'https://www.1password.com/' },
  { name: 'Greptile', link: 'https://www.greptile.com/' },
  { name: 'GitBook', link: 'https://www.gitbook.com/' },
  { name: 'Globalping by jsDelivr', link: 'https://globalping.io/' },
  { name: 'ProxyCheck.io', link: 'https://proxycheck.io/' },
  { name: 'Digital Defense', link: 'https://digital-defense.io/' },
  { name: 'RIPE NCC', link: 'https://stat.ripe.net/' },
  { name: 'OONI', link: 'https://ooni.org/' },
  { name: 'CAIDA', link: 'https://www.caida.org/' },
  { name: 'ChatGPT', link: 'https://chatgpt.com/' },
  { name: 'Claude', link: 'https://claude.ai/' },
];

// changelog type → semantic color token: add → success; improve → info; fix → destructive
const changelogBadgeClass = (type) => {
  if (type === 'add') return 'bg-success ';
  if (type === 'improve') return 'bg-info ';
  if (type === 'fix') return 'bg-destructive ';
  return '';
};

// Sheet toggle and store.openSheet bidirectional binding
const isOpen = computed(() => store.openSheet === 'about');
const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'about' : null);
};

const openAbout = () => {
  content.value = 'about';
  store.toggleSheet('about');
  trackEvent('Footer', 'FooterClick', 'About');
};

// Direct-entry shortcuts: open the same About sheet but jump straight to the
// changelog / acknowledgement tab. Plain open (not toggle) so a second click
// from another tab just switches tabs instead of closing the sheet.
const openAboutTab = (tab, trackLabel) => {
  content.value = tab;
  store.setOpenSheet('about');
  trackEvent('Footer', 'FooterClick', trackLabel);
};

watch(content, () => {
  nextTick(() => {
    if (sheetBody.value) sheetBody.value.scrollTop = 0;
  });
});

</script>
