// Page focus: after a navigation to a new page, focus moves to its <h1>
// (`data-page-heading`, `tabindex="-1"`), so the next Tab lands in the page's
// content and screen readers announce its title. History steps keep the
// browser's own behaviour. From the heading, the first Tab goes to the
// control the page marks `data-page-focus` (a tool's primary input).

import { nextTick as vueNextTick } from 'vue';

export const HEADING_SELECTOR = '[data-page-heading]';
export const PAGE_FOCUS_SELECTOR = '[data-page-focus]';
const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

// The router's START_LOCATION: the first load, from no page at all.
const isFirstNavigation = (from) => !from || from.name === undefined
    || (Array.isArray(from.matched) && from.matched.length === 0);

// A successful navigation onto another path (the first load included); a
// query / hash-only change (a tool writing back its `?q=`) is not one.
export const isPathChange = (from, to, failure) =>
    !failure && Boolean(to) && (isFirstNavigation(from) || from.path !== to.path);

// A new page the visitor moved to, not a back / forward step.
export const isPageArrival = ({ from, to, failure, viaHistory }) =>
    isPathChange(from, to, failure) && !viaHistory;

// Focus moves only onto a heading that exists, never away from focus the
// visitor (or the page itself) already put in the new page or a dialog.
export const shouldFocusPageHeading = ({ hasHeading, focusInPage, focusInDialog, ...navigation }) =>
    isPageArrival(navigation) && hasHeading === true && !focusInPage && !focusInDialog;

// The page holding `heading`: the element around its <main> (main + footer),
// or nothing when it has no <main>.
export const pageRoot = (heading) => {
    const main = heading?.closest?.('main') ?? null;
    return main?.parentElement ?? main;
};

// Where focus sits relative to the page holding `heading`.
export const focusContext = (doc, heading) => {
    const active = doc?.activeElement ?? null;
    const page = pageRoot(heading);
    return {
        focusInPage: Boolean(page && active && page.contains?.(active)),
        focusInDialog: Boolean(active?.closest?.(DIALOG_SELECTOR)),
    };
};

// Elements that can take focus (tabindex="-1" included: focus() reaches them).
const FOCUSABLE_SELECTOR = [
    'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea',
    '[tabindex]', '[contenteditable]:not([contenteditable="false"])',
].join(', ');

// A plain forward Tab: no modifier, no IME composition, not already handled.
export const isPlainTab = (event) => event?.key === 'Tab' && !event.shiftKey && !event.altKey
    && !event.ctrlKey && !event.metaKey && !event.isComposing && !event.defaultPrevented;

// Rendered and reachable: connected, laid out (no `display: none` on it or
// an ancestor), and not under `[hidden]` or `[inert]`.
export const isShown = (el) => Boolean(el?.isConnected)
    && (el.getClientRects?.().length ?? 0) > 0
    && !el.closest?.('[hidden], [inert]');

// Not disabled, by its own attribute or a disabled fieldset.
export const isEnabled = (el) => !el?.matches?.(':disabled');

const canTakeFocus = (el) => Boolean(el?.matches?.(FOCUSABLE_SELECTOR)) && isEnabled(el) && isShown(el);

// One marker's control: itself, or — when it wraps one (a component root) —
// its first focusable descendant. Null when it has nothing usable.
const markerTarget = (marker) => {
    if (!isShown(marker)) return null;
    if (marker.matches?.(FOCUSABLE_SELECTOR)) return isEnabled(marker) ? marker : null;
    return Array.from(marker.querySelectorAll?.(FOCUSABLE_SELECTOR) ?? []).find(canTakeFocus) ?? null;
};

// The control the first Tab from `heading` goes to: the first usable
// `[data-page-focus]` in its page, so each layout of a page (wide column,
// narrow row) can mark its own copy. Null when there is nothing usable.
export const pageFocusTarget = (heading) => {
    const markers = pageRoot(heading)?.querySelectorAll?.(PAGE_FOCUS_SELECTOR) ?? [];
    for (const marker of markers) {
        const target = markerTarget(marker);
        if (target) return target;
    }
    return null;
};

// Where a keydown should send focus instead of the native Tab, or null.
export const headingTabTarget = (event) => {
    if (!isPlainTab(event) || !event.target?.matches?.(HEADING_SELECTOR)) return null;
    return pageFocusTarget(event.target);
};

const animationFrame = (win) => new Promise((resolve) => {
    if (typeof win?.requestAnimationFrame === 'function') win.requestAnimationFrame(() => resolve());
    else resolve();
});

// Hooks the router's afterEach and a document keydown listener (the heading's
// Tab). KeepAlive moves cached pages into a detached container, so the one
// connected `[data-page-heading]` is the active page's.
export const installPageFocus = (router, {
    doc = globalThis.document,
    win = globalThis.window,
    nextTick = vueNextTick,
    nextFrame = () => animationFrame(win),
} = {}) => {
    if (!doc?.querySelector || !router?.afterEach) return;
    let viaHistory = false; // the pending navigation came from popstate
    let latest = 0;         // bumped per path change: a newer one cancels a wait

    // Capture phase: runs before the router's own popstate listener.
    win?.addEventListener?.('popstate', () => { viaHistory = true; }, { capture: true });

    // The native Tab is cancelled only once focus has really moved, so a
    // target that refuses focus (e.g. `visibility: hidden`) leaves it alone.
    // focus() scrolls only when the target is out of view, as a Tab would.
    doc.addEventListener?.('keydown', (event) => {
        const target = headingTabTarget(event);
        if (!target) return;
        target.focus?.({ focusVisible: true });
        if (doc.activeElement === target) event.preventDefault();
    });

    router.afterEach(async (to, from, failure) => {
        const navigation = { from, to, failure, viaHistory };
        viaHistory = false;
        if (!isPathChange(from, to, failure)) return;
        const run = ++latest;
        if (!isPageArrival(navigation)) return;
        // nextTick: the router view has patched in the new page (also the end of
        // a view transition's update); one frame more lets a heading gated on an
        // already-loaded async step (Privacy's cached copy) render.
        await nextTick();
        await nextFrame();
        if (run !== latest) return;
        const heading = doc.querySelector(HEADING_SELECTOR);
        const context = focusContext(doc, heading);
        if (!shouldFocusPageHeading({ ...navigation, hasHeading: Boolean(heading), ...context })) return;
        heading.focus?.({ preventScroll: true });
    });
};
