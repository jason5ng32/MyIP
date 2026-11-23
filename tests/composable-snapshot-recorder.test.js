// Tests for frontend/composables/use-snapshot-recorder.js — the recorder over
// the app-events bus and a stubbed storage: one automatic snapshot per
// session (in 'every' mode, the default here: created by its first
// ipinfo:finished, updated in place by every later result, never merged
// across loads), buffering of sections that arrive first (in any mode, so a
// mid-load mode switch starts from them), the auto modes ('smart' checked
// against the newest snapshot — a section it lacks included — unsettled
// connectivity rounds left out, the skipped note; 'off'; the old booleans),
// manual takeSnapshot (never the session's snapshot), the label card
// (labelCardId), count retention, the snapshot:created and snapshot:changed
// events (shared fields only, unsettled rounds left out, not while 'off'), untrusted
// storage, write failures, two tabs, and the useSnapshots actions.

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { effectScope, reactive } from 'vue';

import {
    useSnapshotRecorder, useSnapshots, resetSnapshots,
} from '../frontend/composables/use-snapshot-recorder.js';
import { emitAppEvent, onAppEvent } from '../frontend/utils/app-events.js';
import {
    SNAPSHOTS_STORAGE_KEY, MAX_KEPT_SNAPSHOTS, restoreStore,
} from '../frontend/utils/features/snapshots.js';

const memoryStorage = (initial = {}) => ({
    data: { ...initial },
    failWrites: false,
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) {
        if (this.failWrites) throw new Error('QuotaExceededError');
        this.data[key] = String(value);
    },
});

// Event payloads as the homepage components emit them.
// Each card (id `card<index>`): an IP (source `src<index>`) or [source, ip];
// 'error' = a failed card.
const ipinfoPayload = (...cards) => ({
    cards: cards.map((card, i) => {
        const [source, ip] = Array.isArray(card) ? card : [`src${i}`, card];
        return { id: `card${i}`, source, ip, country_code: 'sg', isp: 'Singtel', asn: 'AS4773' };
    }),
});
const connectivityPayload = (time = 40) => ({
    targets: [{ id: 'google', name: 'Google', statusCode: 'ok', time }],
});
const speedPayload = (down) => ({ downloadSpeed: down, uploadSpeed: 20, latency: 10, jitter: 1 });

let scopes = [];
let clock = 0;
const now = () => new Date(Date.parse('2026-11-08T10:00:00.000Z') + (clock += 1) * 1000).toISOString();
let ids = 0;
const makeId = () => `id${(ids += 1)}`;

const start = ({ storage = memoryStorage(), prefs = {} } = {}) => {
    const store = reactive({ userPreferences: { snapshotsAuto: 'every', snapshotsLabelCard: 1, ...prefs } });
    const scope = effectScope();
    scope.run(() => useSnapshotRecorder({ store, storage, now, makeId }));
    scopes.push(scope);
    return { store, storage, api: useSnapshots() };
};

// A new page load: module session state reset, storage kept.
const reload = (storage, prefs) => {
    scopes.forEach((scope) => scope.stop());
    scopes = [];
    resetSnapshots();
    return start({ storage, prefs });
};

// A page load that resolves with this ipinfo result.
const visit = (storage, payload, prefs) => {
    const session = reload(storage, prefs);
    emitAppEvent('ipinfo:finished', payload);
    return session;
};

const stored = (storage) => restoreStore(storage.data[SNAPSHOTS_STORAGE_KEY]).snapshots;

beforeEach(() => {
    resetSnapshots();
    ids = 0;
});

afterEach(() => {
    scopes.forEach((scope) => scope.stop());
    scopes = [];
    resetSnapshots();
});

