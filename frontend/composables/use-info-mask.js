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
import { trackEvent } from '../utils/use-analytics.js';

const MASK_ATTR = 'data-mask-level';

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

        if (infoMaskLevel.value === 1) {
            store.setAlert(
                true,
                'text-warning',
                t('alert.maskedInfoMessage'),
                t('alert.maskedInfoTitle'),
            );
        } else {
            store.setAlert(
                true,
                'text-danger',
                t('alert.unmaskedInfoMessage'),
                t('alert.unmaskedInfoTitle'),
            );
        }
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
