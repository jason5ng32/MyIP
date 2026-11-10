// Attention gate: whether the visitor can be interrupted yet. `ready` turns
// true after `delayMs` (in a background tab, when it is next shown) or once
// the element `reach` (an id) is in view or scrolled past, whichever comes
// first; without either it is true at once. `createAttentionGate` is for
// gates made on demand (the element is looked up then) and is stopped by its
// caller; `useAttentionGate` stops with the calling scope.

import { ref, onScopeDispose } from 'vue';

export const createAttentionGate = ({ delayMs, reach } = {}) => {
    const ready = ref(false);
    let timer = null;
    let observer = null;
    const onVisible = () => {
        if (!document.hidden) open();
    };
    const stop = () => {
        clearTimeout(timer);
        observer?.disconnect();
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
    const open = () => {
        stop();
        ready.value = true;
    };

    if (typeof delayMs !== 'number' && !reach) {
        ready.value = true;
        return { ready, stop };
    }
    if (typeof delayMs === 'number') {
        timer = setTimeout(() => {
            if (document.hidden) document.addEventListener('visibilitychange', onVisible);
            else open();
        }, delayMs);
    }
    const target = reach && typeof IntersectionObserver !== 'undefined' ? document.getElementById(reach) : null;
    if (target) {
        observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.bottom < 0)) open();
        });
        observer.observe(target);
    }
    return { ready, stop };
};

export const useAttentionGate = (options) => {
    const gate = createAttentionGate(options);
    onScopeDispose(gate.stop);
    return gate;
};
