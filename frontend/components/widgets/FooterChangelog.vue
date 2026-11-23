<template>
  <!-- Changelog tab content inside FooterAboutSheet.vue.
       Data lives in frontend/data/changelog.json (shared version, ISO date, per-lang change
       text). Dates localize at render via formatIsoDate; badge labels and the section title
       stay in locale files as UI chrome. -->
  <div class="space-y-6">
    <section v-for="(version, vi) in changelogReversed" :key="vi">
      <header class="flex items-baseline justify-between mb-2">
        <h3 class="text-lg font-semibold tracking-tight">{{ version.version }}</h3>
        <span class="text-xs text-muted-foreground tabular-nums">{{ formatIsoDate(version.date, locale) }}</span>
      </header>
      <Separator class="mb-3" />
      <ul class="space-y-2">
        <li v-for="(item, idx) in version.content" :key="idx" class="flex items-start gap-2 text-sm">
          <Badge :class="changelogBadgeClass(item.type)"
            class="shrink-0 shadow-none! rounded-full justify-center text-secondary p-1"
            :title="t('changelog.' + item.type)">
            <CircleFadingArrowUp v-if="item.type === 'improve'" class="size-3.5" />
            <CirclePlus v-if="item.type === 'add'" class="size-3.5" />
            <BugOff v-if="item.type === 'fix'" class="size-3.5" />
          </Badge>
          <span class="leading-relaxed">{{ changeText(item.change) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
// Lazy Changelog tab for the Footer's About sheet; isolates the multi-language
// changelog.json payload so it downloads only when the Changelog tab is opened.
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import changelogData from '@/data/changelog.json';
import { formatIsoDate } from '@/utils/time-utils';
import { fallbackChain } from '@/utils/locale-registry.js';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BugOff, CircleFadingArrowUp, CirclePlus } from '@lucide/vue';

const { t, locale } = useI18n();

// Static data from JSON — reverse once via computed so the template stays tidy.
const changelogReversed = computed(() => changelogData.slice().reverse());

// Entries carry one string per language; history is only guaranteed for full
// locales, so a beta one walks its fallback chain.
const changeText = (change) => fallbackChain(locale.value).map((code) => change[code]).find(Boolean) ?? '';

// changelog type → semantic color token: add → success; improve → info; fix → destructive
const changelogBadgeClass = (type) => {
  if (type === 'add') return 'bg-success ';
  if (type === 'improve') return 'bg-info ';
  if (type === 'fix') return 'bg-destructive ';
  return '';
};
</script>
