export function registerServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            await registration.update();
        } catch (error) {
            console.warn('Service worker registration failed:', error);
        }
    });
}
