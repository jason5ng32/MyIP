<template>
  <!-- Markup and classes follow shadcn-vue's Breadcrumb (ui/ has no copy-in). -->
  <nav aria-label="breadcrumb" class="mb-3">
    <ol class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5">
      <!-- Home: back in history when Home is the previous entry, so it returns as left -->
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
          <a v-if="crumb.section" :href="homeHref" class="transition-colors hover:text-foreground"
            @click="onSection($event, crumb.section)">{{ crumb.label }}</a>
          <span v-else role="link" aria-disabled="true" aria-current="page"
            class="font-normal text-foreground">{{ crumb.label }}</span>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup>
// Breadcrumb above the <h1> of every page but Home: ← Home / … / current page.
// `items` are the localized crumbs after Home: `{ label, section }` links to a
// homepage section, reached as the Nav does; a bare `{ label }` is the current
// page. A trail may end on a section when the <h1> beside it names the page.
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
