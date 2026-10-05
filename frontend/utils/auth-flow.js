// Sign-in flow choice: popup or full-page redirect.
// An installed PWA (iOS standalone above all) has no popup with a usable
// `opener`, so the provider's result could never be posted back — it signs
// in by redirect instead, consumed at boot via utils/auth-redirect.js. A
// browser tab keeps the popup and falls back to the redirect only when the
// popup itself can't open.

// Popup rejections that mean "this environment can't do popups", as opposed
// to the visitor closing or superseding one.
const REDIRECT_FALLBACK_CODES = new Set([
    'auth/popup-blocked',
    'auth/operation-not-supported-in-this-environment',
]);

export const resolveSignInFlow = ({ runningAsPwa }) => (runningAsPwa ? 'redirect' : 'popup');

export const shouldFallBackToRedirect = (errorCode) => REDIRECT_FALLBACK_CODES.has(errorCode);
