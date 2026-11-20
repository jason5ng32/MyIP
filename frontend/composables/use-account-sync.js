// Account sync: keeps preferences and Connectivity lists in step with the signed-in account through
// GET / PUT /api/sync (the account's settings: which collections sync) and GET / PUT /api/sync/:collection, one
// engine (utils/features/account-sync.js) over two store-backed adapters (utils/features/preferences-sync.js).
// Mounted once in App.vue. The settings come from this device's cache at once, then from the server; they live in
// `store.syncSettings`. Per collection the account has enabled, two regimes: signed out, the device's data is its
// own (no record, no stamps); signed in, it is the account's — the device holds a copy plus this session's edits not
// yet sent. The first pull of a guest record adopts (an account with items replaces the device; an empty one takes
// the device's data); after that, edits are stamped by hash against the record and pushed after a short pause, and
// pulls merge by stamp. Sign-out sends pending edits (bounded) and clears the account's data off the device; so does
// a boot that finds the session ended. A collection turned off (here, or elsewhere: a 409 `sync_off`) drops its
// record and keeps the data, device-only. A 400 or 404 stops that collection for this page load, a 403 stops all;
// anything else waits for the next change or load. Snapshots, test results and IPs never sync.

import { computed, reactive, readonly, watch, onScopeDispose } from 'vue';
import { authenticatedFetch } from '../utils/authenticated-fetch.js';
import { SYNC_COLLECTIONS, SYNC_OFF_CODE } from '../utils/sync-collections.js';
import {
    readSyncRecord, writeSyncRecord, removeSyncRecord, isOwnRecord, detectLocalChanges, preparePull, readSyncPage,
    mergePull, settleApplied, buildUploadBatches, markRefused, readSyncSave, mergeSave, hashItems, changedSince,
    hasHeldBack,
} from '../utils/features/account-sync.js';
import { SYNC_ITEM_READERS, syncItemDefaults, toPreferenceValues } from '../utils/features/preferences-sync.js';
import {
    createSyncSettings, readSyncSettingsAnswer, readCachedSyncSettings, writeCachedSyncSettings,
    clearCachedSyncSettings, collectionSyncState,
} from '../utils/features/sync-settings.js';
import {
    BEFORE_RELOAD_COMMAND, SIGN_OUT_COMMAND, SET_SYNC_COLLECTIONS_COMMAND, SIGN_OUT_FLUSH_MS,
} from '../utils/features/account-sync-auth.js';
import { useAppCommand } from './use-app-command.js';

export const SYNC_ENDPOINT = '/api/sync';
export const SYNC_PUSH_DELAY_MS = 2000;

// This page load's state per collection, read by the Preferences panel: 'idle' | 'synced' | 'partial' (synced but for
// items the account refused) | 'failed' (the last pull or push did not go through; retried silently) | 'reload' |
// 'stopped'.
const syncState = reactive({ preferences: 'idle', connectivity: 'idle' });
export const useAccountSyncState = () => readonly(syncState);

// console.warn only: console.error is captured by error monitoring, and a failed sync retries later.
const warn = (id, message, error) => console.warn(`Account sync (${id}): ${message}`, error?.status ?? error?.message ?? error);

// Merely touching localStorage throws in some privacy modes.
const defaultStorage = () => {
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
};

/**
 * The two adapters, both over the store (the only writer of userPreferences). `readLocal()` → `{ <id>: value }`;
 * `applyRemote({ upserts, deletes })` writes unstamped (a deleted item goes back to its default); `clearLocal()`
 * resets the collection to a fresh visitor's; `signal()` changes on a local edit.
 */
export const createSyncAdapters = (store) => Object.keys(SYNC_ITEM_READERS).map((id) => ({
    id,
    readLocal: () => SYNC_ITEM_READERS[id](store.userPreferences),
    applyRemote: ({ upserts, deletes }) => {
        const defaults = syncItemDefaults(id);
        const reset = Object.fromEntries(deletes.filter((item) => Object.hasOwn(defaults, item)).map((item) => [item, defaults[item]]));
        store.applySyncedPreferences(toPreferenceValues(id, { ...reset, ...upserts }));
    },
    clearLocal: () => store.resetSyncedPreferences(id),
    signal: () => store.preferenceEdits,
}));

