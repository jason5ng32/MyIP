<!-- Site footer on every page: brand / Project / Docs & Support / Clients
     columns, plus a signature bar (with the copyright on self-hosted
     deployments). About / Changelog / Acknowledgement open in its About
     sheet, the CLI in its own dialog; nothing already on the page (tools,
     sections) repeats here. A festival theme hangs its garland. -->
<template>
  <footer class="relative border-t border-secondary text-sm text-muted-foreground">
    <!-- Festival garland across the empty top padding. -->
    <div v-if="festivalFooterTrim" aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-12 overflow-hidden">
      <component :is="festivalFooterTrim" />
    </div>
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
              <button type="button" :class="linkClass" @click="openAboutTab('acknowledgement', 'Acknowledgement')">
                {{ t('acknowledgement.Title') }}
              </button>
            </li>
            <li>
              <button type="button" :class="linkClass" @click="openAboutTab('changelog', 'Changelog')">
                {{ t('changelog.Title') }}
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

        <!-- Docs & Support: the shortcut guide (Home only, where the keys
             work), locale-aware docs.ipcheck.ing links + issue tracker -->
        <nav :aria-label="t('footer.Support')">
          <h3 :class="headingClass">{{ t('footer.Support') }}</h3>
          <ul class="space-y-2">
            <li v-if="shortcutGuide">
              <button type="button" :class="linkClass" @click="openShortcutGuide">
                {{ t('footer.ShortcutGuide') }}
              </button>
            </li>
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
            <li>
              <a :href="`${t('page.footerLink')}/issues/new?template=feature_request.md`" target="_blank" rel="noopener"
                :class="linkClass" @click="trackEvent('Footer', 'FooterClick', 'FeatureRequest')">
                {{ t('footer.FeatureRequest') }}
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

    <!-- Lazy overlays: loaded on demand when the visitor clicks a sheet/dialog entry -->
    <FooterAboutSheet v-if="hasOpenedAbout" :open="isOpen" v-model:tab="content"
      @update:open="onOpenChange" />
    <FooterCliDialog v-if="hasOpenedCurl" v-model:open="isCurlOpen" />
  </footer>
</template>

<script setup>
import { ref, computed, watch, onDeactivated, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/analytics';
import { docsUrl } from '@/utils/docs-url.js';
import { Terminal, Feather } from '@lucide/vue';
import brandIcon from './svgicons/Brand.vue';
import { Icon } from '@iconify/vue';
import { useRouteActive } from '@/composables/use-route-active.js';
import { useFestivalSkin } from '@/composables/use-festival-skin.js';

const FooterAboutSheet = defineAsyncComponent(() => import('@/components/widgets/FooterAboutSheet.vue'));
const FooterCliDialog = defineAsyncComponent(() => import('@/components/widgets/FooterCliDialog.vue'));

// Home passes `shortcut-guide` and owns the Help dialog the link opens.
defineProps({ shortcutGuide: { type: Boolean, default: false } });
const emit = defineEmits(['open-shortcut-guide']);

const { t, locale } = useI18n();

const store = useMainStore();
const configs = computed(() => store.configs);

// Festival theme's footer trim, if the active festival has one.
const { footerTrim: festivalFooterTrim } = useFestivalSkin();
const curlDomainsHadSet = computed(() => store.curlDomainsHadSet);
const content = ref('about');

const headingClass = 'mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const linkClass = 'inline-flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground cursor-pointer';

// Sheet toggle and store.openSheet bidirectional binding. Home and ToolPage are
// both cached with a Footer each; only the page on screen opens its sheet.
const routeActive = useRouteActive();
const isOpen = computed(() => routeActive.value && store.openSheet === 'about');
const hasOpenedAbout = ref(false);
watch(isOpen, (open) => {
  if (open) hasOpenedAbout.value = true;
}, { immediate: true });

const onOpenChange = (val) => {
  store.setOpenSheet(val ? 'about' : null);
};

const openAbout = () => {
  content.value = 'about';
  hasOpenedAbout.value = true;
  store.toggleSheet('about');
  trackEvent('Footer', 'FooterClick', 'About');
};

// Direct-entry shortcuts: open the same About sheet but jump straight to the
// changelog / acknowledgement tab. Plain open (not toggle) so a second click
// from another tab just switches tabs instead of closing the sheet.
const openAboutTab = (tab, trackLabel) => {
  content.value = tab;
  hasOpenedAbout.value = true;
  store.setOpenSheet('about');
  trackEvent('Footer', 'FooterClick', trackLabel);
};

const openShortcutGuide = () => {
  emit('open-shortcut-guide');
  trackEvent('Footer', 'FooterClick', 'ShortcutGuide');
};

const hasOpenedCurl = ref(false);
const isCurlOpen = ref(false);
const openCurl = () => {
  hasOpenedCurl.value = true;
  isCurlOpen.value = true;
  trackEvent('Footer', 'FooterClick', 'Curl');
};

// Clear pending or open CLI dialog state when leaving the cached page or
// switching between tools inside the shared ToolPage shell.
const route = useRoute();
watch(() => route.path, () => {
  if (isCurlOpen.value) isCurlOpen.value = false;
});
onDeactivated(() => {
  isCurlOpen.value = false;
});
</script>
