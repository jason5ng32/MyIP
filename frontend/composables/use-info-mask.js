// 信息遮罩（Info Mask）逻辑：3 级切换（不遮罩 / 遮罩 IP / 遮罩 IP + 地理信息）
//
// 输入：
//   - refs: { IPCheckRef, webRTCRef, dnsLeaksRef } — 各结果卡片组件 ref
//   - store: 主 store（用于 setAlert / allHasLoaded 监听）
//   - t: i18n 翻译函数
//
// 输出：
//   - infoMaskLevel: ref<0|1|2>
//   - toggleInfoMask(): () => void
//   - showMaskButton: ref<boolean> — 在 allHasLoaded 后变 true
//   - isInfosLoaded: ref<boolean> — 同步自 store.allHasLoaded，供 shortcut 判断

import { ref, watch } from 'vue';
import { trackEvent } from '@/utils/use-analytics';
import { maskedInfo } from '@/utils/masked-info.js';

export function useInfoMask({ refs, store, t }) {
    const infoMaskLevel = ref(0);
    const isInfosLoaded = ref(false);
    const showMaskButton = ref(false);
    const originipDataCards = ref([]);
    const originleakTest = ref([]);
    const originstunServers = ref([]);

    const applyMask = () => {
        const { IPCheckRef, webRTCRef, dnsLeaksRef } = refs;
        if (infoMaskLevel.value === 0) {
            IPCheckRef.value.ipDataCards.forEach((card) => {
                if (card.id === 'cloudflare_v6' || card.id === 'ipify_v6') {
                    card.ip = maskedInfo(t).ipv6;
                } else {
                    card.ip = maskedInfo(t).ipv4;
                }
            });
            webRTCRef.value.stunServers.forEach((server) => {
                server.ip = maskedInfo(t).webrtcip;
            });
            dnsLeaksRef.value.leakTest.forEach((server) => {
                server.ip = maskedInfo(t).dnsendpoints;
            });
            infoMaskLevel.value = 1;
        } else if (infoMaskLevel.value === 1) {
            IPCheckRef.value.ipDataCards.forEach((card) => {
                Object.assign(card, maskedInfo(t));
            });
            dnsLeaksRef.value.leakTest.forEach((server) => {
                server.geo = maskedInfo(t).country_name;
            });
            infoMaskLevel.value = 2;
        }
    };

    const removeMask = () => {
        const { IPCheckRef, webRTCRef, dnsLeaksRef } = refs;
        const newIpDataCards = JSON.parse(JSON.stringify(originipDataCards.value));
        IPCheckRef.value.ipDataCards.splice(0, IPCheckRef.value.ipDataCards.length, ...newIpDataCards);

        const newStunServers = JSON.parse(JSON.stringify(originstunServers.value));
        webRTCRef.value.stunServers.splice(0, webRTCRef.value.stunServers.length, ...newStunServers);

        const newLeakTests = JSON.parse(JSON.stringify(originleakTest.value));
        dnsLeaksRef.value.leakTest.splice(0, dnsLeaksRef.value.leakTest.length, ...newLeakTests);

        infoMaskLevel.value = 0;
    };

    const toggleInfoMask = () => {
        const { IPCheckRef, webRTCRef, dnsLeaksRef } = refs;
        trackEvent('SideButtons', 'ToggleClick', 'InfoMask');
        let style;
        let title;
        let message;
        if (infoMaskLevel.value === 0) {
            originipDataCards.value = JSON.parse(JSON.stringify(IPCheckRef.value.ipDataCards));
            originstunServers.value = JSON.parse(JSON.stringify(webRTCRef.value.stunServers));
            originleakTest.value = JSON.parse(JSON.stringify(dnsLeaksRef.value.leakTest));
            applyMask();
            style = 'text-warning';
            message = t('alert.maskedInfoMessage_1');
            title = t('alert.maskedInfoTitle_1');
        } else if (infoMaskLevel.value === 1) {
            applyMask();
            style = 'text-success';
            message = t('alert.maskedInfoMessage');
            title = t('alert.maskedInfoTitle');
        } else {
            removeMask();
            style = 'text-danger';
            message = t('alert.unmaskedInfoMessage');
            title = t('alert.unmaskedInfoTitle');
        }
        store.setAlert(true, style, message, title);
    };

    watch(
        () => store.allHasLoaded,
        (val) => {
            isInfosLoaded.value = val;
            showMaskButton.value = true;
        },
    );

    return {
        infoMaskLevel,
        isInfosLoaded,
        showMaskButton,
        toggleInfoMask,
    };
}