// One collection's pulls and pushes; `active()` / `userId()` come from the composable.
const createRunner = ({ adapter, storage, request, now, delayMs, active, userId, onForbidden, onSyncOff }) => {
    const collection = SYNC_COLLECTIONS[adapter.id];
    const { id } = collection;
    let generation = 0; // bumped by reset: answers of an older generation are dropped
    let pulled = false;
    let pulling = null;
    let pushing = null;
    let pushAgain = false;
    let stopped = false;
    let blocked = false; // a 400 / 404: this build and the server disagree on the collection
    let timer = null;
    // Local items when this user's session began without an own record: what differs at the pull is this session's.
    let baseline = null;

    const record = () => readSyncRecord(storage, collection);
    const write = (next) => writeSyncRecord(storage, collection, next);

    // The user's own record brought up to date with local data → `{ record, local }`; null for anyone else's
    // record, none, or an owner not ready: nothing is stamped outside a signed-in user's own record.
    const detect = (uid) => {
        const stored = record();
        if (!isOwnRecord(stored, uid)) return null;
        const local = adapter.readLocal();
        if (!local) return null;
        const { record: next, changed } = detectLocalChanges(stored, local, now());
        if (changed) write(next);
        return { record: next, local };
    };

    // The account's changes reach the owner; what it stored becomes the record's hash.
    const apply = ({ record: next, upserts, deletes }) => {
        const ids = Object.keys(upserts);
        if (ids.length || deletes.length) adapter.applyRemote({ upserts, deletes });
        write(settleApplied(next, adapter.readLocal() ?? {}, ids));
    };

    // A pull or push went through.
    const settled = () => { syncState[id] = hasHeldBack(record()) ? 'partial' : 'synced'; };

    const stop = () => {
        stopped = true;
        clearTimeout(timer);
        timer = null;
    };

    const fail = (at, error, what) => {
        if (at !== generation) return;
        if (error?.status === 400 || error?.status === 404) {
            blocked = true;
            stop();
            syncState[id] = 'reload';
        } else if (error?.status === 409 && error?.code === SYNC_OFF_CODE) onSyncOff();
        else if (error?.status === 403) onForbidden();
        else {
            syncState[id] = 'failed';
            warn(id, `${what} failed`, error);
        }
    };

    // A signed-in session begins (or the switch comes on) for `uid`.
    const begin = (uid) => {
        baseline = uid && !isOwnRecord(record(), uid) ? hashItems(adapter.readLocal()) : null;
    };

    const reset = () => {
        generation += 1;
        clearTimeout(timer);
        timer = null;
        pulled = pushAgain = false;
        pulling = pushing = null;
        stopped = blocked;
        if (!blocked) syncState[id] = 'idle';
    };

    const forbid = () => {
        generation += 1; // answers still in flight are dropped
        stop();
        syncState[id] = 'stopped';
    };

    const fetchAll = async (since, at) => {
        const items = [];
        let cursor = since;
        for (;;) {
            const page = readSyncPage(await request(`${SYNC_ENDPOINT}/${id}?v=${collection.version}&since=${cursor}`), collection);
            if (at !== generation) return null;
            if (!page) throw new Error('unreadable page');
            items.push(...page.items);
            if (!page.more) return { items, cursor: page.cursor };
            if (page.cursor <= cursor) throw new Error('cursor did not move');
            cursor = page.cursor;
        }
    };

    // Every page since the record's cursor (all of them for an adoption), merged and applied → true once done.
    const runPull = async (uid) => {
        const at = generation;
        if (!adapter.readLocal()) return false;
        detect(uid);
        try {
            const fetched = await fetchAll(preparePull(record(), uid, now()).since, at);
            if (!fetched || at !== generation) return false;
            const current = detect(uid);
            const local = current?.local ?? adapter.readLocal();
            if (!local) return false;
            const stored = current?.record ?? record();
            apply(mergePull({
                prepared: preparePull(stored, uid, now()), record: stored, local, items: fetched.items,
                cursor: fetched.cursor, userId: uid, now: now(), keep: changedSince(baseline, local),
            }));
            baseline = null;
            pulled = true;
            settled();
            schedule(); // pending edits (an adoption's upload), if any
            return true;
        } catch (error) {
            fail(at, error, 'pull');
            return false;
        }
    };

    const pull = (uid) => {
        if (stopped || !uid) return Promise.resolve(false);
        pulling ??= runPull(uid).finally(() => { pulling = null; });
        return pulling;
    };

    const runPush = async () => {
        const at = generation;
        const uid = userId();
        let pullNeeded = false;
        try {
            const start = detect(uid);
            if (!start) return;
            const { batches, invalid } = buildUploadBatches(start.record, start.local, collection);
            if (invalid.length) write(markRefused(start.record, invalid));
            for (const items of batches) {
                const answer = readSyncSave(await request(`${SYNC_ENDPOINT}/${id}`, 'PUT', { version: collection.version, items }), collection);
                if (at !== generation) return;
                if (!answer) throw new Error('unreadable answer');
                const current = detect(uid);
                if (!current) return;
                const merged = mergeSave({ record: current.record, sent: items, answer, local: current.local, now: now() });
                apply(merged);
                pullNeeded ||= merged.pullNeeded;
            }
            settled();
        } catch (error) {
            fail(at, error, 'push');
            return;
        }
        if (at === generation && pullNeeded) await pull(uid);
    };

    const push = async () => {
        if (stopped || !pulled || !active()) return;
        if (pushing) {
            pushAgain = true;
            return;
        }
        const at = generation;
        pushing = runPush();
        await pushing;
        if (at !== generation) return;
        pushing = null;
        if (pushAgain) {
            pushAgain = false;
            schedule();
        }
    };

    // A change: push once changes settle; a pull that failed earlier runs instead.
    const flushLater = () => {
        timer = null;
        if (pulled) push();
        else if (active()) pull(userId());
    };
    const schedule = () => {
        if (!active() || stopped) return;
        clearTimeout(timer);
        timer = setTimeout(flushLater, delayMs);
    };

    // Sign-out: a push in flight finishes, then whatever is still pending goes now (even if this load's pull failed).
    const flush = async () => {
        clearTimeout(timer);
        timer = null;
        if (pushing) await pushing;
        pushAgain = false;
        if (!stopped && active()) await runPush();
    };

    // The account's data leaves this device: record dropped, collection emptied, anything in flight orphaned.
    const clearLocal = () => {
        reset();
        removeSyncRecord(storage, collection);
        adapter.clearLocal();
    };

    // The collection became device-only (turned off): its data stays, its record goes.
    const dropRecord = () => {
        reset();
        removeSyncRecord(storage, collection);
    };

    // Another device turned it off (409 sync_off): device-only until the settings say otherwise.
    const turnedOff = () => {
        dropRecord();
        stop();
    };

    const dispose = () => {
        generation += 1;
        clearTimeout(timer);
    };

    return { record, detect, pull, schedule, begin, reset, forbid, flush, clearLocal, dropRecord, turnedOff, dispose };
};

