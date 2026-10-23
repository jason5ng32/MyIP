<!-- Site footer on every page: brand / Project / Docs & Support / Clients
     columns, plus a signature bar (with the copyright on self-hosted
     deployments). About / Changelog / Acknowledgement open in its About
     sheet, the CLI in its own dialog; nothing already on the page (tools,
     sections) repeats here. -->
<template>
  <footer class="border-t border-secondary text-sm text-muted-foreground">
    <div class="mx-auto w-full px-4 jn-container">
      <!-- Link columns: four tracks on md+, matching the Advanced Tools grid;
           on phones the brand spans the top and the rest flow two per row. -->
      <div class="grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        <!-- Brand -->
        <div class="col-span-2 md:col-span-1">
          <div class="inline-flex items-center gap-1.5 text-xl font-semibold text-foreground">
            <brandIcon />
            <span class="tracking-tight">
              <span class="font-bold">IP</span><span class="font-extralight">Check.ing</span>
            </span>
          </div>
          <p class="mt-2">{{ t('footer.Tagline') }}</p>
          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <a :href="t('page.footerLink')" target="_blank" rel="noopener" :class="linkClass"
              @click="trackEvent('Footer', 'FooterClick', 'Github')">
              <Icon icon="ri:github-line" class="size-4" />
              <span>GitHub</span>
            </a>
            <a href="https://github.com/sponsors/jason5ng32" target="_blank" rel="noopener"
              class="inline-flex items-center gap-1 text-sm text-[#d63384] no-underline transition-opacity hover:opacity-80">
              <Icon icon="ri:heart-line" class="size-4" />
              {{ t('about.Sponsor') }}
            </a>
          </div>
        </div>

        <!-- Project: the About sheet's tabs, privacy, license and contributing -->
        <nav :aria-label="t('footer.Project')">
          <h3 :class="headingClass">{{ t('footer.Project') }}</h3>
          <ul class="space-y-2">
            <li>
              <button type="button" :class="linkClass" @click="openAbout">
                {{ t('about.Title') }}
              </button>
            </li>
            <li>
              <button type="button" :class="linkClass" @click="openAboutTab('changelog', 'Changelog')">
                {{ t('changelog.Title') }}
              </button>
            </li>
            <li>
              <button type="button" :class="linkClass" @click="openAboutTab('acknowledgement', 'Acknowledgement')">
                {{ t('acknowledgement.Title') }}
              </button>
            </li>
            <li>
              <RouterLink to="/privacy" :class="linkClass" @click="trackEvent('Footer', 'FooterClick', 'Privacy')">
                {{ t('about.Privacy') }}
              </RouterLink>
            </li>
            <li>
              <a :href="`${t('page.footerLink')}/blob/main/LICENSE`" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'License')">
                {{ t('footer.License') }}
              </a>
            </li>
            <li>
              <a :href="`${t('page.footerLink')}/contribute`" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'Contribute')">
                {{ t('footer.Contribute') }}
              </a>
            </li>
          </ul>
        </nav>

        <!-- Docs & Support: locale-aware docs.ipcheck.ing links + issue tracker -->
        <nav :aria-label="t('footer.Support')">
          <h3 :class="headingClass">{{ t('footer.Support') }}</h3>
          <ul class="space-y-2">
            <li>
              <a :href="docsUrl('knowledge-base', locale)" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'HelpCenter')">
                {{ t('about.HelpCenter') }}
              </a>
            </li>
            <li>
              <a :href="docsUrl('developer', locale)" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'DeveloperDocs')">
                {{ t('footer.DeveloperDocs') }}
              </a>
            </li>
            <li>
              <a :href="docsUrl('developer', locale, 'getting-started/')" target="_blank" rel="noopener"
                :class="linkClass" @click="trackEvent('Footer', 'FooterClick', 'SelfHosting')">
                {{ t('footer.SelfHosting') }}
              </a>
            </li>
            <li>
              <a :href="`${t('page.footerLink')}/issues`" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'ReportIssue')">
                {{ t('footer.ReportIssue') }}
              </a>
            </li>
          </ul>
        </nav>

        <!-- Clients: Raycast / Lite always; the CLI entry needs the curl
             domains configured. -->
        <nav :aria-label="t('footer.Clients')">
          <h3 :class="headingClass">{{ t('footer.Clients') }}</h3>
          <ul class="space-y-2">
            <li>
              <a href="https://www.raycast.com/jason5ng32/ipcheck-ing" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'Raycast')">
                <Icon icon="simple-icons:raycast" class="size-4 shrink-0" />
                {{ t('footer.Raycast') }}
              </a>
            </li>
            <li v-if="curlDomainsHadSet">
              <button type="button" :class="linkClass" @click="openCurl">
                <Terminal class="size-4 shrink-0" />
                {{ t('curl.Title') }}
              </button>
            </li>
            <li>
              <a href="https://lite.ipcheck.ing" target="_blank" rel="noopener" :class="linkClass"
                @click="trackEvent('Footer', 'FooterClick', 'Lite')">
                <Feather class="size-4 shrink-0" />
                {{ t('footer.Lite') }}
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Signature bar: every deployment; the copyright only when self-hosted -->
      <div class="flex flex-col items-center gap-y-1.5 border-t border-secondary py-6 text-center text-xs opacity-70">
        <span>Created by Jason Ng with love</span>
        <span v-if="!configs.originalSite">
          {{ t('page.copyRightName') }}
          <a :href="t('page.copyRightLink')" target="_blank" rel="noopener"
            class="text-foreground/80 hover:text-foreground hover:underline">
            {{ t('page.copyRightLinkName') }}
          </a>
        </span>
      </div>
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
                    <span class="leading-relaxed">{{ changeText(item.change) }}</span>
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

    <!-- Command Line API dialog: only opened from the Clients link, which
         is listed only when the curl domains are configured. -->
    <Dialog :open="isCurlOpen" @update:open="isCurlOpen = $event">
      <DialogContent :title="t('curl.Title')">
        <DialogHeader :icon="Terminal" :title="t('curl.Title')" />

        <div class="space-y-3">
          <!-- Description -->
          <div class="space-y-1 text-xs font-mono">
            <p class="jn-comment"><span class="text-muted-foreground">{{ t('curl.Note1') }}</span></p>
            <p class="jn-comment">
              <span class="text-muted-foreground">{{ t('curl.Note2_1') }}
                <Badge variant="outline" class="text-success">curl</Badge> {{ t('curl.Note2_2') }}
              </span>
            </p>
            <p class="jn-comment">
              <span class="text-muted-foreground">
                <Badge variant="outline" class="text-success">geo</Badge> {{ t('curl.Note3') }}
              </span>
            </p>
          </div>

          <!-- 3 curl command blocks -->
          <div class="space-y-3">
            <div>
              <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv4') }}</p>
              <pre
                class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv4Domain }}<span class="text-success">/geo</span></pre>
            </div>
            <div>
              <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.getIPv6') }}</p>
              <pre
                class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv6Domain }}<span class="text-success">/geo</span></pre>
            </div>
            <div>
              <p class="jn-comment text-xs font-mono mb-1.5 text-muted-foreground">{{ t('curl.get6and4') }}</p>
              <pre
                class="jn-curl bg-black text-neutral-100 rounded-md p-3 text-xs font-mono overflow-x-auto">curl {{ curl.ipv64Domain }}<span class="text-success">/geo</span></pre>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </footer>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import changelogData from '@/data/changelog.json';
