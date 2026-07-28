<template>
  <!-- Nav entry point for the docs assistant. Desktop gets an ask box whose
       placeholder rotates through preset questions — so it reads as "ask
       anything", and Enter on an empty box asks whatever is on show. Mobile
       gets the same entry as a single icon. Both are inert while the panel
       itself is open (it owns the conversation then).
       The embed lives in widgets/DocsAssistant.vue; the loading and
       configuration in composables/use-docs-assistant.js. -->
  <form v-if="enabled && !isMobile" class="relative" @submit.prevent="submitDocsSearch">
    <Sparkle class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground z-10" />
    <Input v-model="query" type="text" :aria-label="t('nav.SearchDocs')" :disabled="isDocsOpen"
      class="h-8 w-44 focus:w-64 transition-[width] duration-300 pl-8 text-sm" autocomplete="off" autocorrect="off"
      autocapitalize="off" spellcheck="false" data-1p-ignore data-lpignore="true"
      @keydown.enter.prevent="submitDocsSearch" @focus="isFocused = true" @blur="isFocused = false" />
    <!-- Rotating placeholder rendered as an overlay (native placeholders
         can't animate). Hidden as soon as the visitor types. -->
    <div v-if="!query" class="pointer-events-none absolute inset-y-0 left-8 right-2 flex items-center overflow-hidden">
      <Transition enter-active-class="transition-all duration-300 ease-out" enter-from-class="opacity-0 translate-y-3"
        enter-to-class="opacity-100 translate-y-0" leave-active-class="transition-all duration-300 ease-in absolute"
        leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-3">
        <span :key="placeholder" class="block w-full truncate text-sm text-muted-foreground">
          {{ placeholder }}
        </span>
      </Transition>
    </div>
  </form>

  <JnTooltip v-else-if="enabled" :text="t('nav.SearchDocs')">
    <Button variant="ghost" size="icon" class="size-8 cursor-pointer" :aria-label="t('nav.SearchDocs')"
      :disabled="isDocsOpen" @click="openAssistant">
      <Sparkle />
    </Button>
  </JnTooltip>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { trackEvent } from '@/utils/analytics';
import { useDocsAssistant, isDocsConfigured } from '@/composables/use-docs-assistant';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { Sparkle } from '@lucide/vue';

const ROTATE_MS = 4000;

const { t } = useI18n();
const store = useMainStore();
const isMobile = computed(() => store.isMobile);

// Needs a docs site to answer from: configured at build time, and only on the
// canonical deployment — same gate as the original-site-only advanced tools.
const enabled = computed(() => isDocsConfigured && store.configs?.originalSite === true);

// While the assistant panel is open it owns the conversation, so this entry
// point goes inert — otherwise there are two places to type. State comes from
// DocsAssistant.vue, which reads it off the live panel (the embed fires no
// open/close events).
const { askDocs, docsQuestions, isOpen: isDocsOpen } = useDocsAssistant();

const query = ref('');
const isFocused = ref(false);

// The placeholder freezes once the box has focus or any text — the visible
// question is the one Enter sends, so it must not change underfoot. Locale
// switches re-resolve through docsQuestions().
const placeholderIndex = ref(0);
const placeholder = computed(() => {
  const questions = docsQuestions();
  return questions[placeholderIndex.value % questions.length] || t('nav.SearchDocs');
});

let rotateTimer = null;
onMounted(() => {
  rotateTimer = setInterval(() => {
    if (!query.value && !isFocused.value && !isDocsOpen.value) placeholderIndex.value += 1;
  }, ROTATE_MS);
});
onBeforeUnmount(() => {
  if (rotateTimer) clearInterval(rotateTimer);
});

// Enter on an empty box asks whatever question is currently on show, so the
// rotating placeholder doubles as a one-keystroke suggestion.
const submitDocsSearch = () => {
  if (isDocsOpen.value) return;
  const typed = query.value.trim();
  const question = typed || placeholder.value;
  if (!question) return;
  trackEvent('Nav', 'DocsSearch', typed ? 'submit' : 'placeholder');
  askDocs(question);
  query.value = '';
};

const openAssistant = () => {
  trackEvent('Nav', 'DocsSearch', 'open');
  askDocs('');
};
</script>
