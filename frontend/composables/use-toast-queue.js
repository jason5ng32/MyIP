// Toast queue: runs the requests `store.queueToast` collects in
// `store.toastRequests` (plain objects: { id?, style?, title, message?,
// duration?, action?: { label, to?, track? }, when?: { delayMs?, reach? },
// once?, track? }, or { id, cancel: true }). A request with `when` waits for
// its attention gate (use-attention-gate.js); one whose id is already pending
// or up replaces it (updating the toast in place); a `once` id that has
// closed takes nothing more this page load; a cancel drops a pending one and
// dismisses one that is up (a `once` one then counts as closed). A request's
// `track` (event args) goes to `track(...)` when its toast appears, not on an
// in-place update. `show(request, { onClose })` draws the toast and calls
// onClose when it goes away; Toast.vue supplies it, with `dismiss(id)` and
// `track`.

import { watch, onScopeDispose } from 'vue';
import { createAttentionGate } from './use-attention-gate.js';

export const useToastQueue = ({
    store, show, dismiss = () => {}, track = () => {}, createGate = createAttentionGate,
}) => {
    const entries = new Map(); // id → { request, gate, stopWatch, up }
    const closed = new Set(); // `once` ids that have closed

    const release = (id) => {
        const entry = entries.get(id);
        entry?.gate?.stop();
        entry?.stopWatch?.();
        entries.delete(id);
        return entry;
    };

    const shown = (request) => {
        if (request.track) track(...request.track);
    };

    const display = (id) => {
        const entry = entries.get(id);
        const appearing = !entry.up;
        entry.up = true;
        show(entry.request, {
            onClose: () => {
                if (entries.get(id) !== entry) return;
                release(id);
                if (entry.request.once) closed.add(id);
            },
        });
        if (appearing) shown(entry.request);
    };

    const handle = (request) => {
        const { id } = request;
        if (id === undefined || id === null) {
            if (!request.cancel) {
                show(request, { onClose: () => {} });
                shown(request);
            }
            return;
        }
        if (request.cancel) {
            const entry = release(id);
            if (entry?.up) {
                if (entry.request.once) closed.add(id);
                dismiss(id);
            }
            return;
        }
        if (closed.has(id)) return;
        const existing = entries.get(id);
        if (existing) {
            existing.request = request;
            if (existing.up || existing.gate.ready.value) display(id);
            return;
        }
        const gate = createGate(request.when);
        const entry = { request, gate, stopWatch: null, up: false };
        entries.set(id, entry);
        if (gate.ready.value) {
            display(id);
            return;
        }
        entry.stopWatch = watch(gate.ready, (ready) => {
            if (ready && entries.get(id) === entry && !entry.up) display(id);
        }, { flush: 'sync' });
    };

    const drain = () => {
        if (!store.toastRequests?.length) return;
        store.toastRequests.splice(0).forEach(handle);
    };
    const stopDrain = watch(() => store.toastRequests?.length, drain, { flush: 'sync', immediate: true });

    onScopeDispose(() => {
        stopDrain();
        [...entries.keys()].forEach(release);
    });
};
