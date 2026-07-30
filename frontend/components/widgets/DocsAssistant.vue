<template>
  <!-- Our own chrome for the GitBook Assistant panel (see
       composables/use-docs-assistant.js). The embed's stock launcher is hidden
       in style.css and replaced by the toggle below, so the control matches
       the FAB dock's buttons instead of GitBook's own pill — and mirrors it
       across the page, on the same baseline and the same inset from the
       1600px content area.
       On touch screens the panel also gets a tap-outside backdrop and a body
       scroll lock: without one, swiping a chat too short to scroll drags the
       page underneath. Desktop keeps page scrolling, as with our other panels. -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="isOpen && isMobile" class="fixed inset-0 z-1090 bg-black/40" aria-hidden="true" @click="closeDocs">
      </div>
    </Transition>

    <!-- Mirror of FloatingDock: same bottom-9 baseline, same 18px gutter off
         the content area, so the two sides stay symmetric on wide screens.
         No enter/leave transition — the toggle swaps state often enough that
         animating it just reads as a flicker. -->
    <div v-if="isLoaded && isSignedIn" class="fixed bottom-9 z-1100" :style="{ left: DOCK_INSET }">
      <JnTooltip :text="isOpen ? t('about.Close') : t('nav.AskCopilot')" side="right">
        <Button size="icon" type="button" :variant="isOpen ? 'secondary' : 'outline'"
          :aria-label="isOpen ? t('about.Close') : t('nav.AskCopilot')" :aria-expanded="isOpen"
          class="rounded-full shadow-lg cursor-pointer" @click="toggleDocs">
          <component :is="isOpen ? X : Sparkle" class="size-4" />
        </Button>
      </JnTooltip>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMainStore } from '@/store';
import { useDocsAssistant, isSettling } from '@/composables/use-docs-assistant';
import { Button } from '@/components/ui/button';
import { JnTooltip } from '@/components/ui/tooltip';
import { Sparkle, X } from '@lucide/vue';

const PANEL_SELECTOR = '#gitbook-widget-window';
const SYNC_INTERVAL = 300;
// FloatingDock hugs the 1600px content area with an 18px gutter; past that
// width it steps inward by half the overflow. max() keeps it at 18px below.
const DOCK_INSET = 'max(18px, calc((100vw - 1600px) / 2 + 18px))';

const { t } = useI18n();
const store = useMainStore();
const isMobile = computed(() => store.isMobile);
// The assistant is a sign-in benefit (see DocsSearch.vue) — signing out mid
// session takes the toggle away with the rest of the entry points.
const isSignedIn = computed(() => store.isSignedIn === true);

const { isOpen, isLoaded, askDocs, closeDocs, setOpen } = useDocsAssistant();

const toggleDocs = () => (isOpen.value ? closeDocs() : askDocs(''));

// The embed fires no open/close callbacks, so read the panel element instead.
// Polling starts once the embed has been loaded (first docs search of the
// session) and stops on unmount.
let syncTimer = null;

const panelIsVisible = () => {
  const panel = document.querySelector(PANEL_SELECTOR);
  if (!panel) return false;
  const rect = panel.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(panel).visibility !== 'hidden';
};

const startSync = () => {
  if (syncTimer) return;
  syncTimer = setInterval(() => {
    // Our own open/close already set the state; skip while the panel is still
    // animating into it, or the stale measurement flips the toggle back.
    if (isSettling()) return;
    setOpen(panelIsVisible());
  }, SYNC_INTERVAL);
};

const stopSync = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

// Mobile-only body scroll lock.
const lockScroll = (locked) => {
  document.body.style.overflow = locked ? 'hidden' : '';
  document.body.style.overscrollBehavior = locked ? 'none' : '';
};

watch(isLoaded, (loaded) => {
  if (loaded) startSync();
}, { immediate: true });

watch([isOpen, isMobile], ([open, mobile]) => {
  lockScroll(open && mobile);
}, { immediate: true });

// Signing out mid-conversation closes the panel too — otherwise it would sit
// there with no visible way back to it.
watch(isSignedIn, (signedIn) => {
  if (!signedIn && isOpen.value) closeDocs();
});

const onKeydown = (event) => {
  if (event.key === 'Escape' && isOpen.value) closeDocs();
};
window.addEventListener('keydown', onKeydown);

onBeforeUnmount(() => {
  lockScroll(false);
  stopSync();
  window.removeEventListener('keydown', onKeydown);
});
</script>
