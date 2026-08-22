// PWA display-mode detection.
//
// "standalone" is overloaded in this codebase: `/tools/:slug` are the app's
// "standalone tool pages", while the web platform separately calls an installed
// PWA's chromeless window "standalone" (CSS `display-mode: standalone`, plus
// iOS Safari's legacy `navigator.standalone`). To avoid that clash, the PWA
// concept lives here under an explicit name — callers use `isRunningAsPwa()` and
// a local `isPwa`, never a bare `isStandalone` (which means the tool page).
//
// Not reactive: the display mode is fixed for a session, so callers read it once
// into a const.
export function isRunningAsPwa() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

// Proactive install-prompt eligibility, checked by App.vue BEFORE mounting
// the PWA widget — ineligible visits never load pwa-install or its manifest
// fetch. Counts this visit as a side effect, deduped by a 12h window: opens
// within 12h of the last counted one belong to the same "use", so the count
// means returning sessions, not reloads. The prompt skips the first use and
// may show on the 2nd and 3rd (`popups < visits - 1` blocks a same-window
// re-prompt, which also spaces the two shows ≥12h apart); capped at 2 shows
// ever (PWA.vue bumps pwaPopupCount when the dialog actually opens).
const USE_WINDOW_MS = 12 * 60 * 60 * 1000;

export const shouldOfferPwaInstall = () => {
    try {
        let visits = parseInt(localStorage.getItem('pwaVisitCount') || '0', 10);
        const lastVisitAt = parseInt(localStorage.getItem('pwaLastVisitAt') || '0', 10);
        const now = Date.now();
        if (visits === 0 || now - lastVisitAt >= USE_WINDOW_MS) {
            visits += 1;
            localStorage.setItem('pwaVisitCount', visits);
            localStorage.setItem('pwaLastVisitAt', now);
        }
        const popups = parseInt(localStorage.getItem('pwaPopupCount') || '0', 10);
        return !isRunningAsPwa() && popups < 2 && visits >= popups + 2;
    } catch {
        return false; // storage disabled — never prompt
    }
};

// Deduped use count for the install-prompt copy ("your {count}th visit").
export const getPwaVisitCount = () => {
    try {
        return parseInt(localStorage.getItem('pwaVisitCount') || '0', 10);
    } catch {
        return 0;
    }
};
