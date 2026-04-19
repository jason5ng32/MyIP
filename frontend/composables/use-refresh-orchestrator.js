// Refresh / initial load sequence orchestration
//
// Input:
//   - refs: { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef }
//   - store: main store
//   - t: i18n translation function
//   - userPreferences: computed(() => store.userPreferences)
//   - infoMaskLevel: ref<number> — reset to 0 when refreshing
//
// Output:
//   - loadingControl(): initial load sequence starts (after all cards are mounted)
//
// Internal:
//   - monitor store.shouldRefreshEveryThing, trigger refresh → reset loadingStatus → schedule component refreshes → Alert → reset flag

import { watch } from 'vue';

function scheduleTimedTasks(tasks) {
    tasks.forEach((task) => {
        setTimeout(() => {
            task.action();
            if (task.after) task.after();
        }, task.delay);
    });
}

export function useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel }) {
    const refreshingAlert = () => {
        store.setAlert(
            true,
            'text-success',
            t('alert.refreshEverythingMessage'),
            t('alert.refreshEverythingTitle'),
        );
    };

    const refreshEverything = () => {
        store.setLoadingStatus('connectivity', false);
        store.setLoadingStatus('webrtc', false);
        store.setLoadingStatus('dnsleaktest', false);
        store.setLoadingStatus('ipcheck', false);

        const { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef } = refs;
        scheduleTimedTasks([
            { action: () => IPCheckRef.value.checkAllIPs(), delay: 0 },
            { action: () => connectivityRef.value.handelCheckStart(true), delay: 2000 },
            { action: () => webRTCRef.value.checkAllWebRTC(true), delay: 3000 },
            { action: () => dnsLeaksRef.value.checkAllDNSLeakTest(true), delay: 2500 },
            { action: () => refreshingAlert(), delay: 500 },
        ]);
        infoMaskLevel.value = 0;
        store.setRefreshEveryThing(false);
    };

    const loadingControl = (t1 = 0, t2 = 2000, t3 = 3000, t4 = 2500) => {
        const { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef } = refs;
        const mountedStatus = Object.values(store.mountingStatus).every(Boolean);
        if (mountedStatus) {
            setTimeout(() => IPCheckRef.value.checkAllIPs(), t1);
            if (userPreferences.value.autoStart) {
                setTimeout(() => connectivityRef.value.handelCheckStart(), t2);
                setTimeout(() => webRTCRef.value.checkAllWebRTC(false), t3);
                setTimeout(() => dnsLeaksRef.value.checkAllDNSLeakTest(false), t4);
            } else {
                store.setLoadingStatus('connectivity', true);
                store.setLoadingStatus('webrtc', true);
                store.setLoadingStatus('dnsleaktest', true);
            }
        } else {
            setTimeout(() => loadingControl(t1, t2, t3, t4), 1000);
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
