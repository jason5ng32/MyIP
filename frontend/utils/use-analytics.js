// Import Google Analytics configuration
// import.meta.env only exists in Vite; Node / test environment may not have it, use optional chaining to fallback
// Use optional chaining to fallback, avoid TypeError when evaluating at module top level
const MEASUREMENT_ID = import.meta.env?.VITE_GOOGLE_ANALYTICS_ID || '';

// Global state
let scriptInjected = false;
let eventQueue = [];

// Inject gtag.js
function injectGAScript() {
    if (scriptInjected || !MEASUREMENT_ID || typeof window === 'undefined') return;
    scriptInjected = true;

    // If the page already has a gtag script (e.g. GTM), initialize directly
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
        initialiseGtag();
        return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;

    script.onload = initialiseGtag;
    script.onerror = () => {
        console.warn('[GA] Failed to load gtag.js');
        scriptInjected = false;               // Allow subsequent retries
    };

    document.head.appendChild(script);
}

// Initialize gtag & flush queue
function initialiseGtag() {
    if (window.gtag) { flushQueue(); return; }

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);

    flushQueue();
}

function flushQueue() {
    if (!window.gtag) return;
    eventQueue.forEach(args => window.gtag(...args));
    eventQueue.length = 0;                    // Clear queue
}

// Internal helper: push or queue
function pushEvent(...args) {
    if (typeof window === 'undefined') return; // SSR safe
    if (!scriptInjected) injectGAScript();     // Lazy load script

    if (window.gtag) {
        window.gtag(...args);
    } else {
        eventQueue.push(args);
    }
}

// Public API
const analytics = {
    /** analytics.track(action, { category, label, ... }) */
    track(action, properties = {}) {
        pushEvent('event', action, {
            event_category: properties.category ?? 'general',
            event_label: properties.label ?? '',
            ...properties
        });
    },

    /** analytics.page(url) */
    page(url) {
        pushEvent('config', MEASUREMENT_ID, { page_path: url });
    },

    /** analytics.identify(userId, traits) */
    identify(userId, traits = {}) {
        pushEvent('config', MEASUREMENT_ID, { user_id: userId, ...traits });
    }
};

// Compatible with MyIP old version helper
function trackEvent(category, action, label) {
    analytics.track(action, { category, label });
}

// First screen initialization
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectGAScript);
    } else {
        injectGAScript();
    }
}

export { analytics, trackEvent };
