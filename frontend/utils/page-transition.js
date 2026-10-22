// Page transitions: route changes animate through the same-document View
// Transitions API, keyed by the direction set on <html data-page-transition>
// (keyframes in style/style.css). The router swaps the DOM, scroll included,
// inside the snapshot window, so pages of different heights never overlap live.

import { nextTick as vueNextTick } from 'vue';

const HOME = 'home';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
// Cap on how long the router may hold the DOM update once the old page is snapshotted.
export const UPDATE_TIMEOUT_MS = 1000;

// Nothing animates on the first navigation (the router's START_LOCATION) or a
// query / hash-only change (a tool writing back its `?q=`).
export const transitionDirection = (from, to) => {
    if (!from || !to) return null;
    const firstNavigation = from.name === undefined
        || (Array.isArray(from.matched) && from.matched.length === 0);
    if (firstNavigation || from.path === to.path) return null;
    if (from.name === HOME) return 'forward';
    if (to.name === HOME) return 'back';
    return 'fade';
};

// A running transition is never stacked on, and a history step the browser
// already animated (iOS swipe-back: `hasUAVisualTransition`) is not animated twice.
export const shouldAnimate = ({ direction, supported, reducedMotion, inFlight, uaTransition }) =>
    Boolean(direction) && supported === true && !reducedMotion && !inFlight && !uaTransition;

// Hooks the router: beforeResolve (after every guard, so a redirect never
// starts a transition) snapshots the old page and lets the navigation proceed
// once the transition's update callback runs; afterEach + nextTick (failures
// included) and onError end the update, a timeout caps it.
export const installPageTransitions = (router, {
    doc = globalThis.document,
    win = globalThis.window,
    nextTick = vueNextTick,
    timeoutMs = UPDATE_TIMEOUT_MS,
} = {}) => {
    if (!doc?.documentElement) return;
    const root = doc.documentElement;
    let active = null;        // the ViewTransition until its `finished` settles
    let endUpdate = null;     // resolves the active transition's update callback
    let uaTransition = false; // the pending history step was animated by the browser

    // Capture phase: runs before the router's own popstate listener.
    win?.addEventListener?.('popstate', (event) => {
        uaTransition = event?.hasUAVisualTransition === true;
    }, { capture: true });

    const finishUpdate = () => {
        const end = endUpdate;
        endUpdate = null;
        end?.();
    };

    router.beforeResolve((to, from) => {
        const direction = transitionDirection(from, to);
        const viaBrowser = uaTransition;
        uaTransition = false;
        // A page change while one is still animating cuts that one short and
        // switches instantly; query-only changes leave it running.
        const inFlight = active !== null;
        if (inFlight && direction) active.skipTransition?.();
        const animate = shouldAnimate({
            direction,
            supported: typeof doc.startViewTransition === 'function',
            reducedMotion: Boolean(win?.matchMedia?.(REDUCED_MOTION_QUERY)?.matches),
            inFlight,
            uaTransition: viaBrowser,
        });
        if (!animate) return;

        return new Promise((proceed) => {
            const updated = new Promise((resolve) => {
                const timer = setTimeout(() => { proceed(); finishUpdate(); }, timeoutMs);
                endUpdate = () => { clearTimeout(timer); resolve(); };
            });
            root.dataset.pageTransition = direction;
            let transition;
            try {
                transition = doc.startViewTransition(() => { proceed(); return updated; });
            } catch {
                delete root.dataset.pageTransition;
                finishUpdate();
                proceed();
                return;
            }
            active = transition;
            // `ready` rejects when the animation is skipped; nothing to report.
            transition.ready?.catch?.(() => {});
            Promise.resolve(transition.finished).catch(() => {}).finally(() => {
                active = null;
                delete root.dataset.pageTransition;
            });
        });
    });

    router.afterEach(async () => {
        uaTransition = false;
        if (!endUpdate) return;
        await nextTick();
        finishUpdate();
    });

    router.onError(() => finishUpdate());
};
