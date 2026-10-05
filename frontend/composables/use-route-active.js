// "Is my page the one on screen?" for components living under the app's
// <KeepAlive> layers (App.vue caches Home and ToolPage; ToolPage caches each
// visited tool). A cached page stays mounted while another route shows, so
// anything that acts on the route, the document or window-level events must
// pause while it is deactivated and catch up when it is activated again.
//
// Vue registers onActivated / onDeactivated on every KeepAlive-cached
// ancestor, so the same call works in a page root (Home), deep inside it
// (Nav) and inside a cached tool (ToolPage's inner KeepAlive).
//
//   useRouteActive()  → ref, true while the calling component's page is
//                       active; always true outside a component instance
//                       or a KeepAlive.
//   useActiveValue(getter, { pathOf }) → computed that follows `getter`
//                       while active and holds its last value while hidden,
//                       so a watcher on it ignores what other pages do to
//                       shared state (the route's query) and fires on
//                       activation only if the value really changed meanwhile.
//   useActiveEventListener(target, event, handler, options)
//                     → the listener is attached only while active
//                       (mounted / activated) and detached on deactivation
//                       and unmount.

import {
    computed, getCurrentInstance, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref,
} from 'vue';

// A component can first mount inside a branch that is already cached away
// (an async child whose chunk lands after its page was left); it starts
// inactive and waits for the next activation. `isDeactivated` is the flag
// Vue's KeepAlive sets on the cached root.
const inDeactivatedBranch = (instance) => {
    for (let current = instance; current; current = current.parent) {
        if (current.isDeactivated) return true;
    }
    return false;
};

export const useRouteActive = () => {
    const instance = getCurrentInstance();
    const active = ref(instance ? !inDeactivatedBranch(instance) : true);
    if (!instance) return active;
    onActivated(() => { active.value = true; });
    onDeactivated(() => { active.value = false; });
    return active;
};

// `pathOf` (optional) reads the current location's path. A navigation updates
// the route before the old page is deactivated (that happens after the next
// render), so `active` alone would let the next page's query through for one
// flush; with `pathOf` the value also holds once the path leaves the one the
// page was activated on. `active` is injectable for tests.
export const useActiveValue = (getter, { pathOf, active = useRouteActive() } = {}) => {
    let ownPath = pathOf?.();
    if (getCurrentInstance()) onActivated(() => { ownPath = pathOf?.(); });
    return computed((previous) => (
        active.value && (!pathOf || pathOf() === ownPath) ? getter() : previous
    ));
};

export const useActiveEventListener = (target, event, handler, options) => {
    const active = useRouteActive();
    let attached = false;

    const attach = () => {
        if (attached) return;
        target.addEventListener(event, handler, options);
        attached = true;
    };
    const detach = () => {
        if (!attached) return;
        target.removeEventListener(event, handler, options);
        attached = false;
    };

    onMounted(() => { if (active.value) attach(); });
    onActivated(attach);
    onDeactivated(detach);
    onBeforeUnmount(detach);
};
