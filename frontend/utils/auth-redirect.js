// Redirect sign-in: when it replaces the popup, and the pending marker boot
// uses to finish it. The installed PWA has no popup with a usable `opener`, so
// it always redirects; a browser tab falls back to it only when the popup
// can't open. The marker is set right before signInWithRedirect leaves the
// page and consumed at boot, so only a return from the provider pays for
// loading Firebase and calling getRedirectResult. sessionStorage-scoped — the
// redirect comes back into the same tab / PWA webview. Value = provider key
// ('google' / 'github'), for the error copy.
const PENDING_REDIRECT_KEY = 'pendingRedirectSignIn';

// Popup rejections meaning "no popups here", not the visitor closing one.
const REDIRECT_FALLBACK_CODES = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
]);

export const shouldFallBackToRedirect = (errorCode) => REDIRECT_FALLBACK_CODES.has(errorCode);

const defaultStorage = () => {
    try {
        return globalThis.sessionStorage ?? null;
    } catch {
        return null; // access itself throws when storage is blocked
    }
};

export const markPendingRedirectSignIn = (providerKey, storage = defaultStorage()) => {
    try {
        storage.setItem(PENDING_REDIRECT_KEY, String(providerKey));
    } catch {
        /* storage disabled — the return lands as a normal boot */
    }
};

// Read only: boot uses it to pick the auth path without consuming it.
export const hasPendingRedirectSignIn = (storage = defaultStorage()) => {
    try {
        return !!storage.getItem(PENDING_REDIRECT_KEY);
    } catch {
        return false;
    }
};

// Reads and clears, so a reload after the return doesn't replay it.
export const takePendingRedirectSignIn = (storage = defaultStorage()) => {
    try {
        const providerKey = storage.getItem(PENDING_REDIRECT_KEY);
        storage.removeItem(PENDING_REDIRECT_KEY);
        return providerKey ? { providerKey } : null;
    } catch {
        return null;
    }
};