describe('snapshot recorder — session', () => {
    it('creates the session snapshot on the first ipinfo:finished and persists it', () => {
        const { storage, api } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(api.snapshots.value.length, 1);
        const [snapshot] = stored(storage);
        assert.equal(snapshot.id, 'id1');
        assert.equal(snapshot.firstSeenAt, snapshot.lastSeenAt);
        for (const key of ['ips', 'visits', 'sealed']) assert.equal(key in snapshot, false, key);
        assert.equal(snapshot.sections.ipinfo.cards[0].countryCode, 'SG');
        assert.ok(snapshot.sections.ipinfo.testedAt);
        assert.equal(api.currentId.value, 'id1');
        assert.equal(api.createdThisSession.value, true);
    });

    it('later ipinfo runs in the same session update it in place, whatever the IPs', () => {
        const { storage, api } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const created = stored(storage)[0];
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1')); // card refresh / full refresh / source change
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id1'], 'nothing created');
        assert.ok(list[0].lastSeenAt > created.lastSeenAt, 'lastSeenAt moves');
        assert.equal(list[0].firstSeenAt, created.firstSeenAt);
        assert.deepEqual(list[0].sections.ipinfo.cards.map((c) => c.ip), ['1.1.1.1'], 'latest wins');
        assert.equal(api.currentId.value, 'id1');
    });

    it('a second session with the same IP creates a second snapshot and leaves the first as stored', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        const first = storage.data[SNAPSHOTS_STORAGE_KEY];
        const firstSnapshot = stored(storage)[0];
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(90));
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
        assert.deepEqual(list[1], firstSnapshot, 'the first session\'s snapshot is untouched');
        assert.equal(JSON.stringify(list[1]), JSON.stringify(restoreStore(first).snapshots[0]));
        assert.equal(list[0].sections.connectivity.targets[0].timeMs, 90);
        assert.equal(api.currentId.value, 'id2');
        assert.equal(api.createdThisSession.value, true);
    });

    it('a pinned snapshot of an earlier session stays as it was', () => {
        const storage = memoryStorage();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'));
        api.keep('id1');
        const pinned = stored(storage)[0];
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload());
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
        assert.deepEqual(list[1], pinned);
    });

    it('a session before any ipinfo result creates nothing', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        reload(storage);
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.deepEqual(stored(storage).map((s) => s.id), ['id1']);
        assert.equal(stored(storage)[0].sections.connectivity, undefined);
    });
});

