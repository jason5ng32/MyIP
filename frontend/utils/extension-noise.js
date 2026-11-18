// Browser-extension noise filters for sentry-init.js: extension script URL
// patterns (for `denyUrls`) and the unhandled-rejection-through-an-extension check.

export const EXTENSION_URL_PATTERNS = [
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
    /^ms-browser-extension:\/\//i,
    // Safari masks extension script URLs with this scheme
    /^webkit-masked-url:\/\//i,
];

const REJECTION_MECHANISM = 'auto.browser.global_handlers.onunhandledrejection';

const isExtensionUrl = (url) =>
    typeof url === 'string' && EXTENSION_URL_PATTERNS.some((re) => re.test(url));

// An unhandled rejection with an extension frame anywhere in its stack:
// the extension's own promise chain (e.g. a wrapped fetch) rejected.
export const isExtensionRejection = (event) => {
    const values = event?.exception?.values;
    if (!Array.isArray(values)) return false;
    const isRejection = values.some((value) => value?.mechanism?.type === REJECTION_MECHANISM);
    if (!isRejection) return false;
    return values.some((value) => {
        const frames = value?.stacktrace?.frames;
        return Array.isArray(frames) && frames.some((frame) => isExtensionUrl(frame?.filename));
    });
};
