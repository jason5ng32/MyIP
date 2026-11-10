// Tests for frontend/composables/use-toast-queue.js — store.toastRequests
// drained in order; no `when` shows at once, a `when` waits for its gate;
// the same id replaces a pending request and updates one that is up; a
// closed `once` id takes nothing more, other ids show again; a cancel drops
// a pending request (its gate stopped) and dismisses one that is up (closing
// a `once` one); requests without an id just show. The browser gate itself
// is out of scope.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { effectScope, reactive, ref } from 'vue';

import { useToastQueue } from '../frontend/composables/use-toast-queue.js';

let scope = null;

const start = () => {
    const store = reactive({ toastRequests: [] });
    const shown = [];
    const dismissed = [];
    const gates = [];
    const closers = new Map();
    scope = effectScope();
    scope.run(() => useToastQueue({
        store,
        show: (request, { onClose }) => {
            shown.push(request.title);
            closers.set(request.id, onClose);
        },
        dismiss: (id) => dismissed.push(id),
        createGate: (when) => {
            const gate = { ready: ref(!when), stopped: false, stop() { this.stopped = true; } };
            gates.push(gate);
            return gate;
        },
    }));
    const queue = (request) => store.toastRequests.push(request);
    return { store, shown, dismissed, gates, queue, close: (id) => closers.get(id)() };
};

const WHEN = { delayMs: 50000, reach: 'SpeedTest' };

afterEach(() => {
    scope?.stop();
    scope = null;
});

describe('toast queue', () => {
    it('shows a request without `when` at once and drains the store', () => {
        const { store, shown, queue } = start();
        queue({ id: 'a', title: 'A' });
        queue({ title: 'no id' });
        assert.deepEqual(shown, ['A', 'no id']);
        assert.equal(store.toastRequests.length, 0);
    });

    it('waits for the gate; the latest pending request is the one shown', () => {
        const { shown, gates, queue } = start();
        queue({ id: 'n', title: 'first', when: WHEN });
        queue({ id: 'n', title: 'second', when: WHEN });
        assert.deepEqual(shown, []);
        assert.equal(gates.length, 1, 'one gate per id');
        gates[0].ready.value = true;
        assert.deepEqual(shown, ['second']);
    });

    it('updates a toast that is up in place', () => {
        const { shown, gates, queue } = start();
        queue({ id: 'n', title: 'first', when: WHEN });
        gates[0].ready.value = true;
        queue({ id: 'n', title: 'more', when: WHEN });
        assert.deepEqual(shown, ['first', 'more']);
    });

    it('a closed `once` id takes nothing more; another id shows again', () => {
        const { shown, gates, queue, close } = start();
        queue({ id: 'n', title: 'once', once: true, when: WHEN });
        gates[0].ready.value = true;
        close('n');
        queue({ id: 'n', title: 'again', once: true, when: WHEN });
        assert.deepEqual(shown, ['once']);
        queue({ id: 'm', title: 'm1' });
        close('m');
        queue({ id: 'm', title: 'm2' });
        assert.deepEqual(shown, ['once', 'm1', 'm2']);
    });

    it('a cancel drops a pending request and dismisses one that is up', () => {
        const { shown, dismissed, gates, queue } = start();
        queue({ id: 'n', title: 'pending', when: WHEN });
        queue({ id: 'n', cancel: true });
        gates[0].ready.value = true;
        assert.deepEqual(shown, []);
        assert.equal(gates[0].stopped, true);
        assert.deepEqual(dismissed, []);
        queue({ id: 'u', title: 'up' });
        queue({ id: 'u', cancel: true });
        assert.deepEqual(dismissed, ['u']);
    });

    it('a cancelled `once` toast that was up counts as closed', () => {
        const { shown, dismissed, queue } = start();
        queue({ id: 'n', title: 'once', once: true });
        queue({ id: 'n', cancel: true });
        queue({ id: 'n', title: 'again', once: true });
        assert.deepEqual(shown, ['once']);
        assert.deepEqual(dismissed, ['n']);
    });

    it('stops pending gates when its scope is disposed', () => {
        const { shown, gates, queue } = start();
        queue({ id: 'n', title: 'pending', when: WHEN });
        scope.stop();
        gates[0].ready.value = true;
        assert.deepEqual(shown, []);
        assert.equal(gates[0].stopped, true);
    });
});