describe('snapshot recorder — sections', () => {
    it('buffers sections that arrive before ipinfo, then files them', () => {
        const { storage } = start();
        emitAppEvent('connectivity:finished', connectivityPayload());
        emitAppEvent('speedtest:finished', speedPayload(100));
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined, 'nothing written yet');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const [snapshot] = stored(storage);
        assert.deepEqual(Object.keys(snapshot.sections).sort(), ['connectivity', 'ipinfo', 'speedtest']);
    });

    it('a new session buffers into its own snapshot, never the previous one', () => {
        const { storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('speedtest:finished', speedPayload(100));
        reload(storage);
        emitAppEvent('speedtest:finished', speedPayload(300));
        assert.equal(stored(storage)[0].sections.speedtest.downloadMbps, 100, 'buffered until ipinfo');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
        assert.equal(list[0].sections.speedtest.downloadMbps, 300);
        assert.equal(list[1].sections.speedtest.downloadMbps, 100);
    });

    it('later sections overwrite the current snapshot in place (latest wins) and move lastSeenAt', () => {
        const { storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const created = stored(storage)[0];
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        const afterFirst = stored(storage)[0].lastSeenAt;
        emitAppEvent('connectivity:finished', connectivityPayload(90));
        const [snapshot] = stored(storage);
        assert.equal(snapshot.sections.connectivity.targets[0].timeMs, 90);
        assert.ok(afterFirst > created.lastSeenAt);
        assert.ok(snapshot.lastSeenAt > afterFirst);
        assert.equal(snapshot.lastSeenAt, snapshot.sections.connectivity.testedAt);
        assert.equal(snapshot.firstSeenAt, created.firstSeenAt);
    });

    it('records only the five homepage sections and skips empty builder results', () => {
        const { storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('ruletest:finished', { workers: [{ id: 1, ip: '1.2.3.4', country_code: 'US' }] });
        emitAppEvent('speedtest:finished', {});
        emitAppEvent('ipinfo:finished', { cards: [{ source: 'x', ip: 'error' }] });
        const snapshots = stored(storage);
        assert.equal(snapshots.length, 1);
        assert.deepEqual(Object.keys(snapshots[0].sections), ['ipinfo']);
    });

    it('writes nothing automatically while snapshotsAuto is off, but still buffers', () => {
        const { storage, store } = start({ prefs: { snapshotsAuto: false } });
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined);
        store.userPreferences.snapshotsAuto = 'every';
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.deepEqual(Object.keys(stored(storage)[0].sections).sort(), ['connectivity', 'ipinfo']);
    });

    it('off → every mid-load creates on the next result, from the current ipinfo', () => {
        const { storage, store, api } = start({ prefs: { snapshotsAuto: 'off' } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        store.userPreferences.snapshotsAuto = 'every';
        emitAppEvent('connectivity:finished', connectivityPayload());
        const [snapshot] = stored(storage);
        assert.deepEqual(snapshot.sections.ipinfo.cards.map((c) => c.ip), ['1.1.1.1']);
        assert.ok(snapshot.sections.connectivity);
        assert.equal(api.currentId.value, snapshot.id);
    });

    it('stops listening when its scope is disposed', () => {
        const { storage } = start();
        scopes.forEach((scope) => scope.stop());
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined);
    });
});

describe('snapshot recorder — smart mode', () => {
    const SMART = { snapshotsAuto: 'smart' };
    const webrtcPayload = (ip) => ({ servers: [{ id: 'google', url: 'stun:stun.l.google.com', ip, natTypeCode: 'srflx', country_code: 'sg', org: 'Singtel' }] });
    const dnsPayload = (ip, org = 'Singtel') => ({ providers: [{ id: 'p1', name: 'P1', ip, country_code: 'sg', org }] });

    // A first load (always recorded) with ipinfo, connectivity, webrtc and dnsleak.
    const seeded = () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
        emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9'));
        return storage;
    };

    it('always records the first snapshot, at the first ipinfo', () => {
        const { storage, api } = start({ prefs: SMART });
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined, 'no ipinfo yet');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.deepEqual(Object.keys(stored(storage)[0].sections).sort(), ['connectivity', 'ipinfo']);
        assert.equal(api.currentId.value, 'id1');
        assert.equal(api.skippedThisSession.value, false);
    });

    it('records nothing for an unchanged load and leaves the previous snapshot as stored', () => {
        const storage = seeded();
        const before = storage.data[SNAPSHOTS_STORAGE_KEY];
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        emitAppEvent('connectivity:finished', connectivityPayload(55)); // small drift
        emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
        emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.10')); // resolver IP rotation
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], before);
        assert.equal(api.currentId.value, null);
        assert.equal(api.createdThisSession.value, false);
        assert.equal(api.skippedThisSession.value, true);
        assert.equal(api.canTakeSnapshot.value, true);
    });

    it('creates on the first firing result, with every buffered section, then updates in place', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        emitAppEvent('connectivity:finished', connectivityPayload(45));
        assert.equal(stored(storage).length, 1);
        emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9', 'Quad9'));
        let list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
        assert.deepEqual(Object.keys(list[0].sections).sort(), ['connectivity', 'dnsleak', 'ipinfo']);
        assert.equal(list[0].sections.connectivity.targets[0].timeMs, 45);
        assert.equal(api.currentId.value, 'id2');
        assert.equal(api.skippedThisSession.value, false);
        const older = list[1];
        // From here on, as 'every': unchanged results update it in place.
        emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(50));
        list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
        assert.equal(list[0].sections.connectivity.targets[0].timeMs, 50);
        assert.ok(list[0].sections.webrtc);
        assert.deepEqual(list[1], older);
    });

    it('an ipinfo change creates it; sections before ipinfo wait for it', () => {
        const storage = seeded();
        visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        reload(storage, SMART);
        emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9', 'Quad9'));
        assert.equal(stored(storage).length, 1, 'no ipinfo yet');
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        const [snapshot] = stored(storage);
        assert.equal(snapshot.id, 'id2');
        assert.deepEqual(Object.keys(snapshot.sections).sort(), ['dnsleak', 'ipinfo']);
    });

    it('a speed test always records', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        assert.equal(api.skippedThisSession.value, true);
        emitAppEvent('speedtest:finished', speedPayload(100));
        assert.equal(stored(storage)[0].sections.speedtest.downloadMbps, 100);
        assert.equal(api.currentId.value, 'id2');
        assert.equal(api.skippedThisSession.value, false);
    });

    it('compares with the newest snapshot, a manual one included', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('1.1.1.1'), SMART); // fires: id2
        api.remove('id2');
        api.takeSnapshot(); // id3, the new IP
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        assert.deepEqual(stored(storage).map((s) => s.id), ['id3', 'id1'], 'same as the manual one');
        assert.equal(api.currentId.value, null);
    });

    it('a manual save hides the skipped note for the rest of the session', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
        assert.equal(api.skippedThisSession.value, true);
        api.takeSnapshot(); // id2: ipinfo + webrtc
        assert.equal(api.skippedThisSession.value, false);
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(api.currentId.value, null, 'nothing notable against the manual copy');
        assert.equal(api.skippedThisSession.value, false);
        emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9')); // the manual copy has none
        assert.equal(api.currentId.value, 'id3');
    });

    it('a skipped check syncs the list from storage another tab wrote', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        const other = restoreStore(storage.data[SNAPSHOTS_STORAGE_KEY]);
        const written = JSON.stringify({ ...other, snapshots: [{ ...other.snapshots[0], id: 'tabB' }, ...other.snapshots] });
        storage.data[SNAPSHOTS_STORAGE_KEY] = written;
        emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
        assert.equal(api.skippedThisSession.value, true);
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], written, 'nothing written');
        assert.deepEqual(api.snapshots.value.map((s) => s.id), ['tabB', 'id1']);
    });

    it('off → smart mid-load records the current ipinfo when a speed test lands', () => {
        const storage = seeded();
        const { api, store } = visit(storage, ipinfoPayload('8.8.8.8'), { snapshotsAuto: 'off' });
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        assert.equal(stored(storage).length, 1);
        store.userPreferences.snapshotsAuto = 'smart';
        emitAppEvent('speedtest:finished', speedPayload(100));
        const [snapshot] = stored(storage);
        assert.equal(snapshot.id, 'id2');
        assert.deepEqual(snapshot.sections.ipinfo.cards.map((c) => c.ip), ['1.1.1.1']);
        assert.equal(snapshot.sections.speedtest.downloadMbps, 100);
        assert.equal(api.currentId.value, 'id2');
    });

    describe('multi-round connectivity', () => {
        const round = (time, settled) => ({ ...connectivityPayload(time), settled });

        it('an unsettled pass never takes part in the check, whichever result runs it', () => {
            const storage = seeded();
            const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
            emitAppEvent('connectivity:finished', round(400, false)); // x10 on a cold round
            emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
            assert.equal(api.currentId.value, null);
            emitAppEvent('connectivity:finished', round(45, true));
            emitAppEvent('connectivity:finished', round(400, false)); // a new run's round 1
            emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9'));
            assert.equal(api.currentId.value, null);
            assert.equal(stored(storage).length, 1);
            emitAppEvent('connectivity:finished', round(400, true));
            const [snapshot] = stored(storage);
            assert.equal(snapshot.id, 'id2');
            assert.equal(snapshot.sections.connectivity.targets[0].timeMs, 400);
        });

        it('another firing result files the buffered unsettled pass with it', () => {
            const storage = seeded();
            visit(storage, ipinfoPayload('8.8.8.8'), SMART);
            emitAppEvent('connectivity:finished', round(400, false));
            emitAppEvent('dnsleak:finished', dnsPayload('9.9.9.9', 'Quad9'));
            const [snapshot] = stored(storage);
            assert.equal(snapshot.id, 'id2');
            assert.equal(snapshot.sections.connectivity.targets[0].timeMs, 400);
        });

        it('a connectivity section the previous snapshot lacks fires only once settled', () => {
            const storage = memoryStorage();
            visit(storage, ipinfoPayload('8.8.8.8'), SMART); // id1: no connectivity
            emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
            const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
            emitAppEvent('webrtc:finished', webrtcPayload('8.8.8.8'));
            emitAppEvent('connectivity:finished', round(40, false));
            assert.equal(api.currentId.value, null);
            assert.equal(stored(storage).length, 1);
            emitAppEvent('connectivity:finished', round(45, true));
            const [snapshot] = stored(storage);
            assert.equal(snapshot.id, 'id2');
            assert.equal(snapshot.sections.connectivity.targets[0].timeMs, 45);
        });

        it('a payload without settled counts as settled', () => {
            const storage = seeded();
            visit(storage, ipinfoPayload('8.8.8.8'), SMART);
            emitAppEvent('connectivity:finished', connectivityPayload(400));
            assert.equal(stored(storage)[0].id, 'id2');
        });

        it('unsettled rounds update the session snapshot in place once it exists', () => {
            const storage = seeded();
            const { api } = visit(storage, ipinfoPayload('1.1.1.1'), SMART); // fires: id2
            emitAppEvent('connectivity:finished', round(90, false));
            emitAppEvent('connectivity:finished', round(70, false));
            const list = stored(storage);
            assert.deepEqual(list.map((s) => s.id), ['id2', 'id1']);
            assert.equal(list[0].sections.connectivity.targets[0].timeMs, 70);
            assert.equal(api.currentId.value, 'id2');
        });
    });

    it('removing the session snapshot leaves the load undecided, with an empty buffer', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        emitAppEvent('speedtest:finished', speedPayload(100)); // id2
        api.remove('id2');
        assert.equal(api.skippedThisSession.value, false);
        emitAppEvent('connectivity:finished', connectivityPayload(45));
        assert.deepEqual(stored(storage).map((s) => s.id), ['id1'], 'waits for an ipinfo');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.deepEqual(stored(storage).map((s) => s.id), ['id1'], 'nothing notable against id1');
        assert.equal(api.skippedThisSession.value, true);
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        const [snapshot] = stored(storage);
        assert.equal(snapshot.id, 'id3');
        assert.deepEqual(Object.keys(snapshot.sections).sort(), ['connectivity', 'ipinfo']);
    });

    it('treats the old boolean true as smart', () => {
        const storage = seeded();
        const { api } = visit(storage, ipinfoPayload('8.8.8.8'), { snapshotsAuto: true });
        assert.equal(stored(storage).length, 1);
        assert.equal(api.skippedThisSession.value, true);
    });

    it('\'every\' records an unchanged load; \'off\' and false record nothing', () => {
        const storage = seeded();
        const every = visit(storage, ipinfoPayload('8.8.8.8'), { snapshotsAuto: 'every' });
        assert.equal(stored(storage).length, 2);
        assert.equal(every.api.skippedThisSession.value, false);
        for (const snapshotsAuto of ['off', false]) {
            const { api } = visit(storage, ipinfoPayload('1.1.1.1'), { snapshotsAuto });
            emitAppEvent('speedtest:finished', speedPayload(100));
            assert.equal(stored(storage).length, 2, String(snapshotsAuto));
            assert.equal(api.skippedThisSession.value, false);
        }
    });

    it('the skipped flag follows the mode', () => {
        const storage = seeded();
        const { api, store } = visit(storage, ipinfoPayload('8.8.8.8'), SMART);
        assert.equal(api.skippedThisSession.value, true);
        store.userPreferences.snapshotsAuto = 'off';
        assert.equal(api.skippedThisSession.value, false);
    });
});

