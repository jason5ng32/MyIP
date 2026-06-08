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
