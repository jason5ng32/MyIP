// Revives the page's running CSS animations after a history step.
//
// On iOS, accelerated CSS animations that were running before a swipe-back
// gesture stay visually frozen once the gesture lands on the previous page:
// requestAnimationFrame keeps its rate and the animations' own time keeps
// advancing, yet the compositor paints no new frame for them until their
// layer is rebuilt (measured on iOS 26: cancel + play, a display:none round
// trip or a re-insert revive them; style changes on an ancestor don't).
// A navigation that commits a new animation (a push with its page
// transition) revives them as a side effect, so only history steps — where
// the browser's own gesture animation replaces ours — are affected.
//
//   reviveAnimations(doc)            → how many animations were restarted
//   installAnimationRevival(router)  — registered once in router/index.js
//
// Each running CSS animation is cancelled, replayed and set back to the time
// it was at, so the revival shows no jump; passes run a couple of frames
// after the navigation settles and again shortly after, in case the browser
// dismisses its gesture snapshot late.

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

// `win` / `doc` / `schedule` are injectable for tests; `schedule(fn, delayMs)`
// defaults to two animation frames (the navigation's DOM is on screen) plus
// the delay.
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
    // Capture phase: runs before the router's own popstate listener starts
    // the navigation this flag belongs to.
    win.addEventListener('popstate', () => { historyStep = true; }, { capture: true });
    router.afterEach(() => {
        if (!historyStep) return;
        historyStep = false;
        for (const delayMs of REVIVE_DELAYS_MS) {
            schedule(() => reviveAnimations(doc), delayMs);
        }
    });
};
