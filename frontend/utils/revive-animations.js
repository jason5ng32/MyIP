// Revives the page's running CSS animations after a history step. On iOS
// (measured on 26), animations running before a swipe-back stay visually frozen
// after it until their layer is rebuilt: cancel + play does it, ancestor style
// changes don't. Each is replayed at the time it was at, so nothing jumps.

// Late passes: the browser may dismiss its gesture snapshot late.
const REVIVE_DELAYS_MS = [0, 400, 1200];

const isCssAnimation = (animation) => typeof animation?.animationName === 'string';

export const reviveAnimations = (doc = globalThis.document) => {
    const animations = doc?.getAnimations?.() ?? [];
    let revived = 0;
    for (const animation of animations) {
        if (!isCssAnimation(animation) || animation.playState !== 'running') continue;
        const time = animation.currentTime;
        animation.cancel();
        animation.play();
        if (typeof time === 'number') animation.currentTime = time;
        revived += 1;
    }
    return revived;
};

// `schedule` defaults to two animation frames (the new DOM is on screen) plus the delay.
export const installAnimationRevival = (router, {
    win = globalThis.window,
    doc = globalThis.document,
    schedule = (fn, delayMs) => {
        win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
            if (delayMs) win.setTimeout(fn, delayMs); else fn();
        }));
    },
} = {}) => {
    if (!win?.addEventListener || !router?.afterEach) return;
    let historyStep = false;
    // Capture phase: runs before the router's own popstate listener.
    win.addEventListener('popstate', () => { historyStep = true; }, { capture: true });
    router.afterEach(() => {
        if (!historyStep) return;
        historyStep = false;
        for (const delayMs of REVIVE_DELAYS_MS) {
            schedule(() => reviveAnimations(doc), delayMs);
        }
    });
};
