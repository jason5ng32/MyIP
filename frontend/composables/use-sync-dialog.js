// The one-time sync dialog: when it opens (shouldShowSyncDialog, utils/features/sync-settings.js) and how it is left —
// every exit saves a choice to the account: Save the chosen collections, anything else none.
import { computed, ref, watch, onScopeDispose } from 'vue';
import { isOverlayOpen as defaultOverlayOpen } from '../utils/shortcut.js';
import { trackEvent } from '../utils/analytics.js';
import { shouldShowSyncDialog, chosenCollections } from '../utils/features/sync-settings.js';
import { saveSyncCollections } from '../utils/features/account-sync-auth.js';

// Another overlay on screen: looked at again after this long.
export const SYNC_DIALOG_RETRY_MS = 2000;

export const useSyncDialog = ({
    store, route, isOverlayOpen = defaultOverlayOpen, save = saveSyncCollections, track = trackEvent,
    retryMs = SYNC_DIALOG_RETRY_MS,
}) => {
    const open = ref(false);
    let shown = false;
    let left = false;
    let timer = null;
    const offHome = computed(() => route.matched.length > 0 && route.name !== 'home');

    const wanted = (overlayOpen) => shouldShowSyncDialog({
        available: store.accountSyncAvailable,
        userId: (store.isSignedIn && store.user?.uid) || null,
        settings: store.syncSettings,
        allHasLoaded: store.allHasLoaded,
        offHome: offHome.value,
        overlayOpen,
        authPending: store.authPending,
        shown,
    });

    const tryOpen = () => {
        clearTimeout(timer);
        timer = null;
        if (wanted(Boolean(store.openSheet) || isOverlayOpen())) {
            shown = true;
            open.value = true;
            track('Sync', 'SyncDialog', 'Show');
        } else if (wanted(false)) {
            timer = setTimeout(tryOpen, retryMs); // only another overlay is in the way
        }
    };

    watch(() => [
        store.syncSettings, store.isSignedIn, store.accountSyncAvailable, store.allHasLoaded, offHome.value,
        store.openSheet, store.authPending,
    ], tryOpen, { immediate: true });

    // Once per dialog: a failed save leaves the account undecided, so a later page load asks again.
    const leave = (collections, label) => {
        if (left) return Promise.resolve(false);
        left = true;
        open.value = false;
        track('Sync', 'SyncDialog', label);
        return save(collections);
    };

    onScopeDispose(() => clearTimeout(timer));

    return {
        open,
        saveChoice: (choice) => leave(chosenCollections(choice), 'Save'),
        dismiss: () => leave([], 'Dismiss'),
    };
};