import { trackEvent } from '@/utils/analytics';
import { docsUrl } from '@/utils/docs-url.js';
import { formatIsoDate } from '@/utils/time-utils';
import { fallbackChain } from '@/utils/locale-registry.js';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Compass, ExternalLink, CircleFadingArrowUp, CirclePlus, BugOff, Smile, Terminal, Feather } from '@lucide/vue';
import brandIcon from './svgicons/Brand.vue';
import { Icon } from '@iconify/vue';
import { useRouteActive } from '@/composables/use-route-active.js';

const { t, tm, rt, locale } = useI18n();

const store = useMainStore();
const configs = computed(() => store.configs);
const curl = computed(() => store.curl);
const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);
const tabs = ['about', 'changelog', 'acknowledgement'];
const content = ref('about');

const headingClass = 'mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const linkClass = 'inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground cursor-pointer';
// Static data from JSON — reverse once via computed so the template stays tidy.
const changelogReversed = computed(() => changelogData.slice().reverse());

// Entries carry one string per language; history is only guaranteed for full
// locales, so a beta one walks its fallback chain.
const changeText = (change) => fallbackChain(locale.value).map((code) => change[code]).find(Boolean) ?? '';

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
  { name: 'V.PS', link: 'https://v.ps/?utm_source=ipcheck.ing&utm_medium=acknowledgement&utm_campaign=footer' },
  { name: 'RapidProxy', link: 'https://www.rapidproxy.io/?ref=myip' },
  { name: 'SwiftProxy', link: 'https://www.swiftproxy.net/?ref=myip' },
  { name: 'Proxy-Seller', link: 'https://proxy-seller.com/?partner=4FEC1644D12240F4' },
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

// Sheet toggle and store.openSheet bidirectional binding. Home and ToolPage are
// both cached with a Footer each; only the page on screen opens its sheet.
const routeActive = useRouteActive();
const isOpen = computed(() => routeActive.value && store.openSheet === 'about');
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

const isCurlOpen = ref(false);
const openCurl = () => {
  isCurlOpen.value = true;
  trackEvent('Footer', 'FooterClick', 'Curl');
};

watch(content, () => {
  nextTick(() => {
    if (sheetBody.value) sheetBody.value.scrollTop = 0;
  });
});

</script>

<style scoped>
.jn-curl::before {
  content: '$ ';
  color: var(--muted-foreground);
  font-weight: 500;
  margin-right: 0.25rem;
  opacity: 0.7;
}

.jn-comment::before {
  content: '// ';
  color: var(--muted-foreground);
  font-weight: 500;
  opacity: 0.7;
}
</style>
