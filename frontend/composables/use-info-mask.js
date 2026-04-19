// Info mask logic: 3 level switch (no mask / mask IP / mask IP + geographic information)
//
// Input:
//   - refs: { IPCheckRef, webRTCRef, dnsLeaksRef } — each result card component ref
//   - store: main store (for setAlert / allHasLoaded monitoring)
//   - t: i18n translation function
//
// Output:
//   - infoMaskLevel: ref<0|1|2>
//   - toggleInfoMask(): () => void
//   - showMaskButton: ref<boolean> — becomes true after allHasLoaded
//   - isInfosLoaded: ref<boolean> — synchronized from store.allHasLoaded, for shortcut judgment

import { ref, watch } from 'vue';
import { trackEvent } from '../utils/use-analytics.js';
import { maskedInfo } from '../utils/masked-info.js';

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
