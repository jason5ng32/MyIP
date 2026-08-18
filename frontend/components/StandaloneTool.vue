<template>
  <!-- Standalone page for a single advanced tool, reached at /tools/:slug
       (new-window / shareable / crawlable). Renders the exact same tool
       component the drawer does, just inside a minimal page chrome instead of
       the homepage + drawer. -->
  <div class="flex min-h-screen flex-col">
    <!-- User system dialogs host (Benefits & Usage) — the sign-in gated tools
         link to it from their quota hints, and it fetches the user's usage
         snapshot so their frontend quota gate works here too. -->
    <User />

    <!-- Slim header: brand → home, current tool breadcrumb, back link. -->
    <StandalonePageHeader :title="tool ? `${tool.emoji} ${t(tool.titleKey)}` : ''" />

    <!-- Content: an <h1> for the tool (SEO), then the tool body itself -->
    <main class="flex-1">
      <div class="mx-auto w-full max-w-[1400px] px-4 md:px-6 py-6">
        <h1 v-if="tool" class="mb-4 flex items-center gap-2 text-2xl md:text-3xl font-semibold tracking-tight">
          <span aria-hidden="true">{{ tool.emoji }}</span>
          {{ t(tool.titleKey) }}
        </h1>
        <component :is="toolComponent" v-if="toolComponent" />
      </div>
    </main>

    <Footer />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { TOOL_BY_SLUG } from '@/data/tools.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';
import Footer from '@/components/Footer.vue';
import StandalonePageHeader from '@/components/StandalonePageHeader.vue';
import User from '@/components/User.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// noStandalone tools are blacklisted from this page entirely — they depend on
// homepage state, so the drawer on the homepage is their only home.
const registered = TOOL_BY_SLUG.get(route.params.slug) || null;
const tool = computed(() => (registered && !registered.noStandalone ? registered : null));
const toolComponent = computed(() => (tool.value ? defineAsyncComponent(tool.value.component) : null));

// Per-tool head: localized title + description, self-referential canonical.
useDocumentMeta(() => {
  if (!tool.value) return {};
  return {
    title: `${t(tool.value.titleKey)} · IPCheck.ing`,
    description: t(tool.value.noteKey),
    canonical: `${window.location.origin}/tools/${tool.value.slug}`,
  };
});

// Unknown slug → bounce to the homepage rather than show an empty shell; a
// blacklisted tool keeps its destination by reopening as the homepage drawer.
if (!tool.value) {
    router.replace(registered?.noStandalone
        ? { path: '/', query: { tool: registered.slug } }
        : '/');
}
</script>
