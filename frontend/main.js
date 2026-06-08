import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { useMainStore } from './store';
import App from './App.vue'
import i18n from './locales/i18n';
import router from './router';
import { analytics } from './utils/analytics';
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

// The flag icon JSON is hundreds of KB — keep it dynamic so it doesn't bloat
// the first-paint bundle. `@iconify/vue` itself is statically imported (above)
// because a dozen components already pull it in synchronously, so wrapping
// addCollection in another dynamic() would just be a no-op Promise tick.
import('@iconify-json/circle-flags/icons.json').then(({ default: flags }) => {
    addCollection(flags);
});

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
const store = useMainStore(pinia); 

app.use(i18n);
app.use(router);

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

// Start Google Analytics
analytics.page();
unregisterLegacyServiceWorker();

// Check Firebase environment
store.checkFirebaseEnv();

// Fetch backend configs and user preferences
Promise.all([
    store.isFireBaseSet ? store.initializeAuthListener() : Promise.resolve(),
    store.loadPreferences(), // Load user preferences
    store.fetchConfigs()      // Fetch backend configs
]).then(() => {
    app.mount('#app');
}).catch(error => {
    console.error("Failed to initialize the app properly:", error);
    app.mount('#app'); // Even if there is an error during initialization, continue to mount the application
});
