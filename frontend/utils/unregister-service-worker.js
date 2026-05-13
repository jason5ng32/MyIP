// One-shot cleanup for the legacy Serwist service worker.
// Existing prod clients still have it registered and a ~5 MB precache cached,
// so first visit after this deploy unregisters the worker and drops every
// cache it ever owned. Safe to delete this file (and its main.js call) after
// a few release cycles, once stale clients have rotated.

export function unregisterLegacyServiceWorker() {
    if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});

    if (typeof caches !== 'undefined') {
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch(() => {});
    }
}
