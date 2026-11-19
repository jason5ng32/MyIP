// Tests for frontend/composables/use-snapshot-save.js — "Save snapshot now"
// over a stubbed command bus, router and recorder API: filing this visit's
// results directly, running a cached Home's tests in place (the command set
// per `autoRun*` preference; always a manual snapshot once the sections
// settle, automatic recording or not; connectivity once its grid settles),
// the trip through a Home that never mounted and back, failures and the
// one-run guard.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ref } from 'vue';

import {
    useSnapshotSave, SNAPSHOTS_PATH,
} from '../frontend/composables/use-snapshot-save.js';
import { appCommandError } from '../frontend/utils/app-commands.js';

const ALL_ON = { autoRunConnectivity: true, autoRunWebRTC: true, autoRunDnsLeak: true };

// `done` once settled, so a later call by the same name gets a fresh one.
const deferred = () => {
    const d = { done: false };
    d.promise = new Promise((res, rej) => {
        d.resolve = (value) => {
            d.done = true;
            res(value);
        };
        d.reject = (error) => {
            d.done = true;
            rej(error);
        };
    });
    return d;
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

// The recorder's read / action API; `currentId` is the automatic snapshot.
const fakeSnapshots = ({ canTake = false, taken = 'manual-1' } = {}) => {
    const calls = [];
    return {
        calls,
        canTakeSnapshot: ref(canTake),
        currentId: ref(null),
        takeSnapshot: () => {
            calls.push('takeSnapshot');
            return taken;
        },
    };
};

// Every dispatched command and awaited event settles when the test says so;
// `settle(name)` is the latest call's, a call after it settled a new one.
const fakeBus = ({ mounted = true } = {}) => {
    const log = [];
    const pending = new Map();
    const settle = (name) => {
        if (!pending.has(name)) pending.set(name, deferred());
        return pending.get(name);
    };
    const call = (name) => {
        if (pending.get(name)?.done) pending.delete(name);
        return settle(name).promise;
    };
    return {
        log,
        settle,
        hasAppCommand: () => mounted,
        dispatchAppCommand: (name, payload, options) => {
            log.push(['dispatch', name, payload, options]);
            return call(name);
        },
        waitForAppCommand: (name) => {
            log.push(['waitCommand', name]);
            return Promise.resolve();
        },
        waitForAppEvent: (name, options) => {
            log.push(['waitEvent', name, undefined, options]);
            return call(name);
        },
    };
};

// push lands at once; `log` is shared with the bus to check the order.
const fakeRouter = (log, path = SNAPSHOTS_PATH) => {
    const router = {
        pushes: [],
        currentRoute: { value: { path } },
        push: async (to) => {
            router.pushes.push(to);
            log.push(['push', to]);
            router.currentRoute.value = { path: typeof to === 'string' ? to : to.path };
        },
    };
    return router;
};

const setup = ({ prefs = ALL_ON, canTake = false, mounted = true, taken } = {}) => {
    const snapshots = fakeSnapshots({ canTake, taken });
    const bus = fakeBus({ mounted });
    const router = fakeRouter(bus.log);
    const { saving, save } = useSnapshotSave({
        store: { userPreferences: prefs }, router, snapshots, bus, timeoutMs: 1000,
    });
    return { snapshots, bus, router, saving, save };
};

const eventWaits = (bus, name) => bus.log.filter(([kind, event]) => kind === 'waitEvent' && event === name).length;

const dispatched = (bus) => bus.log.filter(([kind]) => kind === 'dispatch').map(([, name, payload]) => [name, payload]);

describe('useSnapshotSave', () => {
    it('files this visit’s results at once when it has them', async () => {
        const { snapshots, bus, router, save } = setup({ canTake: true });
        assert.deepEqual(await save(), { status: 'saved', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
        assert.deepEqual(bus.log, []);
        assert.deepEqual(router.pushes, []);
    });

    it('runs a cached Home’s tests in place, per the autoRun preferences, never the speed test', async () => {
        const { bus, save, saving } = setup();
        const run = save();
        assert.equal(saving.value, true);
        assert.deepEqual(dispatched(bus), [
            ['ipinfo:refresh', {}],
            ['connectivity:run', { trigger: 'refresh' }],
            ['webrtc:run', { isRefresh: true }],
            ['dnsleak:run', { isRefresh: true }],
        ]);
        assert.ok(bus.log.every(([, , , options]) => options?.timeoutMs === 1000));
        bus.settle('ipinfo:refresh').resolve({});
        bus.settle('connectivity:run').resolve();
        bus.settle('webrtc:run').resolve();
        bus.settle('dnsleak:run').resolve();
        await run;
        assert.equal(saving.value, false);
    });

    it('dispatches only the sections whose autoRun preference is on', async () => {
        const { bus, save } = setup({ prefs: { autoRunWebRTC: true } });
        const run = save();
        assert.deepEqual(dispatched(bus).map(([name]) => name), ['ipinfo:refresh', 'webrtc:run']);
        bus.settle('ipinfo:refresh').resolve({});
        bus.settle('webrtc:run').resolve();
        await run;
    });

    it('takes a frozen manual snapshot even when the recorder made an automatic one', async () => {
        const { snapshots, bus, save } = setup({ prefs: { autoRunWebRTC: true } });
        const run = save();
        snapshots.currentId.value = 'auto-1'; // the recorder ran on ipinfo:finished
        bus.settle('ipinfo:refresh').resolve({});
        await flush();
        assert.deepEqual(snapshots.calls, [], 'waits for the sections');
        bus.settle('webrtc:run').resolve();
        assert.deepEqual(await run, { status: 'saved', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
    });

    it('takes a manual snapshot once the other sections settle, failed ones included', async () => {
        const { snapshots, bus, save } = setup();
        const run = save();
        bus.settle('ipinfo:refresh').resolve({});
        await flush();
        assert.deepEqual(snapshots.calls, [], 'waits for the sections');
        bus.settle('connectivity:run').resolve();
        bus.settle('webrtc:run').reject(appCommandError('timeout', 'slow'));
        bus.settle('dnsleak:run').resolve();
        assert.deepEqual(await run, { status: 'saved', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
    });

    it('waits in place for a settled connectivity grid, not a multi-round first pass', async () => {
        const { snapshots, bus, save } = setup({ prefs: { autoRunConnectivity: true } });
        const run = save();
        bus.settle('ipinfo:refresh').resolve({});
        bus.settle('connectivity:run').resolve({ settled: false, targets: [] });
        await flush();
        assert.deepEqual(snapshots.calls, [], 'round 1 is not filed');
        assert.equal(eventWaits(bus, 'connectivity:finished'), 1);
        bus.settle('connectivity:finished').resolve({ settled: false, targets: [] });
        await flush();
        assert.deepEqual(snapshots.calls, [], 'still unsettled');
        assert.equal(eventWaits(bus, 'connectivity:finished'), 2);
        assert.ok(bus.log.every(([, , , options]) => options?.timeoutMs === 1000));
        bus.settle('connectivity:finished').resolve({ settled: true, targets: [] });
        assert.deepEqual(await run, { status: 'saved', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
    });

    it('files at once on a connectivity result already settled, or without `settled`', async () => {
        for (const result of [{ settled: true, targets: [] }, { targets: [] }, undefined]) {
            const { snapshots, bus, save } = setup({ prefs: { autoRunConnectivity: true } });
            const run = save();
            bus.settle('ipinfo:refresh').resolve({});
            bus.settle('connectivity:run').resolve(result);
            assert.deepEqual(await run, { status: 'saved', id: 'manual-1' }, JSON.stringify(result));
            assert.deepEqual(snapshots.calls, ['takeSnapshot']);
            assert.equal(eventWaits(bus, 'connectivity:finished'), 0);
        }
    });

    it('still files when the wait for a settled grid times out', async () => {
        const { snapshots, bus, save } = setup({ prefs: { autoRunConnectivity: true } });
        const run = save();
        bus.settle('ipinfo:refresh').resolve({});
        bus.settle('connectivity:run').resolve({ settled: false, targets: [] });
        await flush();
        bus.settle('connectivity:finished').reject(appCommandError('timeout', 'slow'));
        assert.deepEqual(await run, { status: 'saved', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
    });

    it('waits on Home for a settled connectivity grid before the manual snapshot', async () => {
        const { snapshots, bus, router, save } = setup({ mounted: false, prefs: { autoRunConnectivity: true } });
        const run = save();
        await flush();
        bus.settle('ipinfo:finished').resolve({});
        bus.settle('connectivity:finished').resolve({ settled: false, targets: [] });
        await flush();
        assert.deepEqual(snapshots.calls, [], 'round 1 is not filed');
        assert.equal(eventWaits(bus, 'connectivity:finished'), 2);
        bus.settle('connectivity:finished').resolve({ settled: true, targets: [] });
        assert.deepEqual(await run, { status: 'returned', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
        assert.deepEqual(router.pushes.at(-1), { path: SNAPSHOTS_PATH, query: { q: 'manual-1' } });
    });

    it('proceeds on Home when the first connectivity grid is already settled', async () => {
        const { snapshots, bus, save } = setup({ mounted: false, prefs: { autoRunConnectivity: true } });
        const run = save();
        await flush();
        bus.settle('ipinfo:finished').resolve({});
        bus.settle('connectivity:finished').resolve({ settled: true, targets: [] });
        assert.deepEqual(await run, { status: 'returned', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
        assert.equal(eventWaits(bus, 'connectivity:finished'), 1);
    });

    it('goes through a Home that never mounted and returns to the snapshot', async () => {
        const { snapshots, bus, router, save } = setup({ mounted: false });
        const run = save();
        await flush();
        // Listens before navigating; runs nothing itself (Home's load does).
        assert.deepEqual(bus.log.slice(0, 5).map(([kind, name]) => [kind, name]), [
            ['waitEvent', 'ipinfo:finished'],
            ['waitEvent', 'connectivity:finished'],
            ['waitEvent', 'webrtc:finished'],
            ['waitEvent', 'dnsleak:finished'],
            ['push', '/'],
        ]);
        assert.deepEqual(dispatched(bus), []);
        snapshots.currentId.value = 'auto-2'; // Home's load recorded one
        bus.settle('ipinfo:finished').resolve({});
        bus.settle('connectivity:finished').resolve({});
        bus.settle('webrtc:finished').resolve({});
        bus.settle('dnsleak:finished').reject(appCommandError('timeout', 'slow'));
        assert.deepEqual(await run, { status: 'returned', id: 'manual-1' });
        assert.deepEqual(router.pushes.at(-1), { path: SNAPSHOTS_PATH, query: { q: 'manual-1' } });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
    });

    it('waits on Home for the sections before the manual snapshot, then returns', async () => {
        const { snapshots, bus, router, save } = setup({ mounted: false, prefs: { autoRunDnsLeak: true } });
        const run = save();
        await flush();
        bus.settle('ipinfo:finished').resolve({});
        await flush();
        assert.deepEqual(snapshots.calls, [], 'waits for the sections');
        bus.settle('dnsleak:finished').resolve({});
        assert.deepEqual(await run, { status: 'returned', id: 'manual-1' });
        assert.deepEqual(snapshots.calls, ['takeSnapshot']);
        assert.deepEqual(router.pushes.at(-1), { path: SNAPSHOTS_PATH, query: { q: 'manual-1' } });
    });

    it('stays put when the visitor left Home meanwhile', async () => {
        const { bus, router, save } = setup({ mounted: false, prefs: {} });
        const run = save();
        await flush();
        router.currentRoute.value = { path: '/tools/whois' };
        bus.settle('ipinfo:finished').resolve({});
        assert.deepEqual(await run, { status: 'returned', id: 'manual-1' });
        assert.deepEqual(router.pushes, ['/']);
    });

    it('fails, and frees the button, when ipinfo cannot run', async () => {
        const { bus, save, saving } = setup();
        const run = save();
        bus.settle('ipinfo:refresh').reject(appCommandError('unavailable', 'gone'));
        assert.deepEqual(await run, { status: 'failed', id: null });
        assert.equal(saving.value, false);
    });

    it('fails when Home’s ipinfo never reports', async () => {
        const { bus, router, save } = setup({ mounted: false });
        const run = save();
        await flush();
        bus.settle('ipinfo:finished').reject(appCommandError('timeout', 'late'));
        assert.deepEqual(await run, { status: 'failed', id: null });
        assert.deepEqual(router.pushes, ['/']);
    });

    it('fails when the tests leave nothing to file', async () => {
        const { bus, save } = setup({ prefs: {}, taken: null });
        const run = save();
        bus.settle('ipinfo:refresh').resolve({});
        assert.deepEqual(await run, { status: 'failed', id: null });
    });

    it('runs one save at a time', async () => {
        const { bus, save } = setup({ prefs: {} });
        const run = save();
        assert.deepEqual(await save(), { status: 'busy', id: null });
        bus.settle('ipinfo:refresh').resolve({});
        await run;
        assert.equal(dispatched(bus).length, 1);
    });
});
