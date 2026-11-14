// Snapshot recorder: files the homepage tests' results into snapshots in
// localStorage (model in utils/features/snapshots.js). It subscribes to the
// five homepage events on the app bus, runs each payload through its report
// builder and keeps the session's latest sections live. A session is one
// App setup (a page load) and gets at most one automatic snapshot. Until it
// exists every result waits in a buffer, in any mode, and the
// `snapshotsAuto` mode (snapshotsAutoMode) decides: 'every' — created once
// the buffer holds an ipinfo; 'smart' — from then on each result checks the
// buffer against the newest stored snapshot (utils/features/snapshot-trigger.js)
// until one fires, an unsettled connectivity result (requests still in
// flight or rounds left) left out of the check; 'off' — none.
// Once created, every later result of the session — ipinfo re-runs included
// — overwrites it in place and moves its lastSeenAt. Nothing is merged
// across sessions, and older snapshots are never touched. Removing the
// session's snapshot leaves it undecided again, with an empty buffer.
// `takeSnapshot` files the live sections as a manual snapshot, which never
// becomes the session's one and so never changes; after one, the session
// no longer reports a smart skip. A new snapshot records
// its label card (`labelCardId`, from `snapshotsLabelCard`); every creation
// emits `snapshot:created`. While recording is on, each result also checks
// the session's snapshot against the next older one (notableChanges, an
// unsettled connectivity result left out) and emits `snapshot:changed`
// with every section changed so far, again only when one joins (afresh for
// a snapshot that replaces a removed one).
// `useSnapshotRecorder` is called once at App level; `useSnapshots` is the
// read / action API over the same state.

import { reactive, computed, watch, onScopeDispose } from 'vue';
import { onAppEvent, emitAppEvent } from '../utils/app-events.js';
import { REPORT_EVENT_BUILDERS } from '../utils/report/report-builders.js';
import {
    SNAPSHOTS_STORAGE_KEY, HOME_SECTION_IDS, SNAPSHOT_NAME_MAX, snapshotsAutoMode,
    restoreStore, createEmptyStore, createSnapshot, applySection, labelCardIdOf, touchSnapshot, addSnapshot,
    replaceSnapshot, pruneStore, clampKeepLast, findSnapshot, renameSnapshot, keepSnapshot, removeSnapshot,
} from '../utils/features/snapshots.js';
import { shouldRecordSnapshot, notableChanges } from '../utils/features/snapshot-trigger.js';

// --- module state -----------------------------------------------------------

const state = reactive({
    store: createEmptyStore(),
    currentId: null,
    createdThisSession: false,
    storageFailed: false,
    hasLiveIpinfo: false, // takeSnapshot has something to file
    smartSkipped: false, // smart mode checked this session's results and recorded nothing
    savedThisSession: false, // takeSnapshot ran this session
});

let storage = null;
let live = {}; // section id → this session's latest section
let liveCards = []; // the latest ipinfo event's cards, in homepage order
let buffered = {}; // section id → section, waiting for the session's snapshot
let connectivitySettled = true; // the latest connectivity:finished was settled
let noticed = new Set(); // sections snapshot:changed has announced this session
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
        state.smartSkipped = false;
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

// The sections the smart check sees: an unsettled connectivity result stays
// out until a settled one lands.
const triggerSections = () => {
    if (connectivitySettled || !buffered.connectivity) return buffered;
    const rest = { ...buffered };
    delete rest.connectivity;
    return rest;
};

