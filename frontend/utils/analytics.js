// Google Analytics 4 wrapper. Events recorded during boot buffer in memory
// until `startAnalytics()` runs after the app's first render, so `gtag.js`
// never competes for bandwidth or main-thread time on the initial paint path.

export const createAnalytics = ({
    measurementId = '',
    isDev = false,
} = {}) => {
    const enabled = Boolean(measurementId);
    let started = false;
    let scriptInjected = false;
    const eventQueue = [];

    const flushQueue = () => {
        if (typeof window === 'undefined' || !window.gtag) return;
        eventQueue.forEach((args) => window.gtag(...args));
        eventQueue.length = 0;
    };

    const initialiseGtag = () => {
        if (typeof window === 'undefined') return;
        if (window.gtag) {
            flushQueue();
            return;
        }

        window.dataLayer = window.dataLayer || [];
        // gtag.js inspects `Arguments` objects in dataLayer, not plain arrays.
        function gtag() { window.dataLayer.push(arguments); }
        window.gtag = gtag;

        gtag('js', new Date());
        // debug_mode surfaces events in GA's DebugView — keep it to Vite dev.
        gtag('config', measurementId, { debug_mode: isDev });

        flushQueue();
    };

    const injectGAScript = () => {
        if (scriptInjected || !enabled || typeof window === 'undefined') return;
        scriptInjected = true;

        // Reuse an existing gtag script tag (e.g. GTM) if already present.
        if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
            initialiseGtag();
            return;
        }

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

        script.onload = initialiseGtag;
        script.onerror = () => {
            console.warn('[GA] Failed to load gtag.js');
            scriptInjected = false; // allow subsequent events to retry
        };

        document.head.appendChild(script);
    };

    const startAnalytics = () => {
        started = true;
        injectGAScript();
    };

    const pushEvent = (...args) => {
        if (!enabled || typeof window === 'undefined') return;
        if (started && !scriptInjected) injectGAScript();

        if (window.gtag) {
            window.gtag(...args);
        } else {
            eventQueue.push(args);
        }
    };

    const client = {
        track(action, properties = {}) {
            pushEvent('event', action, {
                event_category: properties.category ?? 'general',
                event_label: properties.label ?? '',
                ...properties,
            });
        },

        page(url) {
            pushEvent('config', measurementId, { page_path: url });
        },

        identify(userId, traits = {}) {
            pushEvent('config', measurementId, { user_id: userId, ...traits });
        },

        // GA4 user-scoped properties that persist across the session's events.
        setUserProperties(props = {}) {
            pushEvent('set', 'user_properties', props);
        },
    };

    const track = (category, action, label) => {
        client.track(action, { category, label });
    };

    return {
        isAnalyticsEnabled: enabled,
        analytics: client,
        trackEvent: track,
        startAnalytics,
    };
};

// `import.meta.env` only exists under Vite; optional chaining keeps Node test
// imports safe at module evaluation time.
const defaultInstance = createAnalytics({
    measurementId: import.meta.env?.VITE_GOOGLE_ANALYTICS_ID || '',
    isDev: import.meta.env?.DEV === true,
});

// True only when a GA measurement id is configured. The privacy page reads this
// so self-hosted deployments without GA don't show an inaccurate analytics notice.
export const isAnalyticsEnabled = defaultInstance.isAnalyticsEnabled;
export const analytics = defaultInstance.analytics;
export const trackEvent = defaultInstance.trackEvent;
export const startAnalytics = defaultInstance.startAnalytics;
