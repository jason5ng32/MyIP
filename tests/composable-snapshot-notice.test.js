// Tests for frontend/composables/use-snapshot-notice.js — `snapshot:changed`
// becomes one queued toast request (fixed id, `once`, the 50 s / Speed Test
// timing, a View action to the snapshot) only while the notice is on
// (snapshotsNotify, and never with automatic recording off); empty payloads
// are ignored; turning the notice off cancels it; disposing stops it.

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { effectScope, reactive, ref, nextTick } from 'vue';

import {
    useSnapshotNotice, SNAPSHOT_NOTICE_ID, SNAPSHOT_NOTICE_WHEN,
} from '../frontend/composables/use-snapshot-notice.js';
import { emitAppEvent } from '../frontend/utils/app-events.js';

let scope = null;

const TITLES = { 'ipInfos.Title': 'IP Infos', 'dnsleaktest.Title': 'DNS Leak Test', 'connectivity.Title': 'Connectivity' };
const t = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : TITLES[key] ?? key);

const start = (prefs) => {
    const requests = [];
    const store = reactive({
        userPreferences: { snapshotsAuto: 'smart', snapshotsNotify: true, ...prefs },
        queueToast: (request) => requests.push(request),
        cancelToast: (id) => requests.push({ id, cancel: true }),
    });
    scope = effectScope();
    scope.run(() => useSnapshotNotice({ store, t, locale: ref('en') }));
    return { store, requests };
};

afterEach(() => {
    scope?.stop();
    scope = null;
});

describe('snapshot notice', () => {
    it('queues one waiting, once-only toast that opens the snapshot', () => {
        const { requests } = start();
        emitAppEvent('snapshot:changed', { id: 'id2', sections: ['ipinfo', 'connectivity', 'dnsleak'] });
        assert.deepEqual(requests, [{
            id: SNAPSHOT_NOTICE_ID,
            style: 'text-info',
            title: 'snapshots.ChangedTitle',
            message: `snapshots.ChangedNote:${JSON.stringify({ sections: 'IP Infos, Connectivity, and DNS Leak Test' })}`,
            duration: 10000,
            once: true,
            when: SNAPSHOT_NOTICE_WHEN,
            action: {
                label: 'snapshots.ChangedView',
                to: { name: 'tool', params: { slug: 'snapshots' }, query: { q: 'id2' } },
                track: ['Snapshots', 'ChangeNoticeClick', 'View'],
            },
        }]);
        assert.deepEqual(SNAPSHOT_NOTICE_WHEN, { delayMs: 50000, reach: 'SpeedTest' });
    });

    it('queues nothing while the notice is off, or recording is', () => {
        for (const prefs of [{ snapshotsNotify: false }, { snapshotsAuto: 'off' }]) {
            const { requests } = start(prefs);
            emitAppEvent('snapshot:changed', { id: 'id2', sections: ['ipinfo'] });
            assert.deepEqual(requests, [], JSON.stringify(prefs));
            scope.stop();
        }
    });

    it('turning the notice off cancels it', async () => {
        const { store, requests } = start();
        store.userPreferences.snapshotsAuto = 'off';
        await nextTick();
        assert.deepEqual(requests, [{ id: SNAPSHOT_NOTICE_ID, cancel: true }]);
    });

    it('ignores an empty payload', () => {
        const { requests } = start();
        emitAppEvent('snapshot:changed', { id: 'id2', sections: [] });
        emitAppEvent('snapshot:changed', { sections: ['ipinfo'] });
        emitAppEvent('snapshot:changed');
        assert.deepEqual(requests, []);
    });

    it('stops listening when its scope is disposed', () => {
        const { requests } = start();
        scope.stop();
        emitAppEvent('snapshot:changed', { id: 'id2', sections: ['ipinfo'] });
        assert.deepEqual(requests, []);
    });
});
