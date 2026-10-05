<template>
  <!-- The page of one advanced tool, /tools/:slug. At least a viewport tall
       below the fixed Nav, so the footer sits at the bottom of a short page. -->
  <div class="flex min-h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))] flex-col">
    <main class="flex-1">
      <div class="mx-auto w-full max-w-[1400px] px-4 md:px-6 py-6">
        <PageBreadcrumb v-if="tool" :items="breadcrumb" />
        <h1 v-if="tool" class="mb-4 flex items-center gap-2 text-2xl md:text-3xl font-semibold tracking-tight">
          <span aria-hidden="true">{{ tool.emoji }}</span>
          {{ t(tool.titleKey) }}
        </h1>
        <!-- One cached instance per visited slug -->
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
import PageBreadcrumb from '@/components/PageBreadcrumb.vue';
import { ToolLoadingSkeleton } from '@/components/ui/tool-loading-skeleton';

defineOptions({ name: 'ToolPage' });

// One async wrapper per slug, built once: a new wrapper would remount the tool
// and lose its cached state. `delay` keeps fast loads skeleton-free.
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

// Held while another route shows: the cached page keeps rendering its tool.
const routeSlug = computed(() => (route.name === 'tool' ? route.params.slug : null));
const slug = computed((previous) => routeSlug.value ?? previous ?? null);

const tool = computed(() => TOOL_BY_SLUG.get(slug.value) || null);
const toolComponent = computed(() => (tool.value ? asyncToolFor(tool.value) : null));

const breadcrumb = computed(() => [
  { label: t('advancedtools.Title'), section: 'AdvancedTools' },
  { label: `${tool.value.emoji} ${t(tool.value.titleKey)}` },
]);

// Per-tool head: localized title + description, self-referential canonical.
useDocumentMeta(() => {
  if (!tool.value) return {};
  return {
    title: `${t(tool.value.titleKey)} · IPCheck.ing`,
    description: t(tool.value.noteKey),
    canonical: `${window.location.origin}/tools/${tool.value.slug}`,
  };
});

// Unknown slug → homepage, on every arrival (a cached instance included).
watch(routeSlug, (next) => {
    if (next && !tool.value) router.replace('/');
}, { immediate: true });

// Re-keys the KeepAlive when the account goes away (utils/tool-cache.js), so
// a sign-out or account switch drops every cached tool.
const authEpoch = ref(0);
watch(() => store.user?.uid ?? null, (nextUid, prevUid) => {
    if (shouldDropToolCache(prevUid, nextUid)) authEpoch.value += 1;
});
</script>
