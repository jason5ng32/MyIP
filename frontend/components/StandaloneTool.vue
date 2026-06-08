<template>
  <!-- Standalone page for a single advanced tool, reached at /tools/:slug
       (new-window / shareable / crawlable). Renders the exact same tool
       component the drawer does, just inside a minimal page chrome instead of
       the homepage + drawer. -->
  <div class="flex min-h-screen flex-col">
    <!-- Slim header: brand → home, current tool, back link -->
    <header class="sticky top-0 z-40 border-b bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur">
      <div class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 h-14">
        <RouterLink to="/"
          class="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-lg font-semibold text-foreground no-underline hover:opacity-80 transition-opacity"
          aria-label="IPCheck.ing">
          <brandIcon />
          <span class="tracking-tight">
            <span class="font-bold">IP</span><span class="font-extralight">Check.</span><span
              class="font-extralight">ing</span>
          </span>
        </RouterLink>
        <template v-if="tool">
          <span class="text-muted-foreground" aria-hidden="true">/</span>
          <span class="min-w-0 truncate font-medium">{{ tool.emoji }} {{ t(tool.titleKey) }}</span>
        </template>
        <!-- Button `as-child` renders the RouterLink as its root, so this is a
             single <a> styled as a button — not a <button> nested in an <a>. -->
        <Button as-child variant="default" class="ml-auto shrink-0 cursor-pointer">
          <RouterLink to="/">
            <ArrowLeft class="size-4" /> {{ t('advancedtools.BackToHome') }}
          </RouterLink>
        </Button>
      </div>
    </header>

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
import brandIcon from '@/components/svgicons/Brand.vue';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tool = computed(() => TOOL_BY_SLUG.get(route.params.slug) || null);
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

// Unknown slug → bounce to the homepage rather than show an empty shell.
if (!tool.value) router.replace('/');
</script>
