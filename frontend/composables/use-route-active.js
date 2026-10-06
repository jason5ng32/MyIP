// "Is my page the one on screen?" for components under the app's KeepAlive
// layers (App.vue caches Home and ToolPage; ToolPage caches each tool). A
// cached page stays mounted while another route shows, so whatever acts on the
// route, the document or window events pauses while it is deactivated.
// onActivated / onDeactivated fire for every cached ancestor, so the same call
// works at a page root and deep inside it. Outside a component, always active.

import {
    computed, getCurrentInstance, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref,
} from 'vue';

// An async child can first mount after its page was cached away; it starts
// inactive. `isDeactivated` is the flag KeepAlive sets on the cached root.
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

// A computed that follows `getter` while active and holds its last value while
// hidden. The route changes a render before the old page is deactivated, so
// `pathOf` (the current path) also holds it once the path leaves the page's.
export const useActiveValue = (getter, { pathOf, active = useRouteActive() } = {}) => {
    let ownPath = pathOf?.();
    if (getCurrentInstance()) onActivated(() => { ownPath = pathOf?.(); });
    return computed((previous) => (
        active.value && (!pathOf || pathOf() === ownPath) ? getter() : previous
    ));
};

// Attached only while active (mounted / activated).
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
