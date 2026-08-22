// Refresh / initial load sequence orchestration
//
// Input:
//   - store: main store
//   - t: i18n translation function
//   - userPreferences: computed(() => store.userPreferences)
//   - infoMaskLevel: ref<number> — reset to 0 when refreshing
//
// Output:
//   - loadingControl(): initial load sequence starts (after all cards are mounted)
//
// Internal:
//   - monitor store.shouldRefreshEveryThing, trigger refresh → reset loadingStatus → dispatch section commands → Alert → reset flag
//
// Sections are driven through the command bus (utils/app-commands.js): the
// owner components register ipinfo:refresh / connectivity:run / webrtc:run /
// dnsleak:run at setup, before loadingControl's mounted gate opens. Dispatches
// here are fire-and-forget — completion is reported on the event bus.

import { watch } from 'vue';
import { dispatchAppCommand } from '../utils/app-commands.js';

const runCommand = (name, payload) => {
    dispatchAppCommand(name, payload).catch((error) => {
        console.warn(`[refresh-orchestrator] ${name} failed:`, error);
    });
};

function scheduleTimedTasks(tasks) {
    tasks.forEach((task) => {
        setTimeout(() => {
            task.action();
            if (task.after) task.after();
        }, task.delay);
    });
}

export function useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel }) {
    const refreshingAlert = () => {
        store.setAlert(
            true,
            'text-success',
            t('alert.refreshEverythingMessage'),
            t('alert.refreshEverythingTitle'),
        );
    };

    const refreshEverything = () => {
        store.setLoadingStatus('Connectivity', false);
        store.setLoadingStatus('WebRTC', false);
        store.setLoadingStatus('DNSLeakTest', false);
        store.setLoadingStatus('IPInfo', false);

        scheduleTimedTasks([
            { action: () => runCommand('ipinfo:refresh'), delay: 0 },
            { action: () => runCommand('connectivity:run', { trigger: 'refresh' }), delay: 300 },
            { action: () => runCommand('webrtc:run', { isRefresh: true }), delay: 200 },
            { action: () => runCommand('dnsleak:run', { isRefresh: true }), delay: 100 },
            { action: () => refreshingAlert(), delay: 300 },
        ]);
        infoMaskLevel.value = 0;
        store.setRefreshEveryThing(false);
    };

    const loadingControl = (t1 = 0, t2 = 300, t3 = 200, t4 = 100) => {
        const mountedStatus = Object.values(store.mountingStatus).every(Boolean);
        if (mountedStatus) {
            const prefs = userPreferences.value;
            // IP info always runs on load — it has no per-module switch by design.
            setTimeout(() => runCommand('ipinfo:refresh'), t1);
            // Each remaining module runs only if its switch is on; when off we
            // flag it loaded immediately so allHasLoaded still resolves — it gates
            // the info-mask button, the user-info fetch, and the brand shimmer.
            if (prefs.autoRunConnectivity) {
                setTimeout(() => runCommand('connectivity:run', { trigger: 'boot' }), t2);
            } else {
                store.setLoadingStatus('Connectivity', true);
            }
            if (prefs.autoRunWebRTC) {
                setTimeout(() => runCommand('webrtc:run'), t3);
            } else {
                store.setLoadingStatus('WebRTC', true);
            }
            if (prefs.autoRunDnsLeak) {
                setTimeout(() => runCommand('dnsleak:run'), t4);
            } else {
                store.setLoadingStatus('DNSLeakTest', true);
            }
        } else {
            setTimeout(() => loadingControl(t1, t2, t3, t4), 100);
        }
    };

    watch(
        () => store.shouldRefreshEveryThing,
        (newVal) => {
            if (newVal) refreshEverything();
        },
    );

    return { loadingControl };
}
