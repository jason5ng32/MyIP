// Attention gate: whether the visitor can be interrupted yet. `ready` turns
// true after `delayMs` (in a background tab, when it is next shown) or once
// the element `reach` (an id) has scrolled into view or past, whichever comes
// first; without either it is true at once. The element is looked up at
// creation and on every scroll or resize, so one outside the document then
// (a cached page) still counts once it is back. `createAttentionGate` is for
// gates made on demand and is stopped by its caller; `useAttentionGate`
// stops with the calling scope.

import { ref, onScopeDispose } from 'vue';

export const createAttentionGate = ({ delayMs, reach } = {}) => {
    const ready = ref(false);
    let timer = null;
    let frame = 0;
    const onVisible = () => {
        if (!document.hidden) open();
    };
    // Its top inside the viewport, or above it.
    const reached = () => {
        const target = document.getElementById(reach);
        return !!target && target.getBoundingClientRect().top < window.innerHeight;
    };
    const onMove = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (reached()) open();
        });
    };
    const stop = () => {
        clearTimeout(timer);
        if (typeof window === 'undefined') return;
        cancelAnimationFrame(frame);
        window.removeEventListener('scroll', onMove);
        window.removeEventListener('resize', onMove);
        document.removeEventListener('visibilitychange', onVisible);
    };
    const open = () => {
        stop();
        ready.value = true;
    };

    if (typeof delayMs !== 'number' && !reach) {
        ready.value = true;
        return { ready, stop };
    }
    if (reach && reached()) {
        ready.value = true;
        return { ready, stop };
    }
    if (typeof delayMs === 'number') {
        timer = setTimeout(() => {
            if (document.hidden) document.addEventListener('visibilitychange', onVisible);
            else open();
        }, delayMs);
    }
    if (reach) {
        window.addEventListener('scroll', onMove, { passive: true });
        window.addEventListener('resize', onMove, { passive: true });
    }
    return { ready, stop };
};

export const useAttentionGate = (options) => {
    const gate = createAttentionGate(options);
    onScopeDispose(gate.stop);
    return gate;
};
