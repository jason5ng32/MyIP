// 刷新 / 初次加载的时序编排
//
// 输入：
//   - refs: { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef }
//   - store: 主 store
//   - t: i18n 翻译函数
//   - userPreferences: computed(() => store.userPreferences)
//   - infoMaskLevel: ref<number> — 刷新时会被重置为 0
//
// 输出：
//   - loadingControl(): 初次加载的时序启动（等各卡片 mounted 后发起首次检测）
//
// 内部：
//   - 监听 store.shouldRefreshEveryThing，触发刷新 → 重置 loadingStatus → 错峰执行各组件 refresh → Alert → 还原 flag

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