describe('snapshot recorder — storage', () => {
    it('prunes unkept snapshots past snapshotsKeepLast, kept ones survive', () => {
        const storage = memoryStorage();
        const prefs = { snapshotsKeepLast: 10 };
        const { api } = visit(storage, ipinfoPayload('1.0.0.1'), prefs);
        api.keep('id1');
        for (let i = 2; i <= 12; i += 1) visit(storage, ipinfoPayload(`1.0.0.${i}`), prefs);
        const list = stored(storage);
        assert.equal(list.length, 11);
        assert.equal(list.at(-1).id, 'id1');
        assert.equal(list.some((s) => s.id === 'id2'), false);
    });

    it('applies a smaller keepLast at once', () => {
        const storage = memoryStorage();
        for (let i = 1; i <= 15; i += 1) visit(storage, ipinfoPayload(`1.0.0.${i}`));
        const { store } = reload(storage);
        store.userPreferences.snapshotsKeepLast = 10;
        assert.equal(stored(storage).length, 10);
    });

    it('treats storage as untrusted: garbage starts empty, never throws', () => {
        const storage = memoryStorage({ [SNAPSHOTS_STORAGE_KEY]: '{not json' });
        const { api } = start({ storage });
        assert.deepEqual(api.snapshots.value, []);
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(stored(storage).length, 1);
    });

    it('survives a storage that throws on read', () => {
        const storage = { getItem() { throw new Error('SecurityError'); }, setItem() {} };
        const { api } = start({ storage });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(api.snapshots.value.length, 1);
    });

    it('flags a failed write and keeps recording in memory', () => {
        const storage = memoryStorage();
        storage.failWrites = true;
        const { api } = start({ storage });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.equal(api.storageFailed.value, true);
        assert.equal(api.isPersisting(), false);
        assert.deepEqual(Object.keys(api.snapshots.value[0].sections).sort(), ['connectivity', 'ipinfo']);
        storage.failWrites = false;
        emitAppEvent('speedtest:finished', speedPayload(100));
        assert.equal(api.storageFailed.value, false);
        assert.equal(api.isPersisting(), true);
        assert.equal(Object.keys(stored(storage)[0].sections).length, 3);
    });

    it('builds on what another tab stored', () => {
        const storage = memoryStorage();
        start({ storage });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        // Another tab files a different network meanwhile.
        const other = restoreStore(storage.data[SNAPSHOTS_STORAGE_KEY]);
        const foreign = { ...other.snapshots[0], id: 'tabB', sections: { ipinfo: { ...other.snapshots[0].sections.ipinfo, cards: [{ source: 'x', ip: '1.1.1.1' }] } } };
        storage.data[SNAPSHOTS_STORAGE_KEY] = JSON.stringify({ ...other, snapshots: [foreign, ...other.snapshots] });
        emitAppEvent('connectivity:finished', connectivityPayload());
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['tabB', 'id1']);
        assert.ok(list[1].sections.connectivity);
    });
});

