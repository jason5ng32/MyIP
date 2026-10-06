// Suspends the global keyboard shortcuts while an overlay is open.
//
// Called from the `ui/` overlay roots (Dialog / Sheet / Drawer) rather than
// from their callers, so every overlay built on them is covered without any
// per-component wiring — including ones no shortcut opens. Esc and the native
// scrolling keys still work: reka-ui / vaul and the browser own those.
//
// Sync flush on purpose: a keystroke arriving in the same tick as the open
// flip must already see the overlay.
//
// An overlay on a kept-alive page counts only while that page is on screen, and
// is closed when the page is left: its <body> portal would outlive it.

import { getCurrentInstance, getCurrentScope, onDeactivated, onScopeDispose, toValue, watch } from 'vue';
import { openOverlay, closeOverlay } from '@/utils/shortcut.js';
import { useRouteActive } from './use-route-active.js';

export const useOverlayShortcuts = (isOpen) => {
    let counted = false;

    const sync = (open) => {
        const next = Boolean(open);
        if (next === counted) return;
        counted = next;
        (next ? openOverlay : closeOverlay)();
    };

    const active = useRouteActive();
    watch(() => active.value && toValue(isOpen), sync, { immediate: true, flush: 'sync' });

    // The root declares `update:open`, so its v-model / handler closes it.
    const instance = getCurrentInstance();
    if (instance) {
        onDeactivated(() => {
            if (toValue(isOpen)) instance.emit('update:open', false);
        });
    }

    // An overlay torn down while still open (its parent unmounting) never
    // flips `open` back to false — release the count here instead of leaking.
    if (getCurrentScope()) onScopeDispose(() => sync(false));
};
