// Pending-redirect sign-in marker: set right before signInWithRedirect leaves
// the page, consumed at boot so only a return from the provider pays for
// loading Firebase and calling getRedirectResult. sessionStorage-scoped — the
// redirect comes back into the same tab / PWA webview. Value = provider key
// ('google' / 'github'), for the error copy.
const PENDING_REDIRECT_KEY = 'pendingRedirectSignIn';

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
