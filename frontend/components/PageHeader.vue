<template>
  <!-- Sticky header shared by the pages other than the homepage (/tools/:slug,
       /privacy, /r/:id): what the homepage Nav offers minus its section links.

         sm and up:  [← Back to Home] [brand] / [Advanced Tools ▾] / [title] …… [account]
                     (the back label from md up)
         below sm:   [←] [title, truncated] …… [tools icon] [account]

       One DOM order serves both: below `sm` the brand and the separators are
       hidden and `order` moves the tools menu and the account menu after the
       title, which takes the free width and truncates. It stays pinned (no
       hide-on-scroll, unlike Nav.vue) and carries the iOS safe-area inset
       itself (body.jn-standalone-page in index.html reserves nothing), so when
       sticky pins it at the viewport top the row sits below the Dynamic Island
       and the blurred background paints the status-bar strip. -->
  <header
    class="sticky top-0 z-40 border-b bg-background/80 supports-[backdrop-filter:blur(0px)]:bg-background/60 backdrop-blur pt-[env(safe-area-inset-top)]">
    <div class="mx-auto flex w-full max-w-[1600px] items-center gap-2 px-4 h-14">
      <!-- Back: a real link to `/` (new tab / copy link keep working); a plain
           click steps back in history when that lands on the homepage
           (utils/back-target.js). Icon-only below `md`: from `sm` the brand
           and the tools menu join the row, and with the label too (up to
           ~150px in pt-BR) the title kept under 30px at 640px. `sr-only` (not
           `hidden`) keeps the accessible name in every locale, and being out
           of flow it costs no `gap-2`. -->
      <Button as-child variant="ghost" size="sm" class="h-8 shrink-0 gap-1.5 px-2 cursor-pointer">
        <a :href="homeHref" @click="onBack">
          <ArrowLeft />
          <span class="sr-only md:not-sr-only">{{ t('advancedtools.BackToHome') }}</span>
        </a>
      </Button>

      <!-- Brand → home (sm and up). -->
      <RouterLink to="/"
        class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1 text-lg font-semibold text-foreground no-underline hover:opacity-80 transition-opacity max-sm:hidden"
        aria-label="IPCheck.ing">
        <brandIcon />
        <span class="tracking-tight">
          <span class="font-bold">IP</span><span class="font-extralight">Check.</span><span
            class="font-extralight">ing</span>
        </span>
      </RouterLink>
      <span class="text-muted-foreground max-sm:hidden" aria-hidden="true">/</span>

      <!-- Tools menu: after the brand from `sm` up, at the right edge below. -->
      <div class="shrink-0 max-sm:order-1">
        <ToolsMenu :current="currentSlug" @select="openTool" />
      </div>

      <!-- Page title: the free width between the menus; empty pages keep the
           span as the spacer. -->
      <span v-if="title" class="text-muted-foreground max-sm:hidden" aria-hidden="true">/</span>
      <span class="min-w-0 flex-1 truncate font-medium">{{ title }}</span>

      <!-- Account menu (preferences cog when Firebase is not configured). -->
      <div class="flex shrink-0 items-center max-sm:order-2">
        <UserMenu />
      </div>
    </div>

    <!-- Dialog hosts for the account menu: Benefits & Usage (also the quota
         hints of the sign-in tools) and Preferences. Home hosts its own; each
         answers only while its page is on screen. -->
    <User />
    <Preferences />
  </header>
</template>

<script setup>
// Shared header for the non-home pages: back, brand, tools menu, page title,
// account menu. `title` comes in already localized.
import { computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import brandIcon from '@/components/svgicons/Brand.vue';
import ToolsMenu from '@/components/ToolsMenu.vue';
import UserMenu from '@/components/UserMenu.vue';
import User from '@/components/User.vue';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@lucide/vue';
import { resolveBackTarget } from '@/utils/back-target.js';
import { trackEvent } from '@/utils/analytics';

const Preferences = defineAsyncComponent(() => import('@/components/widgets/Preferences.vue'));

defineProps({
  // Title shown after the tools menu (e.g. "🌐 MTR Test" or "Privacy").
  // Empty string renders back, brand and the menus only.
  title: { type: String, default: '' },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const homeHref = router.resolve('/').href;
const currentSlug = computed(() => (route.name === 'tool' ? String(route.params.slug) : ''));

// A modified or non-primary click is the browser's (new tab / window); a plain
// one goes back to the kept-alive homepage when it is the previous entry.
const onBack = (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey
    || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (resolveBackTarget(window.history.state) === 'back') router.back();
  else router.push('/');
  trackEvent('Nav', 'NavClick', 'Back');
};

const openTool = (slug) => {
  router.push(`/tools/${slug}`);
  trackEvent('Nav', 'NavClick', slug.charAt(0).toUpperCase() + slug.slice(1));
};
</script>
