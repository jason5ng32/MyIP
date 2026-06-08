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
        <RouterLink to="/"
          class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ArrowLeft class="size-4" />
          <span class="hidden sm:inline">{{ t('advancedtools.BackToHome') }}</span>
        </RouterLink>
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
import Footer from '@/components/Footer.vue';
import brandIcon from '@/components/svgicons/Brand.vue';
import { ArrowLeft } from '@lucide/vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const tool = computed(() => TOOL_BY_SLUG.get(route.params.slug) || null);
const toolComponent = computed(() => (tool.value ? defineAsyncComponent(tool.value.component) : null));

// Unknown slug → bounce to the homepage rather than show an empty shell.
if (!tool.value) router.replace('/');
</script>
