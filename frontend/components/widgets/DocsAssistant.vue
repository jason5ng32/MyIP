<template>
  <!-- Touch-only chrome for the GitBook Assistant panel (see
       composables/use-docs-assistant.js). The panel opens and closes through
       the embed's own launcher; what it lacks on phones is a way to dismiss
       by tapping outside, and a scroll lock — without one, swiping a chat too
       short to scroll drags the page underneath instead. Desktop keeps page
       scrolling, as with our other panels. Placement of the launcher and the
       panel lives in style.css next to the embed overrides. -->
  <Teleport to="body">
    <Transition enter-active-class="transition-opacity duration-200" enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200" leave-to-class="opacity-0">
      <div v-if="isOpen && isMobile" class="fixed inset-0 z-1090 bg-black/40" aria-hidden="true" @click="closeDocs">
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue';
import { useMainStore } from '@/store';
import { useDocsAssistant } from '@/composables/use-docs-assistant';

const PANEL_SELECTOR = '#gitbook-widget-window';
const SYNC_INTERVAL = 300;

const store = useMainStore();
const isMobile = computed(() => store.isMobile);

const { isOpen, isLoaded, closeDocs, setOpen } = useDocsAssistant();

// The embed fires no open/close callbacks and its launcher toggles the panel
// on its own, so read the panel element instead — both directions. Polling
// starts only once the embed has been loaded (first docs search of the
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
  syncTimer = setInterval(() => setOpen(panelIsVisible()), SYNC_INTERVAL);
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