// Settles within `ms` whatever `promise` does.
const within = (promise, ms) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    promise.then(resolve, resolve).finally(() => clearTimeout(timer));
});

export const useAccountSync = ({
    store, request = authenticatedFetch, storage = defaultStorage(), now = () => Date.now(),
    delayMs = SYNC_PUSH_DELAY_MS, flushMs = SIGN_OUT_FLUSH_MS, adapters = createSyncAdapters(store),
}) => {
    if (!storage) return;
    const userId = computed(() => (store.isSignedIn && store.user?.uid) || null);
    const available = computed(() => Boolean(store.accountSyncAvailable));

    // A 403 stops every collection until the user changes.
    const runners = [];
    const stopAll = () => runners.forEach((runner) => runner.forbid());

    // --- the account's settings ---------------------------------------------

    const setSettings = (uid, answer, status) => {
        const settings = { user: uid, status, ...answer };
        store.setSyncSettings(settings);
        if (status === 'fresh') writeCachedSyncSettings(storage, settings);
        return settings;
    };

    // Bumped when a settings save starts and when it lands: a read that overlaps one is dropped.
    let settingsWrites = 0;

    // GET /api/sync for `uid` → the fresh settings, or null.
    const fetchSettings = async (uid) => {
        const writes = settingsWrites;
        try {
            const answer = readSyncSettingsAnswer(await request(SYNC_ENDPOINT));
            if (!answer) throw new Error('unreadable settings');
            return store.user?.uid === uid && writes === settingsWrites ? setSettings(uid, answer, 'fresh') : null;
        } catch (error) {
            if (error?.status === 403) stopAll();
            else warn('settings', 'load failed', error);
            return null;
        }
    };

    // A known user: the cached settings at once, the server's as soon as sync is available.
    let fetchedFor = null;
    watch(() => [userId.value, available.value], ([uid, isAvailable]) => {
        if (!uid) {
            fetchedFor = null;
            if (store.syncSettings?.user) store.setSyncSettings(createSyncSettings());
            return;
        }
        if (store.syncSettings?.user !== uid) {
            store.setSyncSettings(readCachedSyncSettings(storage, uid) ?? { ...createSyncSettings(), user: uid });
        }
        if (isAvailable && fetchedFor !== uid) {
            fetchedFor = uid;
            fetchSettings(uid);
        }
    }, { immediate: true });

    // --- the collections ----------------------------------------------------

    for (const adapter of adapters.filter(({ id }) => Object.hasOwn(SYNC_COLLECTIONS, id))) {
        const syncOn = computed(() => collectionSyncState(store.syncSettings, userId.value, adapter.id));
        const active = computed(() => available.value && syncOn.value === 'on' && Boolean(userId.value));
        const runner = createRunner({
            adapter, storage, request, now, delayMs,
            active: () => active.value, userId: () => userId.value, onForbidden: stopAll,
            onSyncOff: () => {
                runner.turnedOff();
                if (userId.value) fetchSettings(userId.value);
            },
        });
        runners.push({ ...runner, adapter, syncOn });

        // Stamps stay close to the edit: checked on every local edit, for the signed-in user's own record only.
        watch(adapter.signal, () => {
            if (!active.value) return;
            runner.detect(userId.value);
            runner.schedule();
        });

        // Turned off: device-only, record dropped. Turned on, or a new user: starts over with a pull (an adoption when
        // there is no record). Unknown (signed out, settings not loaded): nothing runs, nothing is dropped.
        watch(() => [active.value, userId.value, syncOn.value], ([isActive, uid, state], previous) => {
            if (state === 'off') {
                if (runner.record()) runner.dropRecord();
                else runner.reset();
            } else if (uid !== previous?.[1] || (state === 'on' && previous?.[2] !== 'on')) {
                runner.reset();
                if (state === 'on') runner.begin(uid);
            }
            if (isActive) runner.pull(uid);
        }, { immediate: true });
    }

    // A session that ended without the sign-out action (Firebase resolved: nobody signed in) leaves records naming
    // a user: the account's data goes, as on sign-out, without a flush.
    watch(() => Boolean(store.authResolved) && !store.isSignedIn, (signedOut) => {
        if (!signedOut) return;
        for (const runner of runners) if (runner.record()?.user) runner.clearLocal();
        clearCachedSyncSettings(storage);
    }, { immediate: true });

    // --- commands -----------------------------------------------------------

    // The popup sign-in awaits this before it reloads (utils/features/account-sync-auth.js): the account's settings,
    // then every enabled collection pulled for `userId` → true when all of that worked.
    useAppCommand(BEFORE_RELOAD_COMMAND, async ({ userId: uid } = {}) => {
        if (!uid || !available.value) return false;
        const settings = await fetchSettings(uid);
        if (!settings) return false;
        const pulls = runners.filter((runner) => settings.collections.includes(runner.adapter.id))
            .map((runner) => runner.pull(uid));
        return (await Promise.all(pulls)).every(Boolean);
    });

    // The dialog and Preferences: PUT /api/sync `{ collections }` → true once the account holds the choice (the
    // watchers then adopt what was turned on and drop what was turned off), false when it failed.
    useAppCommand(SET_SYNC_COLLECTIONS_COMMAND, async ({ collections } = {}) => {
        const uid = userId.value;
        if (!uid || !available.value || !Array.isArray(collections)) return false;
        settingsWrites += 1;
        try {
            const answer = readSyncSettingsAnswer(await request(SYNC_ENDPOINT, 'PUT', { collections }));
            settingsWrites += 1;
            if (!answer) throw new Error('unreadable settings');
            if (userId.value === uid) setSettings(uid, answer, 'fresh');
            return true;
        } catch (error) {
            warn('settings', 'save failed', error);
            // A read this save overlapped was dropped: read again.
            if (userId.value === uid) fetchSettings(uid);
            return false;
        }
    });

    // Sign-out awaits this: pending edits sent within `flushMs` (failures ignored), then every enabled collection
    // holding this user's data is cleared off the device → how many were cleared.
    useAppCommand(SIGN_OUT_COMMAND, async ({ userId: uid } = {}) => {
        if (!uid) return 0;
        const own = runners.filter((runner) => runner.syncOn.value !== 'off' && isOwnRecord(runner.record(), uid));
        await within(Promise.allSettled(own.map((runner) => runner.flush())), flushMs);
        for (const runner of own) runner.clearLocal();
        clearCachedSyncSettings(storage);
        return own.length;
    });

    onScopeDispose(() => runners.forEach((runner) => runner.dispose()));
};
