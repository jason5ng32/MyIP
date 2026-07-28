<template>
  <!-- Standalone privacy page at /privacy (shareable + crawlable) -->
  <div class="flex min-h-screen flex-col">
    <!-- Slim header (shared with the standalone tool pages). -->
    <StandalonePageHeader :title="t('about.Privacy')" />

    <!-- Content -->
    <main class="flex-1">
      <!-- Brief loading state while the locale pack is fetched on first paint. -->
      <div v-if="!ready" class="flex justify-center py-20">
        <Spinner />
      </div>

      <article v-else class="mx-auto w-full max-w-[760px] px-4 md:px-6 py-8">
        <h1 class="mb-1 text-2xl md:text-3xl font-semibold tracking-tight">{{ t('privacy.Title') }}</h1>
        <p class="mb-6 text-xs text-muted-foreground">{{ t('privacy.UpdatedLabel') }}: {{ LAST_UPDATED }}</p>

        <p class="mb-8 leading-relaxed text-foreground/90">{{ t('privacy.Intro') }}</p>

        <!-- Sections are driven by `order` (computed from the feature flags).
             Each id maps to a privacy.sections.<id> block; paragraphs() and
             bullets() pull the arrays via tm() and resolve them with rt(). -->
        <section v-for="id in order" :key="id" class="mb-8">
          <h2 class="mb-2 text-lg font-semibold">{{ t(`privacy.sections.${id}.title`) }}</h2>
          <p v-for="(p, i) in paragraphs(id)" :key="i" class="mb-2 leading-relaxed text-foreground/85">
            {{ p }}
          </p>
          <ul v-if="bullets(id).length" class="mt-2 list-disc space-y-1.5 pl-5 text-foreground/85">
            <li v-for="(b, i) in bullets(id)" :key="i" class="leading-relaxed">{{ b }}</li>
          </ul>
        </section>
      </article>
    </main>

    <Footer />
  </div>
</template>

<script setup>
// Privacy page: assembles its sections from a feature-gated id list. The copy is
// a separate locale pack so it stays out of the main language bundle and is
// easier to maintain on its own.
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMainStore } from '@/store';
import { isAnalyticsEnabled } from '@/utils/analytics';
import { isDocsConfigured } from '@/composables/use-docs-assistant.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';
import Footer from '@/components/Footer.vue';
import StandalonePageHeader from '@/components/StandalonePageHeader.vue';
import { Spinner } from '@/components/ui/spinner';

const { t, tm, rt, locale, mergeLocaleMessage } = useI18n();
const store = useMainStore();
const { isFireBaseSet } = storeToRefs(store);

// Bump when the policy text changes materially.
const LAST_UPDATED = '2026-07-28';

// Sentry telemetry is a build-time decision (see frontend/AGENTS.md): the
// section only renders on deployments actually built with a DSN.
const isSentryEnabled = !!(import.meta.env ?? {}).VITE_SENTRY_DSN_FRONTEND;

// Report sharing is env-gated on the backend (CLOUDFLARE_* KV variables);
// the section only renders on deployments where links can actually be made.
const isReportSharingEnabled = computed(() => store.configs?.reportSharing === true);

// The docs assistant carries its own gate (build-time VITE_DOCS_URL plus the
// canonical deployment) — same condition as its nav entry point, so the
// section never describes a feature this deployment doesn't ship.
const isDocsAssistantEnabled = computed(() => isDocsConfigured && store.configs?.originalSite === true);

// Privacy copy is loaded on demand per locale (mirrors the security-checklist
// dataset pattern), then merged into i18n so t() / tm() can resolve it.
const privacyLoaders = {
  en: () => import('@/locales/privacy/en.json'),
  zh: () => import('@/locales/privacy/zh.json'),
  fr: () => import('@/locales/privacy/fr.json'),
  ru: () => import('@/locales/privacy/ru.json'),
};

const loaded = new Set();
const ready = ref(false);

// Merge one locale's privacy copy into i18n (memoized). Does NOT touch `ready` —
// the caller decides when to reveal, so a background fallback load can't race the
// active locale and paint the wrong language.
const loadPrivacy = async (loc) => {
  if (loaded.has(loc)) return;
  const load = privacyLoaders[loc] || privacyLoaders.en;
  const { default: msgs } = await load();
  mergeLocaleMessage(loc, msgs);
  loaded.add(loc);
};

// Reveal only after the ACTIVE locale's copy is merged — otherwise the en
// fallback load could resolve first and paint English (t() falling back) until
// the next re-render. The en fallback (covering any key the active locale might
// miss) loads in the background and doesn't gate the reveal.
watch(locale, async (loc) => {
  ready.value = false;
  await loadPrivacy(loc);
  if (loc === locale.value) ready.value = true; // ignore a stale load if locale changed mid-flight
  if (loc !== 'en') loadPrivacy('en');
}, { immediate: true });

// Ordered section ids, gated on which collection actually happens here. The
// "why" section explains the reason for whichever collection is active.
const order = computed(() => {
  const ids = ['tools'];
  if (isReportSharingEnabled.value) ids.push('sharedReports');
  if (isDocsAssistantEnabled.value) ids.push('docsAssistant');
  if (isAnalyticsEnabled) ids.push('analytics');
  if (isFireBaseSet.value) ids.push('account');
  if (isSentryEnabled) ids.push('telemetry');
  if (isAnalyticsEnabled || isFireBaseSet.value || isSentryEnabled) ids.push('why');
  ids.push('cookies');
  if (isAnalyticsEnabled) ids.push('eu');
  return ids;
});

// Resolve a section's paragraphs to display strings. Two sections are assembled
// per-flag rather than from a fixed array: "why" carries a reason per collection
// type, and "cookies" mentions the GA cookie only when analytics is on.
const paragraphs = (id) => {
  if (id === 'why') {
    const out = [];
    if (isAnalyticsEnabled) out.push(t('privacy.sections.why.analytics'));
    if (isFireBaseSet.value) out.push(t('privacy.sections.why.account'));
    if (isSentryEnabled) out.push(t('privacy.sections.why.telemetry'));
    return out;
  }
  if (id === 'cookies') {
    const out = [];
    if (isAnalyticsEnabled) out.push(t('privacy.sections.cookies.analytics'));
    out.push(t('privacy.sections.cookies.local'));
    return out;
  }
  const arr = tm(`privacy.sections.${id}.paragraphs`);
  return Array.isArray(arr) ? arr.map(rt) : [];
};

const bullets = (id) => {
  const arr = tm(`privacy.sections.${id}.bullets`);
  return Array.isArray(arr) ? arr.map(rt) : [];
};

// Page head: localized title + description, self-referential canonical. Title
// uses the always-loaded about.Privacy key; the description (from the on-demand
// pack) fills in once ready — watchEffect re-runs when it loads.
useDocumentMeta(() => ({
  title: `${t('about.Privacy')} · IPCheck.ing`,
  description: ready.value ? t('privacy.Intro') : '',
  canonical: `${window.location.origin}/privacy`,
}));
</script>