describe('useSnapshots — actions', () => {
    it('previousOf returns the next older snapshot', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        const { api } = visit(storage, ipinfoPayload('1.1.1.1'));
        assert.equal(api.previousOf('id2').id, 'id1');
        assert.equal(api.previousOf('id1'), null);
        assert.equal(api.previousOf('nope'), null);
    });

    it('rename and keep persist; keep refuses past the cap', () => {
        const storage = memoryStorage();
        const prefs = { snapshotsKeepLast: 50 };
        for (let i = 1; i <= MAX_KEPT_SNAPSHOTS + 1; i += 1) visit(storage, ipinfoPayload(`1.0.0.${i}`), prefs);
        const { api } = reload(storage, prefs);
        api.rename('id1', ' Home ');
        assert.equal(stored(storage).find((s) => s.id === 'id1').name, 'Home');
        for (let i = 1; i <= MAX_KEPT_SNAPSHOTS; i += 1) assert.equal(api.keep(`id${i}`), true);
        assert.equal(api.keep(`id${MAX_KEPT_SNAPSHOTS + 1}`), false);
        assert.equal(stored(storage).filter((s) => s.kept).length, MAX_KEPT_SNAPSHOTS);
        assert.equal(api.keep('id1', false), true);
    });

    it('removing the current snapshot buffers later sections until the next ipinfo', () => {
        const { storage, api } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        api.remove('id1');
        assert.equal(api.currentId.value, null);
        assert.deepEqual(stored(storage), []);
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.deepEqual(stored(storage), []);
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.deepEqual(Object.keys(stored(storage)[0].sections).sort(), ['connectivity', 'ipinfo']);
    });

    it('after removing the current snapshot the next ipinfo creates a new one, never touching older ones', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        const older = stored(storage)[0];
        const { api } = visit(storage, ipinfoPayload('8.8.8.8')); // id2, current
        api.remove('id2');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id3', 'id1']);
        assert.deepEqual(list[1], older);
        assert.equal(api.currentId.value, 'id3');
    });
});

