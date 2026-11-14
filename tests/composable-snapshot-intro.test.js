// Tests for frontend/composables/use-snapshot-intro.js — with no snapshot at
// entry, the page load's first automatic `snapshot:created` becomes one
// queued toast request (fixed id, `once`, 15 s from entry, a View action to
// the Snapshots page, a show track) while the change notice is on and storage
// persists; nothing for manual saves, when snapshots existed at entry, the
// notice is off, storage is memory-only, or for later creations; disposing
// stops it.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { effectScope, reactive } from 'vue';

import {
    useSnapshotIntro, SNAPSHOT_INTRO_ID, SNAPSHOT_INTRO_DELAY_MS,
} from '../frontend/composables/use-snapshot-intro.js';
import { emitAppEvent } from '../frontend/utils/app-events.js';

let scope = null;

const t = (key) => key;

const start = (prefs, { had = false, persisting = true, clock = { now: 0 } } = {}) => {
    const requests = [];
    const store = reactive({
        userPreferences: { snapshotsAuto: 'smart', snapshotsNotify: true, ...prefs },
        queueToast: (request) => requests.push(request),
    });
    scope = effectScope();
    scope.run(() => useSnapshotIntro({
        store, t, now: () => clock.now, hadSnapshots: () => had, persisting: () => persisting,
    }));
    return { store, requests, clock };
};

afterEach(() => {
    scope?.stop();
    scope = null;
});

describe('snapshot intro', () => {
    it('queues one toast on the first snapshot of an empty browser', () => {
        const { requests } = start();
        emitAppEvent('snapshot:created', { id: 'id1', auto: true });
        assert.deepEqual(requests, [{
            id: SNAPSHOT_INTRO_ID,
            style: 'text-info',
            title: 'snapshots.IntroTitle',
            message: 'snapshots.IntroNote',
            duration: 10000,
            once: true,
            when: { delayMs: 15000 },
            action: {
                label: 'snapshots.ChangedView',
                to: { name: 'tool', params: { slug: 'snapshots' } },
                track: ['Snapshots', 'IntroNoticeClick', 'View'],
            },
            track: ['Snapshots', 'IntroNotice', 'Show'],
        }]);
        assert.equal(SNAPSHOT_INTRO_DELAY_MS, 15000);
    });

    it('queues only once for repeated creations', () => {
        const { requests } = start();
        emitAppEvent('snapshot:created', { id: 'id1', auto: true });
        emitAppEvent('snapshot:created', { id: 'id2', auto: false });
        assert.equal(requests.length, 1);
    });

    it('counts the delay from page entry', () => {
        for (const [at, delayMs] of [[10000, 5000], [15000, 0], [40000, 0]]) {
            const { requests, clock } = start({}, { clock: { now: 1000 } });
            clock.now = 1000 + at;
            emitAppEvent('snapshot:created', { id: 'id1', auto: true });
            assert.deepEqual(requests[0].when, { delayMs }, `event at ${at}`);
            scope.stop();
        }
    });

    it('queues nothing when snapshots existed at entry', () => {
        const { requests } = start({}, { had: true });
        emitAppEvent('snapshot:created', { id: 'id1', auto: true });
        assert.deepEqual(requests, []);
    });

    it('queues nothing while the notice is off, or recording is', () => {
        for (const prefs of [{ snapshotsNotify: false }, { snapshotsAuto: 'off' }]) {
            const { requests } = start(prefs);
            emitAppEvent('snapshot:created', { id: 'id1', auto: true });
            assert.deepEqual(requests, [], JSON.stringify(prefs));
            scope.stop();
        }
    });

    it('ignores manual saves and waits for an automatic snapshot', () => {
        const { requests } = start();
        emitAppEvent('snapshot:created', { id: 'm1', auto: false });
        assert.deepEqual(requests, []);
        emitAppEvent('snapshot:created', { id: 'a1', auto: true });
        assert.equal(requests.length, 1);
    });

    it('queues nothing when snapshots stay in memory only', () => {
        const { requests } = start({}, { persisting: false });
        emitAppEvent('snapshot:created', { id: 'id1', auto: true });
        assert.deepEqual(requests, []);
    });

    it('stops listening when its scope is disposed', () => {
        const { requests } = start();
        scope.stop();
        emitAppEvent('snapshot:created', { id: 'id1', auto: true });
        assert.deepEqual(requests, []);
    });
});
