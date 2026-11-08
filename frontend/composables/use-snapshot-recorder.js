// Snapshot recorder: files the homepage tests' results into snapshots in
// localStorage (model in utils/features/snapshots.js). It subscribes to the
// five homepage events on the app bus, runs each payload through its report
// builder and keeps the session's latest sections live. A session is one
// App setup (a page load) and, with `snapshotsAuto` on, gets one automatic
// snapshot: its first `ipinfo:finished` creates it (sections arriving before
// that wait in a buffer), and every later result of the session — ipinfo
// re-runs included — overwrites it in place and moves its lastSeenAt.
// Nothing is merged across sessions. Removing the session's snapshot leaves
// it undecided again: the next `ipinfo:finished` creates a new one.
// `takeSnapshot` files the live sections as a manual snapshot, which never
// becomes the session's one and so never changes. A new snapshot records
// its label card (`labelCardId`, from `snapshotsLabelCard`); every creation
// emits `snapshot:created`. `useSnapshotRecorder` is called once at App
// level; `useSnapshots` is the read / action API over the same state.

import { reactive, computed, watch, onScopeDispose } from 'vue';
import { onAppEvent, emitAppEvent } from '../utils/app-events.js';
import { REPORT_EVENT_BUILDERS } from '../utils/report/report-builders.js';
import {
    SNAPSHOTS_STORAGE_KEY, HOME_SECTION_IDS, SNAPSHOT_NAME_MAX,
    restoreStore, createEmptyStore, createSnapshot, applySection, labelCardIdOf, touchSnapshot, addSnapshot,
    replaceSnapshot, pruneStore, clampKeepLast, findSnapshot, renameSnapshot, keepSnapshot, removeSnapshot,
} from '../utils/features/snapshots.js';

// --- module state -----------------------------------------------------------

const state = reactive({
    store: createEmptyStore(),
    currentId: null,
    createdThisSession: false,
    storageFailed: false,
    hasLiveIpinfo: false, // takeSnapshot has something to file
});

let storage = null;
let live = {}; // section id → this session's latest section
let liveCards = []; // the latest ipinfo event's cards, in homepage order
let buffered = {}; // section id → section, waiting for the session's snapshot
let prefs = () => ({});
let clock = () => new Date().toISOString();
let nextId = () => '';

// Merely touching localStorage throws in some privacy modes.
const defaultStorage = () => {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
};

const defaultId = () => globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Storage may have moved on in another tab; read it before every change,
// unless it refuses writes and memory is the only current copy.
const latest = () => {
    if (!storage || state.storageFailed) return state.store;
    try {
        return restoreStore(storage.getItem(SNAPSHOTS_STORAGE_KEY));
    } catch {
        return state.store;
    }
};

const commit = (next) => {
    state.store = next;
    if (!storage) return;
    try {
        storage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
        state.storageFailed = false;
    } catch {
        state.storageFailed = true; // quota / privacy mode: kept in memory only
    }
};

const prune = (store) => pruneStore(store, prefs().snapshotsKeepLast);

// Adds a snapshot holding `sections` at the front, prunes, and announces it.
// Only an automatic one becomes the session's snapshot.
const create = (store, sections, { now, name = '', auto }) => {
    const labelCardId = labelCardIdOf(liveCards, prefs().snapshotsLabelCard);
    let snapshot = { ...createSnapshot({ id: nextId(), now, labelCardId }), name };
    for (const [id, section] of Object.entries(sections)) snapshot = applySection(snapshot, id, section);
    if (auto) {
        state.currentId = snapshot.id;
        state.createdThisSession = true;
        buffered = {};
    }
    commit(prune(addSnapshot(store, snapshot)).store);
    emitAppEvent('snapshot:created', { id: snapshot.id, auto });
    return snapshot.id;
};

// --- recording --------------------------------------------------------------

const HOME_EVENTS = Object.keys(REPORT_EVENT_BUILDERS)
    .filter((event) => HOME_SECTION_IDS.includes(REPORT_EVENT_BUILDERS[event].section));

// Latest wins; an in-session update is the snapshot's latest change.
const updateInPlace = (store, current, id, section, now) =>
    replaceSnapshot(store, applySection(touchSnapshot(current, now), id, section));

