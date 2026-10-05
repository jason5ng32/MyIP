<template>
  <!-- The page of one advanced tool, at /tools/:slug — where every opener
       (cards, nav, tools menu, shortcuts, links) lands. App.vue keeps this
       page alive, and the inner KeepAlive below keeps every visited tool
       alive per slug. -->
  <div class="flex min-h-screen flex-col">
    <!-- Page header: back, brand, tools menu, current tool, account menu. It
         also hosts the User dialogs (Benefits & Usage) the sign-in gated
         tools link to from their quota hints, and whose user-info fetch feeds
         their frontend quota gate. -->
    <PageHeader :title="tool ? `${tool.emoji} ${t(tool.titleKey)}` : ''" />

    <!-- Content: an <h1> for the tool (SEO), then the tool body itself -->
    <main class="flex-1">
      <div class="mx-auto w-full max-w-[1400px] px-4 md:px-6 py-6">
        <h1 v-if="tool" class="mb-4 flex items-center gap-2 text-2xl md:text-3xl font-semibold tracking-tight">
          <span aria-hidden="true">{{ tool.emoji }}</span>
          {{ t(tool.titleKey) }}
        </h1>
        <!-- One cached instance per visited slug; re-keyed by the auth epoch
             so a sign-out or account switch drops them all. -->
        <KeepAlive :key="authEpoch" :max="8">
          <component :is="toolComponent" v-if="toolComponent" :key="tool.slug" />
        </KeepAlive>
      </div>
    </main>

    <Footer />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { TOOL_BY_SLUG } from '@/data/tools.js';
import { useDocumentMeta } from '@/composables/use-document-meta.js';
import { shouldDropToolCache } from '@/utils/tool-cache.js';
import Footer from '@/components/Footer.vue';
import PageHeader from '@/components/PageHeader.vue';
import { ToolLoadingSkeleton } from '@/components/ui/tool-loading-skeleton';

defineOptions({ name: 'ToolPage' });

// One async wrapper per slug, built once, so re-renders never rebuild it — a
// new wrapper would remount the tool and lose its cached state.
// The skeleton covers the chunk download; `delay` keeps fast loads flash-free.
const asyncToolCache = new Map();
const asyncToolFor = (tool) => {
    if (!asyncToolCache.has(tool.slug)) {
        asyncToolCache.set(tool.slug, defineAsyncComponent({
            loader: tool.component,
            loadingComponent: ToolLoadingSkeleton,
            delay: 200,
        }));
    }
    return asyncToolCache.get(tool.slug);
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const store = useMainStore();

// The slug of the tool route, held while another route shows: this page stays
// cached then, and must keep rendering the tool it was showing.
const routeSlug = computed(() => (route.name === 'tool' ? route.params.slug : null));
const slug = computed((previous) => routeSlug.value ?? previous ?? null);

const tool = computed(() => TOOL_BY_SLUG.get(slug.value) || null);
const toolComponent = computed(() => (tool.value ? asyncToolFor(tool.value) : null));

// Per-tool head: localized title + description, self-referential canonical.
useDocumentMeta(() => {
  if (!tool.value) return {};
  return {
    title: `${t(tool.value.titleKey)} · IPCheck.ing`,
    description: t(tool.value.noteKey),
    canonical: `${window.location.origin}/tools/${tool.value.slug}`,
  };
});

// Unknown slug → bounce to the homepage rather than show an empty shell.
// Runs on every arrival at a tool route, including a reused instance.
watch(routeSlug, (next) => {
    if (next && !tool.value) router.replace('/');
}, { immediate: true });

// Auth epoch: bumped when the signed-in account goes away (utils/tool-cache.js),
// which re-keys the inner KeepAlive and so drops every cached tool.
const authEpoch = ref(0);
watch(() => store.user?.uid ?? null, (nextUid, prevUid) => {
    if (shouldDropToolCache(prevUid, nextUid)) authEpoch.value += 1;
});
</script>