describe('snapshot recorder — label card', () => {
    it('records the card at snapshotsLabelCard, else the first card with a valid IP', () => {
        const { storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('error', '8.8.8.8', '1.1.1.1'));
        assert.equal(stored(storage)[0].labelCardId, 'card1', 'card 1 has no valid IP');
        visit(storage, ipinfoPayload('9.9.9.9', '8.8.8.8', '2.2.2.2'), { snapshotsLabelCard: 3 });
        assert.equal(stored(storage)[0].labelCardId, 'card2');
        visit(storage, ipinfoPayload('9.9.9.9', '8.8.8.8'), { snapshotsLabelCard: 5 });
        assert.equal(stored(storage)[0].labelCardId, 'card0', 'out of range');
    });

    it('keeps the label card the snapshot was created with through in-place updates', () => {
        const { storage, store } = start({ prefs: { snapshotsLabelCard: 2 } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8', '1.1.1.1'));
        store.userPreferences.snapshotsLabelCard = 1;
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8', ['fallback', '1.1.1.1'])); // provider fallback
        const list = stored(storage);
        assert.equal(list.length, 1);
        assert.equal(list[0].labelCardId, 'card1');
        assert.deepEqual(list[0].sections.ipinfo.cards.map((card) => [card.id, card.source]),
            [['card0', 'src0'], ['card1', 'fallback']]);
    });

    it('a manual snapshot follows the same rule, from the latest ipinfo cards', () => {
        const { api, storage } = start({ prefs: { snapshotsAuto: false, snapshotsLabelCard: 2 } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8', '1.1.1.1'));
        api.takeSnapshot();
        assert.equal(stored(storage)[0].labelCardId, 'card1');
    });
});

describe('useSnapshots — takeSnapshot', () => {
    it('returns null before any ipinfo result', () => {
        const { api, storage } = start();
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.equal(api.canTakeSnapshot.value, false);
        assert.equal(api.takeSnapshot(), null);
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined);
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        assert.equal(api.canTakeSnapshot.value, true);
    });

    it('files the live sections as a new snapshot; the automatic one stays current', () => {
        const { api, storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        emitAppEvent('speedtest:finished', speedPayload(100));
        const id = api.takeSnapshot({ name: '  Before VPN  ' });
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), [id, 'id1']);
        assert.equal(list[0].name, 'Before VPN');
        assert.deepEqual(Object.keys(list[0].sections).sort(), ['connectivity', 'ipinfo', 'speedtest']);
        assert.equal(api.currentId.value, 'id1');
    });

    it('later results update the automatic snapshot, never the manual one', () => {
        const { api, storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        const id = api.takeSnapshot();
        const manual = stored(storage)[0];
        emitAppEvent('connectivity:finished', connectivityPayload(90));
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        let list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), [id, 'id1']);
        assert.deepEqual(list[0], manual, 'the manual snapshot is frozen');
        assert.equal(list[1].sections.connectivity.targets[0].timeMs, 90);
        assert.deepEqual(list[1].sections.ipinfo.cards.map((c) => c.ip), ['1.1.1.1']);
        assert.equal(api.currentId.value, 'id1');
        const later = api.takeSnapshot();
        list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), [later, id, 'id1']);
        assert.equal(list[0].sections.connectivity.targets[0].timeMs, 90);
        assert.equal(list[1].sections.connectivity.targets[0].timeMs, 40);
    });

    it('a manual save before the session has its snapshot does not take its place', () => {
        const { api, storage } = start();
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        api.remove('id1'); // the session is undecided again
        const id = api.takeSnapshot();
        assert.equal(api.currentId.value, null);
        emitAppEvent('connectivity:finished', connectivityPayload(90));
        assert.equal(stored(storage)[0].sections.connectivity, undefined, 'buffered, not filed into the manual one');
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const list = stored(storage);
        assert.deepEqual(list.map((s) => s.id), ['id3', id]);
        assert.equal(list[0].sections.connectivity.targets[0].timeMs, 90);
        assert.equal(api.currentId.value, 'id3');
    });

    it('works with snapshotsAuto off, from the live sections; nothing is recorded automatically', () => {
        const { api, storage } = start({ prefs: { snapshotsAuto: false } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        emitAppEvent('dnsleak:finished', { providers: [{ id: 'p1', name: 'P1', ip: '9.9.9.9', country_code: 'us', org: 'Quad9' }] });
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], undefined);
        const id = api.takeSnapshot();
        const [snapshot] = stored(storage);
        assert.equal(snapshot.id, id);
        assert.equal(snapshot.name, '');
        assert.deepEqual(Object.keys(snapshot.sections).sort(), ['dnsleak', 'ipinfo']);
        assert.equal(api.currentId.value, null);
        const frozen = storage.data[SNAPSHOTS_STORAGE_KEY];
        emitAppEvent('connectivity:finished', connectivityPayload());
        assert.equal(storage.data[SNAPSHOTS_STORAGE_KEY], frozen);
    });

    it('prunes after a manual snapshot', () => {
        const { api, storage } = start({ prefs: { snapshotsKeepLast: 10 } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        for (let i = 0; i < 12; i += 1) api.takeSnapshot();
        assert.equal(stored(storage).length, 10);
    });
});

describe('snapshot recorder — snapshot:created', () => {
    let events;
    let off;
    beforeEach(() => {
        events = [];
        off = onAppEvent('snapshot:created', (payload) => events.push(payload));
    });
    afterEach(() => off());

    it('every automatic snapshot announces itself once; in-place updates do not', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1')); // same session: in place
        assert.deepEqual(events, [{ id: 'id1', auto: true }]);
        visit(storage, ipinfoPayload('8.8.8.8'));
        assert.deepEqual(events, [{ id: 'id1', auto: true }, { id: 'id2', auto: true }]);
    });

    it('a manual snapshot announces itself with auto: false', () => {
        const { api } = start({ prefs: { snapshotsAuto: false } });
        emitAppEvent('ipinfo:finished', ipinfoPayload('8.8.8.8'));
        const first = api.takeSnapshot();
        const second = api.takeSnapshot();
        assert.deepEqual(events, [{ id: first, auto: false }, { id: second, auto: false }]);
    });
});