const currentOf = (store) => (state.currentId ? findSnapshot(store, state.currentId) : null);

// The session's snapshot: updated once it exists, created by the first ipinfo.
const recordIpinfo = (section, now) => {
    const store = latest();
    const current = currentOf(store);
    if (current) commit(updateInPlace(store, current, 'ipinfo', section, now));
    else create(store, { ...buffered, ipinfo: section }, { now, auto: true });
};

const recordSection = (id, section, now) => {
    const store = latest();
    const current = currentOf(store);
    if (current) commit(updateInPlace(store, current, id, section, now));
    else buffered[id] = section;
};

export const useSnapshotRecorder = ({
    store, storage: injected = defaultStorage(), now = () => new Date().toISOString(), makeId = defaultId,
}) => {
    storage = injected;
    prefs = () => store.userPreferences ?? {};
    clock = now;
    nextId = makeId;
    const auto = () => prefs().snapshotsAuto !== false;

    const { store: loaded, removed } = prune(latest());
    if (removed.length) commit(loaded);
    else state.store = loaded;

    const unsubscribes = HOME_EVENTS.map((event) => onAppEvent(event, (payload) => {
        const { section: id, build } = REPORT_EVENT_BUILDERS[event];
        const built = build(payload);
        if (built === null) return;
        const testedAt = clock();
        const section = { testedAt, ...built };
        live[id] = section;
        if (id === 'ipinfo') {
            state.hasLiveIpinfo = true;
            liveCards = Array.isArray(payload?.cards) ? payload.cards : [];
        }
        if (!auto()) return;
        if (id === 'ipinfo') recordIpinfo(section, testedAt);
        else recordSection(id, section, testedAt);
    }));

    // A changed retention applies at once.
    const stopWatch = watch(() => clampKeepLast(prefs().snapshotsKeepLast), () => {
        const { store: next, removed: dropped } = prune(latest());
        if (dropped.length) commit(next);
    }, { flush: 'sync' });

    onScopeDispose(() => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
        stopWatch();
    });
};

// --- read / action API ------------------------------------------------------

export const useSnapshots = () => {
    const snapshots = computed(() => state.store.snapshots); // newest first

    // The next older snapshot, or null.
    const previousOf = (id) => {
        const list = state.store.snapshots;
        const index = list.findIndex((snapshot) => snapshot.id === id);
        return index === -1 ? null : list[index + 1] ?? null;
    };

    // A manual snapshot of this session's live sections, whatever
    // `snapshotsAuto`; null before the first ipinfo result.
    const takeSnapshot = ({ name } = {}) => {
        if (!live.ipinfo) return null;
        const clean = typeof name === 'string' ? name.trim().slice(0, SNAPSHOT_NAME_MAX) : '';
        return create(latest(), live, { now: clock(), name: clean, auto: false });
    };

    const rename = (id, name) => commit(renameSnapshot(latest(), id, name));

    // False when the kept cap is reached (or the id is gone).
    const keep = (id, kept = true) => {
        const { store, ok } = keepSnapshot(latest(), id, kept);
        if (ok) commit(store);
        return ok;
    };

    // Removing the session's snapshot sends later sections back to the buffer.
    const remove = (id) => {
        commit(removeSnapshot(latest(), id));
        if (state.currentId === id) state.currentId = null;
    };

    return {
        snapshots,
        currentId: computed(() => state.currentId),
        createdThisSession: computed(() => state.createdThisSession),
        storageFailed: computed(() => state.storageFailed),
        canTakeSnapshot: computed(() => state.hasLiveIpinfo),
        previousOf,
        takeSnapshot,
        rename,
        keep,
        remove,
    };
};

// Back to a fresh page session (tests).
export const resetSnapshots = () => {
    state.store = createEmptyStore();
    state.currentId = null;
    state.createdThisSession = false;
    state.storageFailed = false;
    state.hasLiveIpinfo = false;
    storage = null;
    live = {};
    liveCards = [];
    buffered = {};
    prefs = () => ({});
    clock = () => new Date().toISOString();
    nextId = () => '';
};
