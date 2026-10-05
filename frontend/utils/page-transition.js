// Page transitions: route changes between pages animate like native
// navigation through the same-document View Transitions API. The browser
// snapshots the old page, the router swaps the DOM (scroll restoration
// included) inside the snapshot window, then the two snapshots animate — so
// pages of different heights and scroll positions never overlap live.
//
//   transitionDirection(from, to) → null | 'forward' | 'back' | 'fade'
//   shouldAnimate({ direction, supported, reducedMotion, inFlight, uaTransition })
//   restartAnimations(element)      — run on the named elements after each one
//   installPageTransitions(router)  — registered once in router/index.js
//
// The direction lands on <html data-page-transition>, which style/style.css
// keys its keyframes on; no direction, no support or reduced motion is the
// plain instant switch.

import { nextTick as vueNextTick } from 'vue';

const HOME = 'home';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
// Upper bound on how long the router may hold the DOM update once the old
// page is snapshotted; past it the transition finishes whatever its state.
export const UPDATE_TIMEOUT_MS = 1000;

// Which animation a navigation gets. Nothing animates on the first navigation
// (the router's START_LOCATION: no name, no matched records) or when only the
// query / hash changes (a tool writing back its `?q=`). Home → a page slides
// forward, a page → Home slides back, page → page cross-fades.
export const transitionDirection = (from, to) => {
    if (!from || !to) return null;
    const firstNavigation = from.name === undefined
        || (Array.isArray(from.matched) && from.matched.length === 0);
    if (firstNavigation || from.path === to.path) return null;
    if (from.name === HOME) return 'forward';
    if (to.name === HOME) return 'back';
    return 'fade';
};

// Whether a navigation starts a view transition. A running one is never
// stacked on (the caller skips it instead), and a history step the browser
// already animated itself (iOS swipe-back: `hasUAVisualTransition`) is not
// animated twice.
export const shouldAnimate = ({ direction, supported, reducedMotion, inFlight, uaTransition }) =>
    Boolean(direction) && supported === true && !reducedMotion && !inFlight && !uaTransition;

// The elements captured under their own view-transition-name (style.css):
// the Nav and the iOS status-bar tint. WebKit leaves the accelerated CSS
// animations inside a captured element stalled once the transition is over
// (Pulse's spinning globe and ping only repainted in ~0.5s jumps afterwards,
// measured on iOS 26), so every transition ends by restarting them.
export const NAMED_ELEMENTS_SELECTOR = '.jn-site-nav, .jn-site-status-bar';

// Cancel + play recreates each running animation on the compositor; a paused
// or finished one is left as it is. An infinite spin or ping restarting from
// its first frame is not visible.
export const restartAnimations = (element) => {
    const animations = element?.getAnimations?.({ subtree: true }) ?? [];
    for (const animation of animations) {
        if (animation.playState !== 'running') continue;
        animation.cancel();
        animation.play();
    }
};

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

    // Capture phase on the target: runs before the router's own popstate
    // listener starts the navigation.
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
                if (active !== transition) return;
                active = null;
                delete root.dataset.pageTransition;
                doc.querySelectorAll?.(NAMED_ELEMENTS_SELECTOR)?.forEach?.(restartAnimations);
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
