// Suspends the global keyboard shortcuts while an overlay is open.
//
// Called from the `ui/` overlay roots (Dialog / Sheet / Drawer) rather than
// from their callers, so every overlay built on them is covered without any
// per-component wiring — including ones no shortcut opens. Esc and the native
// scrolling keys still work: reka-ui / vaul and the browser own those.
//
// Sync flush on purpose: a keystroke arriving in the same tick as the open
// flip must already see the overlay.

import { getCurrentScope, onScopeDispose, watch } from 'vue';
import { openOverlay, closeOverlay } from '@/utils/shortcut.js';

export const useOverlayShortcuts = (isOpen) => {
    let counted = false;

    const sync = (open) => {
        const next = Boolean(open);
        if (next === counted) return;
        counted = next;
        (next ? openOverlay : closeOverlay)();
    };

    watch(isOpen, sync, { immediate: true, flush: 'sync' });

    // An overlay torn down while still open (its parent unmounting) never
    // flips `open` back to false — release the count here instead of leaking.
    if (getCurrentScope()) onScopeDispose(() => sync(false));
};
