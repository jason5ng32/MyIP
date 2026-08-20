<template>
  <!-- Slim sticky header shared by the standalone pages (/tools/:slug,
       /privacy, /r/:id). Brand → home, an optional breadcrumb title, and a
       back-to-home button. This is NOT the homepage nav (Nav.vue) — that one
       carries the full navigation, user menu, mobile drawer, and hides on
       scroll; this one stays pinned. It carries the iOS safe-area inset itself
       (body.jn-standalone-page in index.html reserves nothing), so when sticky
       pins it at the viewport top the row sits below the Dynamic Island and
       the blurred background paints the status-bar strip. -->
  <header class="sticky top-0 z-40 border-b bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur pt-[env(safe-area-inset-top)]">
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
      <!-- Breadcrumb: " / <title>" — only when the page passes a title. -->
      <template v-if="title">
        <span class="text-muted-foreground" aria-hidden="true">/</span>
        <span class="min-w-0 truncate font-medium">{{ title }}</span>
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
</template>

<script setup>
// Shared slim header for standalone pages. The breadcrumb label is passed in as
// `title` (already localized by the caller); everything else is fixed chrome.
import { useI18n } from 'vue-i18n';
import brandIcon from '@/components/svgicons/Brand.vue';
import { ArrowLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';

defineProps({
    // Breadcrumb text shown after the brand (e.g. "🌐 MTR Test" or "Privacy").
    // Empty string renders just the brand + back button.
    title: { type: String, default: '' },
});

const { t } = useI18n();
</script>