describe('snapshot recorder — snapshot:changed', () => {
    const dnsPayload = (org) => ({ providers: [{ id: 'p1', name: 'P1', ip: '9.9.9.9', country_code: 'sg', org }] });
    const webrtcPayload = () => ({ servers: [{ id: 'google', url: 'stun:stun.l.google.com', ip: '8.8.8.8', natTypeCode: 'srflx', country_code: 'sg', org: 'Singtel' }] });
    let events;
    let off;
    beforeEach(() => {
        events = [];
        off = onAppEvent('snapshot:changed', (payload) => events.push(payload));
    });
    afterEach(() => off());

    it('needs a previous snapshot', () => {
        visit(memoryStorage(), ipinfoPayload('8.8.8.8'));
        emitAppEvent('dnsleak:finished', dnsPayload('Singtel'));
        assert.deepEqual(events, []);
    });

    it('announces each changed section once, with every one changed so far', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('dnsleak:finished', dnsPayload('Singtel'));
        visit(storage, ipinfoPayload('1.1.1.1'));
        assert.deepEqual(events, [{ id: 'id2', sections: ['ipinfo'] }]);
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.2'));
        emitAppEvent('dnsleak:finished', dnsPayload('Quad9'));
        assert.deepEqual(events, [{ id: 'id2', sections: ['ipinfo'] }, { id: 'id2', sections: ['ipinfo', 'dnsleak'] }]);
    });

    it('a section the previous snapshot lacks is no change', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('webrtc:finished', webrtcPayload());
        assert.deepEqual(events, []);
    });

    it('leaves an unsettled connectivity pass out', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', connectivityPayload(40));
        visit(storage, ipinfoPayload('8.8.8.8'));
        emitAppEvent('connectivity:finished', { ...connectivityPayload(400), settled: false });
        assert.deepEqual(events, []);
        emitAppEvent('connectivity:finished', { ...connectivityPayload(400), settled: true });
        assert.deepEqual(events, [{ id: 'id2', sections: ['connectivity'] }]);
    });

    it('a snapshot replacing the removed session one announces afresh', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'));
        const { api } = visit(storage, ipinfoPayload('1.1.1.1'));
        api.remove('id2');
        emitAppEvent('ipinfo:finished', ipinfoPayload('1.1.1.1'));
        assert.deepEqual(events, [{ id: 'id2', sections: ['ipinfo'] }, { id: 'id3', sections: ['ipinfo'] }]);
    });

    it('comes with the snapshot a smart change creates; nothing while off', () => {
        const storage = memoryStorage();
        visit(storage, ipinfoPayload('8.8.8.8'), { snapshotsAuto: 'smart' });
        visit(storage, ipinfoPayload('1.1.1.1'), { snapshotsAuto: 'off' });
        assert.deepEqual(events, []);
        visit(storage, ipinfoPayload('1.1.1.1'), { snapshotsAuto: 'smart' });
        assert.deepEqual(events, [{ id: 'id2', sections: ['ipinfo'] }]);
    });
});
