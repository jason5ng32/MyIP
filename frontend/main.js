import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { useMainStore } from './store';
import App from './App.vue'
import i18n, { loadActiveLocaleMessages } from './locales/i18n';
import router from './router';
import { analytics } from './utils/analytics';
import { getTimezoneInfo } from './utils/time-utils';
import { isRunningAsPwa } from './utils/pwa';
import { readAuthHint } from './utils/auth-hint';
import { unregisterLegacyServiceWorker } from './utils/unregister-service-worker';
import { addCollection } from '@iconify/vue';

import { detectOS } from './utils/system-detect';
import './style/style.css'

// vConsole — mobile on-screen devtools. Dev-only AND mobile-only.
// Sets `window.__vConsoleActive` so `frontend/utils/shortcut.js` can disable
// global keyboard shortcuts while vConsole is around — typing in its filter
// input would otherwise still trigger app-wide hotkeys (vConsole renders
// inside its own Shadow DOM, so the listener's `target.tagName === 'INPUT'`
// guard doesn't catch those keystrokes).
if (import.meta.env.DEV) {
    const dbgOS = detectOS();
    if (dbgOS.isAndroid || dbgOS.isIOS) {
        import('vconsole').then(({ default: VConsole }) => {
            new VConsole();
            window.__vConsoleActive = true;
            // Pin the floating switch to bottom-left.
            const styleEl = document.createElement('style');
            styleEl.textContent =
                '#__vconsole .vc-switch { left: 8px !important; right: auto !important; bottom: 36px !important; }';
            document.head.appendChild(styleEl);
        });
    }
}

// Stale-deploy self-heal. After a deploy, pages loaded before it lazy-import
// hashed assets that no longer exist; Vite surfaces every such failure
// (module or CSS) as `vite:preloadError`. Reload once to pick up the fresh
// index.html. The timestamp latch (per-tab) stops a reload loop when the
// real cause is elsewhere (offline, blocked CDN): within the window the
// event just propagates as before. Registered at module eval so it's in
// place before any lazy import can fail.
window.addEventListener('vite:preloadError', (event) => {
    const LATCH_KEY = 'preloadReloadAt';
    const lastReload = Number(sessionStorage.getItem(LATCH_KEY) || 0);
    if (Date.now() - lastReload < 60 * 1000) return;
    sessionStorage.setItem(LATCH_KEY, String(Date.now()));
    event.preventDefault();
    window.location.reload();
});

// The flag icon JSON is hundreds of KB — loaded after mount (see the mount
// chain below) so it doesn't compete for boot bandwidth.
const loadFlagIcons = () => import('@iconify-json/circle-flags/icons.json')
    .then((mod) => { if (mod?.default) addCollection(mod.default); })
    .catch(() => { /* non-fatal: flag icons degrade gracefully */ });

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
const store = useMainStore(pinia); 

app.use(i18n);
app.use(router);

// Sentry — build-time env gate: without the DSN, or in a dev server run, the
// chunk neither ships nor loads (local runs would otherwise report every
// experiment against the production project). The SDK chunk stays OFF the
// boot critical path: it loads after mount (see the mount chain's finally
// below) so it never competes with the locale pack the first render waits
// on. Until init, a tiny buffer catches uncaught errors / rejections — and
// any of them triggers an immediate load, so a boot that never reaches mount
// still reports. Perf data survives the late init (buffered observers,
// backdated pageload span).
const earlyErrors = [];
let loadSentry = () => {};
if (import.meta.env.VITE_SENTRY_DSN_FRONTEND && !import.meta.env.DEV) {
    const onEarlyError = (event) => {
        earlyErrors.push(event);
        loadSentry();
    };
    window.addEventListener('error', onEarlyError);
    window.addEventListener('unhandledrejection', onEarlyError);
    let loading = null;
    loadSentry = () => {
        loading ??= import('./sentry-init')
            .then(({ initSentry }) => {
                initSentry(app, router, earlyErrors);
                window.removeEventListener('error', onEarlyError);
                window.removeEventListener('unhandledrejection', onEarlyError);
            })
            .catch(() => {});
    };
}

//
// Initialize a series of operations
//

// Set language when app starts
store.lang = i18n.global.locale;

// Detect operating system
const os = detectOS();

// Handle window size change
function handleResize() {
    store.setIsMobile(window.innerWidth < 768 || os.isAndroid || os.isIOS );
}
handleResize();

// Listen to window size change
window.addEventListener('resize', handleResize);

// Start Google Analytics. `app_mode` is a user-scoped custom dimension
// (register it in GA admin as a user property) that splits every report by
// how the app was opened: installed PWA window vs regular browser tab.
analytics.page();
const { timezone, offset } = getTimezoneInfo();
analytics.setUserProperties({
    ...(timezone || offset ? { timezone, tz_offset: offset } : {}),
    app_mode: isRunningAsPwa() ? 'pwa' : 'web',
});
unregisterLegacyServiceWorker();

// Check Firebase environment
store.checkFirebaseEnv();

// Backend configs load fire-and-forget: components read `store.configs`
// reactively, so the first render never waits on this round trip.
store.fetchConfigs();

// Gate the first render only on what it actually needs; the legs all run in
// parallel. Auth is hint-gated (utils/auth-hint.js): only a previously
// signed-in visitor loads Firebase and waits for it before first render, so
// the first authenticatedFetch round carries their token. Everyone else
// mounts without the SDK.
const authHint = readAuthHint();
Promise.all([
    store.isFireBaseSet && authHint === '1' ? store.initializeAuthListener() : Promise.resolve(),
    store.loadPreferences(),
    loadActiveLocaleMessages(),
]).then(() => {
    app.mount('#app');
}).catch(error => {
    earlyErrors.push(error); // reaches Sentry once it initializes below
    console.error("Failed to initialize the app properly:", error);
    app.mount('#app'); // Mount even if initialization partially failed
}).finally(() => {
    loadFlagIcons(); // deferred boot-bandwidth work, app is on screen now
    loadSentry();
    // Unknown hint (first visit since the flag shipped, or storage cleared):
    // probe auth once in the background so an already-signed-in user is
    // recognized and the next boot takes the exact path.
    if (store.isFireBaseSet && authHint === null) {
        // Probe failure means "treat as visitor" — never an error: an
        // uncaught rejection here would reach Sentry as a crash signal.
        setTimeout(() => {
            store.initializeAuthListener().catch((error) => {
                console.warn('Background auth probe failed, continuing as visitor:', error);
            });
        }, 3000);
    }
});
