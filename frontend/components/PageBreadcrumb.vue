<template>
  <!-- Breadcrumb at the top of a page body, above its <h1>:
         ← Home / Advanced Tools / 🛂 ASN Profile
       Markup and classes follow shadcn-vue's Breadcrumb, written out here as
       ui/ has no breadcrumb copy-in. Every crumb but the last is a real link
       to / (modified clicks open a new tab); the last is the page itself. -->
  <nav aria-label="breadcrumb" class="mb-3">
    <ol class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5">
      <!-- Home: back in history when the homepage is the previous entry
           (restores it as it was left), a push of / otherwise. -->
      <li class="inline-flex items-center gap-1.5">
        <a :href="homeHref" class="inline-flex items-center gap-1 transition-colors hover:text-foreground"
          @click="onHome">
          <ArrowLeft class="size-3.5" aria-hidden="true" />
          {{ t('nav.Home') }}
        </a>
      </li>

      <template v-for="(crumb, index) in items" :key="index">
        <li role="presentation" aria-hidden="true">/</li>
        <li class="inline-flex min-w-0 items-center gap-1.5">
          <span v-if="index === items.length - 1" role="link" aria-disabled="true" aria-current="page"
            class="font-normal text-foreground">{{ crumb.label }}</span>
          <a v-else :href="homeHref" class="transition-colors hover:text-foreground"
            @click="onSection($event, crumb.section)">{{ crumb.label }}</a>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup>
// Page breadcrumb for the pages other than the homepage (tool pages, /privacy,
// /r/:id). `items` are the crumbs after Home, already localized; the last one
// is the current page, the others name a homepage section to scroll to
// (`{ label, section }`, through the same helper as the Nav).
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft } from '@lucide/vue';
import { resolveBackTarget } from '@/utils/back-target.js';
import { isPlainClick } from '@/utils/nav-target.js';
import { useNavTarget } from '@/composables/use-nav-target.js';
import { trackEvent } from '@/utils/analytics';

defineProps({
  items: { type: Array, default: () => [] },
});

const { t } = useI18n();
const router = useRouter();
const { navigateTo } = useNavTarget();

const homeHref = router.resolve('/').href;

const onHome = (event) => {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  if (resolveBackTarget(window.history.state) === 'back') router.back();
  else router.push('/');
  trackEvent('Nav', 'BreadcrumbClick', 'Home');
};

const onSection = (event, section) => {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  navigateTo({ section });
  trackEvent('Nav', 'BreadcrumbClick', section);
};
</script>
