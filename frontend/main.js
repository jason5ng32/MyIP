import { createApp } from 'vue'
import { createPinia } from 'pinia';
import { useMainStore } from './store';
import App from './App.vue'
import i18n from './locales/i18n';
import router from './router';
import { analytics } from './utils/use-analytics';
import { registerServiceWorker } from './utils/register-service-worker';

import { detectOS } from './utils/system-detect';
import './style/style.css'

// Dynamic import of circle-flags collection
import('@iconify-json/circle-flags/icons.json').then(({ default: flags }) => {
    import('@iconify/vue').then(({ addCollection }) => addCollection(flags));
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
registerServiceWorker();

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