// The session's snapshot is updated once it exists (not while 'off'). Before
// that every result waits in the buffer, whatever the mode, so a mode switch
// mid-load starts from the current results: 'every' creates it once the
// buffer holds an ipinfo; 'smart' checks the buffer against the newest
// stored snapshot until a result fires.
const record = (id, section, now, mode) => {
    const store = latest();
    const current = currentOf(store);
    if (current) {
        if (mode !== 'off') commit(updateInPlace(store, current, id, section, now));
        return;
    }
    buffered[id] = section;
    if (mode === 'every' && buffered.ipinfo) {
        create(store, buffered, { now, auto: true });
    } else if (mode === 'smart' && buffered.ipinfo
        && shouldRecordSnapshot(store.snapshots[0]?.sections ?? null, triggerSections())) {
        create(store, buffered, { now, auto: true });
    } else {
        state.store = store; // memory only: the list matches what was compared against
        if (mode === 'smart' && buffered.ipinfo) state.smartSkipped = true;
    }
};

// The session's snapshot against the next older one; announces the changed
// sections when a new one joins them.
const noticeChanges = () => {
    const list = state.store.snapshots;
    const index = state.currentId ? list.findIndex((snapshot) => snapshot.id === state.currentId) : -1;
    const previous = index === -1 ? null : list[index + 1];
    if (!previous) return;
    const sections = { ...list[index].sections };
    if (!connectivitySettled) delete sections.connectivity;
    const changed = notableChanges(previous.sections, sections);
    if (changed.every((id) => noticed.has(id))) return;
    changed.forEach((id) => noticed.add(id));
    emitAppEvent('snapshot:changed', {
        id: state.currentId, sections: HOME_SECTION_IDS.filter((id) => noticed.has(id)),
    });
};

export const useSnapshotRecorder = ({
    store, storage: injected = defaultStorage(), now = () => new Date().toISOString(), makeId = defaultId,
}) => {
    storage = injected;
    prefs = () => store.userPreferences ?? {};
    clock = now;
    nextId = makeId;
    const mode = () => snapshotsAutoMode(prefs().snapshotsAuto);

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
        // A payload without `settled` counts as settled.
        if (id === 'connectivity') connectivitySettled = payload?.settled !== false;
        const current = mode();
        record(id, section, testedAt, current);
        if (current !== 'off') noticeChanges();
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

    // A manual snapshot of this session's live sections, whatever the
    // `snapshotsAuto` mode; null before the first ipinfo result.
    const takeSnapshot = ({ name } = {}) => {
        if (!live.ipinfo) return null;
        const clean = typeof name === 'string' ? name.trim().slice(0, SNAPSHOT_NAME_MAX) : '';
        state.savedThisSession = true;
        return create(latest(), live, { now: clock(), name: clean, auto: false });
    };

    const rename = (id, name) => commit(renameSnapshot(latest(), id, name));

    // False when the kept cap is reached (or the id is gone).
    const keep = (id, kept = true) => {
        const { store, ok } = keepSnapshot(latest(), id, kept);
        if (ok) commit(store);
        return ok;
    };

    // Removing the session's snapshot sends later sections back to the buffer;
    // a snapshot created in its place announces its changes afresh.
    const remove = (id) => {
        commit(removeSnapshot(latest(), id));
        if (state.currentId === id) {
            state.currentId = null;
            noticed = new Set();
        }
    };

    // Smart mode found nothing notable in this session's results: it has
    // live IP results but no automatic snapshot, and no manual save either.
    const skippedThisSession = computed(() => state.smartSkipped && state.hasLiveIpinfo && !state.currentId
        && !state.savedThisSession && snapshotsAutoMode(prefs().snapshotsAuto) === 'smart');

    return {
        snapshots,
        currentId: computed(() => state.currentId),
        createdThisSession: computed(() => state.createdThisSession),
        storageFailed: computed(() => state.storageFailed),
        // Snapshots reach localStorage (absent or refusing writes → memory only).
        isPersisting: () => !!storage && !state.storageFailed,
        canTakeSnapshot: computed(() => state.hasLiveIpinfo),
        skippedThisSession,
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
    state.smartSkipped = false;
    state.savedThisSession = false;
    storage = null;
    live = {};
    liveCards = [];
    buffered = {};
    connectivitySettled = true;
    noticed = new Set();
    prefs = () => ({});
    clock = () => new Date().toISOString();
    nextId = () => '';
};
