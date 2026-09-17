// Info mask logic: 2-state switch (no mask / mask IP).
//
// The actual masking is purely CSS-driven (see `style/style.css`): we mirror the level
// to a `data-mask-level` attribute on <html>, and components mark their IP cells with
// `data-mask="ip"`. A blur filter then renders those values unreadable in screenshots
// — without mutating any underlying value, so refresh / data flows are unaffected.
//
// Input:
//   - store: main store (for setAlert / allHasLoaded monitoring)
//   - t: i18n translation function
//
// Output:
//   - infoMaskLevel: ref<0|1>
//   - toggleInfoMask(): () => void
//   - showMaskButton: ref<boolean> — becomes true after allHasLoaded
//   - isInfosLoaded: ref<boolean> — synchronized from store.allHasLoaded, for shortcut judgment

import { ref, watch } from 'vue';
import { trackEvent } from '../utils/analytics.js';

const MASK_ATTR = 'data-mask-level';

// Localized placeholder strings shown in an IP slot that are never sensitive —
// "detecting…" / "error" states. The blur should skip these: masking them just
// hides a status word and looks broken in a shared screenshot.
const NON_SENSITIVE_KEYS = [
    'webrtc.StatusWait', 'webrtc.StatusTesting', 'webrtc.StatusError', 'webrtc.StatusUnavailable',
    'dnsleaktest.StatusWait', 'dnsleaktest.StatusTesting', 'dnsleaktest.StatusError',
    'ipInfos.IPv4Error', 'ipInfos.IPv6Error',
];

// Build a `:data-mask` gate. Pass the component's i18n `t`; the returned fn maps
// a displayed value to the attribute: 'ip' to blur a real address, or undefined
// to leave waiting/error placeholders readable. Locale is fixed per page load
// (switching language re-boots the app), so the placeholder set is built once.
export function createMaskGate(t) {
    const placeholders = new Set(NON_SENSITIVE_KEYS.map((key) => t(key)));
    return (value) => (placeholders.has(value) ? undefined : 'ip');
}

const syncMaskAttribute = (level) => {
    if (typeof document === 'undefined') return;
    if (level === 0) {
        document.documentElement.removeAttribute(MASK_ATTR);
    } else {
        document.documentElement.setAttribute(MASK_ATTR, String(level));
    }
};

export function useInfoMask({ store, t }) {
    const infoMaskLevel = ref(0);
    const isInfosLoaded = ref(false);
    const showMaskButton = ref(false);

    const toggleInfoMask = () => {
        trackEvent('SideButtons', 'ToggleClick', 'InfoMask');
        infoMaskLevel.value = infoMaskLevel.value === 0 ? 1 : 0;

        // Masking is a neutral toggle, not a success/warning state — both
        // directions surface the same info-toned toast.
        const titleKey = infoMaskLevel.value === 1 ? 'alert.maskedInfoTitle' : 'alert.unmaskedInfoTitle';
        const messageKey = infoMaskLevel.value === 1 ? 'alert.maskedInfoMessage' : 'alert.unmaskedInfoMessage';
        store.setAlert(true, infoMaskLevel.value === 1 ? 'text-success' : 'text-warning', t(messageKey), t(titleKey));
    };

    // Mirror the level to <html data-mask-level="…"> so the global CSS rule can
    // apply the blur. Also covers the orchestrator's external reset to 0.
    watch(infoMaskLevel, syncMaskAttribute, { immediate: true });

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
