// Tests for frontend/composables/use-account-sync.js over a fake sync server and storage: the account's settings
// (fetched once signed in, cached per user, the cache starting pulls early and the answer correcting it), gating on
// them, enabling (an empty account takes the device's data, a non-empty one replaces it), disabling (record dropped,
// data kept), a 409 `sync_off`, no stamps while signed out, the debounced push, paging, another user's record, the
// 400 / 403 / 5xx handling, the sign-out flush-then-clear of enabled collections only, the boot-time clearing, and
// the popup sign-in's step before its reload.

// The composable's default request imports the store, which needs these globals at import time.
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window ??= { location: { search: '' }, addEventListener() {}, innerWidth: 1024 };
globalThis.document ??= {
    addEventListener() {}, title: '', querySelector: () => null,
    documentElement: { classList: { toggle() {} } },
};

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { effectScope, reactive, nextTick } from 'vue';

const { useAccountSync, useAccountSyncState, SYNC_ENDPOINT } = await import('../frontend/composables/use-account-sync.js');
const { readSyncRecord, writeSyncRecord, syncRecordKey, hashSyncValue } = await import('../frontend/utils/features/account-sync.js');
const {
    syncItemDefaults, toPreferenceValues,
} = await import('../frontend/utils/features/preferences-sync.js');
const {
    createSyncSettings, writeCachedSyncSettings, readCachedSyncSettings, SYNC_SETTINGS_CACHE_KEY,
} = await import('../frontend/utils/features/sync-settings.js');
const { SYNC_COLLECTIONS, SYNC_OFF_CODE } = await import('../frontend/utils/sync-collections.js');
const { SYNCED_PREFERENCE_KEYS } = await import('../frontend/utils/preferences-schema.js');
const { sanitizeLists } = await import('../frontend/utils/features/connectivity-lists.js');
const { DEFAULT_PREFERENCES, PREFS_STORAGE_KEY } = await import('../frontend/data/default-preferences.js');
const {
    BEFORE_RELOAD_COMMAND, SIGN_OUT_COMMAND, syncBeforeReload, clearAccountDataBeforeSignOut, saveSyncCollections,
} = await import('../frontend/utils/features/account-sync-auth.js');
const { hasAppCommand } = await import('../frontend/utils/app-commands.js');

const memoryStorage = () => ({
    data: {},
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
});

const settle = async () => {
    for (let i = 0; i < 8; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2));
        await nextTick();
    }
};

const httpError = (status, code) => Object.assign(new Error(`HTTP ${status}`), { status, ...(code ? { code } : {}) });

const BOTH = ['preferences', 'connectivity'];

// The settings and item endpoints over memory: per collection a seq-ordered item map, the newer `updatedAt` winning;
// an item route of a collection that is off answers 409 sync_off; turning one off deletes its rows.
const fakeServer = ({ settings = { decided: true, collections: BOTH }, pageSize } = {}) => {
    const rows = { preferences: new Map(), connectivity: new Map() };
    let seq = 0;
    const server = {
        calls: [],
        rows,
        settings: { ...settings },
        fail: null, // (collection, method) → an error to throw, or null
        hold: null, // a promise every item request waits on
        holdSettings: null, // a promise the settings GET waits on
        seed(collection, item) {
            seq += 1;
            rows[collection].set(item.id, { ...item, deleted: Boolean(item.deleted), seq });
        },
        live(collection) {
            return Object.fromEntries([...rows[collection].values()].filter((row) => !row.deleted).map((row) => [row.id, row.value]));
        },
        async request(url, method = 'GET', body = null) {
            const { pathname, searchParams } = new URL(url, 'http://test');
            const collection = pathname === SYNC_ENDPOINT ? 'settings' : pathname.slice(SYNC_ENDPOINT.length + 1);
            server.calls.push({ collection, method, body, since: searchParams.get('since') });
            if (collection === 'settings') {
                if (method === 'GET' && server.holdSettings) await server.holdSettings;
                const error = server.fail?.('settings', method);
                if (error) throw error;
                if (method === 'PUT') {
                    server.settings = { decided: true, collections: body.collections };
                    for (const id of Object.keys(rows)) if (!body.collections.includes(id)) rows[id].clear();
                }
                return { ...server.settings, collections: [...server.settings.collections] };
            }
            if (server.hold) await server.hold;
            const error = server.fail?.(collection, method);
            if (error) throw error;
            if (!server.settings.collections.includes(collection)) throw httpError(409, SYNC_OFF_CODE);
            const registry = SYNC_COLLECTIONS[collection];
            if (method === 'GET') {
                const since = Number(searchParams.get('since'));
                const size = pageSize ?? registry.pageSize;
                const all = [...rows[collection].values()].filter((row) => row.seq > since).sort((a, b) => a.seq - b.seq);
                const page = all.slice(0, size);
                return {
                    cursor: page.length ? page.at(-1).seq : since,
                    more: all.length > size,
                    items: page.map(({ id, updatedAt, deleted, value }) => (deleted ? { id, updatedAt, deleted } : { id, updatedAt, deleted, value })),
                };
            }
            const base = seq;
            const conflicts = [];
            const refused = [];
            for (const item of body.items) {
                if (!item.deleted && !registry.isValidValue(item.id, item.value)) {
                    refused.push({ id: item.id, reason: 'invalid' });
                    continue;
                }
                const stored = rows[collection].get(item.id);
                if (stored && stored.updatedAt >= item.updatedAt) {
                    const { seq: _, ...rest } = stored;
                    conflicts.push(rest);
                    continue;
                }
                server.seed(collection, item);
            }
            return { base, cursor: seq, conflicts, refused };
        },
    };
    return server;
};

let scope = null;
let clock = 1_000_000;

const freshPrefs = (over = {}) => ({ ...DEFAULT_PREFERENCES, connectivityLists: sanitizeLists(null, null, []), ...over });

const startSync = ({
    prefs = {}, signedIn = true, uid = 'u1', available = true, server = fakeServer(), storage = memoryStorage(),
    authResolved = signedIn, flushMs = 200, request = server.request,
} = {}) => {
    const store = reactive({
        isSignedIn: signedIn,
        user: signedIn ? { uid } : null,
        authResolved,
        accountSyncAvailable: available,
        allHasLoaded: true,
        syncSettings: createSyncSettings(),
        userPreferences: freshPrefs(prefs),
        preferenceEdits: 0,
        applySyncedPreferences(values) {
            Object.assign(this.userPreferences, values);
        },
        resetSyncedPreferences(id) {
            this.applySyncedPreferences(toPreferenceValues(id, syncItemDefaults(id)));
        },
        setSyncSettings(settings) {
            this.syncSettings = settings;
        },
    });
    const edit = (key, value) => {
        store.userPreferences[key] = value;
        store.preferenceEdits += 1;
    };
    scope = effectScope();
    const listeners = [];
    const events = { addEventListener: (type, fn) => listeners.push(fn), removeEventListener() {} };
    scope.run(() => useAccountSync({ store, request, storage, now: () => (clock += 1000), delayMs: 0, flushMs, events }));
    // Another tab saved `prefs` under `key`.
    const otherTab = (prefs, key = PREFS_STORAGE_KEY) => listeners.forEach((fn) => fn({ key, newValue: JSON.stringify(prefs) }));
    return { store, server, storage, edit, otherTab };
};

const record = (storage, id) => readSyncRecord(storage, SYNC_COLLECTIONS[id]);
const calls = (server, collection, method) => server.calls.filter((c) => c.collection === collection && (!method || c.method === method));
const sent = (server, collection) => calls(server, collection, 'PUT').flatMap((put) => put.body.items.map((item) => item.id));
const state = useAccountSyncState();
const quiet = async (fn) => {
    const realWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        return { result: await fn(), warnings };
    } finally {
        console.warn = realWarn;
    }
};
const otherLists = () => ({
    ...sanitizeLists(null, null, []),
    lists: [...sanitizeLists(null, null, []).lists, { id: 'work', name: 'Work', members: [] }],
});

afterEach(() => {
    scope?.stop();
    scope = null;
});

describe('account sync — the account\'s settings', () => {
    it('are fetched once signed in with sync available, cached, and gate the pulls', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['connectivity'] } });
        const { store, storage } = startSync({ server });
        await settle();
        assert.deepEqual(calls(server, 'settings').map((c) => c.method), ['GET']);
        assert.equal(store.syncSettings.status, 'fresh');
        assert.deepEqual(readCachedSyncSettings(storage, 'u1').collections, ['connectivity']);
        assert.equal(calls(server, 'connectivity', 'GET').length, 1);
        assert.equal(calls(server, 'preferences').length, 0, 'off in the account: device-only, no request');
    });

    it('undecided: nothing syncs, nothing is recorded', async () => {
        const server = fakeServer({ settings: { decided: false, collections: [] } });
        const { storage } = startSync({ server });
        await settle();
        assert.deepEqual(server.calls.map((c) => c.collection), ['settings']);
        assert.equal(record(storage, 'preferences'), null);
    });

    it('nothing without sync or while signed out', async () => {
        for (const options of [{ available: false }, { signedIn: false }]) {
            const { server } = startSync(options);
            await settle();
            assert.deepEqual(server.calls, [], JSON.stringify(options));
            scope.stop();
        }
    });

    it('this user\'s cache starts the pulls before the answer, which then corrects it', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['preferences'] } });
        let release;
        server.holdSettings = new Promise((resolve) => { release = resolve; });
        const storage = memoryStorage();
        writeCachedSyncSettings(storage, { user: 'u1', decided: true, collections: BOTH });
        server.settings = { decided: true, collections: BOTH };
        const { store } = startSync({ server, storage });
        await settle();
        assert.equal(store.syncSettings.status, 'cached');
        assert.ok(calls(server, 'connectivity', 'GET').length >= 1, 'pulled from the cache');
        assert.ok(record(storage, 'connectivity'));
        server.settings = { decided: true, collections: ['preferences'] };
        release();
        await settle();
        assert.equal(store.syncSettings.status, 'fresh');
        assert.equal(record(storage, 'connectivity'), null, 'off after all: record dropped');
    });

    it('a read answered after a save does not undo it', async () => {
        const server = fakeServer({ settings: { decided: true, collections: [] } });
        let answerRead;
        let held = false;
        const request = (url, method = 'GET', body = null) => {
            if (url !== SYNC_ENDPOINT || method !== 'GET' || held) return server.request(url, method, body);
            held = true;
            return new Promise((resolve) => { answerRead = () => resolve({ decided: true, collections: [] }); });
        };
        const storage = memoryStorage();
        writeCachedSyncSettings(storage, { user: 'u1', decided: true, collections: [] });
        const { store } = startSync({ server, storage, request });
        await settle();
        assert.equal(await saveSyncCollections(BOTH), true);
        answerRead();
        await settle();
        assert.deepEqual(store.syncSettings.collections, BOTH);
        assert.ok(record(storage, 'preferences'), 'still syncing');
    });

    it('another user\'s cache is ignored', async () => {
        const storage = memoryStorage();
        writeCachedSyncSettings(storage, { user: 'u2', decided: true, collections: BOTH });
        const server = fakeServer();
        let release;
        server.holdSettings = new Promise((resolve) => { release = resolve; });
        startSync({ server, storage });
        await settle();
        assert.deepEqual(server.calls.map((c) => c.collection), ['settings']);
        release();
        await settle();
    });
});

describe('account sync — enabling and disabling', () => {
    it('enabling into an empty account: this device\'s data becomes the account\'s', async () => {
        const server = fakeServer({ settings: { decided: false, collections: [] } });
        const lists = otherLists();
        const { storage } = startSync({ server, prefs: { theme: 'dark', connectivityLists: lists } });
        await settle();
        assert.equal(await saveSyncCollections(BOTH), true);
        await settle();
        assert.deepEqual(calls(server, 'settings', 'PUT')[0].body, { collections: BOTH });
        assert.deepEqual(sent(server, 'preferences').sort(), [...SYNCED_PREFERENCE_KEYS].sort());
        assert.equal(server.live('preferences').theme, 'dark');
        assert.deepEqual(server.live('connectivity').lists, lists);
        assert.equal(record(storage, 'connectivity').user, 'u1');
        assert.equal(state.connectivity, 'synced');
    });

    it('enabling when another device already filled the account: the account replaces this device', async () => {
        const server = fakeServer({ settings: { decided: true, collections: [] } });
        const { store } = startSync({ server, prefs: { connectivityDefaultListId: 'mine' } });
        await settle();
        server.seed('connectivity', { id: 'lists', updatedAt: 5, value: otherLists() });
        server.seed('connectivity', { id: 'defaultListId', updatedAt: 5, value: 'work' });
        await saveSyncCollections(['connectivity']);
        await settle();
        assert.equal(store.userPreferences.connectivityDefaultListId, 'work');
        assert.deepEqual(store.userPreferences.connectivityLists, otherLists());
        assert.equal(calls(server, 'connectivity', 'PUT').length, 0);
    });

    it('disabling: the account deletes its rows, this device drops the record and keeps the data', async () => {
        const server = fakeServer();
        const { store, storage, edit } = startSync({ server, prefs: { theme: 'dark' } });
        await settle();
        assert.equal(server.live('preferences').theme, 'dark');
        await saveSyncCollections(['connectivity']);
        await settle();
        assert.equal(record(storage, 'preferences'), null);
        assert.equal(store.userPreferences.theme, 'dark');
        assert.deepEqual(server.live('preferences'), {});
        const before = calls(server, 'preferences').length;
        edit('theme', 'light');
        await settle();
        assert.equal(calls(server, 'preferences').length, before, 'device-only now');
    });

    it('a failed settings save changes nothing and says so', async () => {
        const server = fakeServer({ settings: { decided: false, collections: [] } });
        server.fail = (collection, method) => (collection === 'settings' && method === 'PUT' ? httpError(500) : null);
        const { store } = startSync({ server });
        await settle();
        const { result } = await quiet(() => saveSyncCollections(BOTH));
        assert.equal(result, false);
        assert.equal(store.syncSettings.decided, false);
    });

    it('another device turned it off (409 sync_off): settings re-fetched, record dropped, data kept, no warning', async () => {
        const server = fakeServer();
        const { store, storage, edit } = startSync({ server, prefs: { theme: 'dark' } });
        await settle();
        server.settings = { decided: true, collections: ['connectivity'] };
        const { warnings } = await quiet(async () => {
            edit('theme', 'light');
            await settle();
        });
        assert.deepEqual(warnings, []);
        assert.equal(record(storage, 'preferences'), null);
        assert.equal(store.userPreferences.theme, 'light');
        assert.deepEqual(store.syncSettings.collections, ['connectivity']);
        assert.equal(calls(server, 'settings', 'GET').length, 2);
    });
});

describe('account sync — signed in, enabled', () => {
    it('the owner\'s case: edits made signed out carry no stamp and lose to the account at the next sign-in', async () => {
        const server = fakeServer();
        server.seed('preferences', { id: 'theme', updatedAt: 5, value: 'light' });
        const { store, edit, storage } = startSync({ server, signedIn: false });
        await settle();
        edit('theme', 'dark');
        await settle();
        assert.equal(record(storage, 'preferences'), null, 'no record, no stamp while signed out');
        store.user = { uid: 'u1' };
        store.isSignedIn = true;
        await settle();
        assert.equal(store.userPreferences.theme, 'light');
        assert.equal(calls(server, 'preferences', 'PUT').length, 0);
    });

    it('an edit pushes after the pause, only in its collection; applied values are never sent back', async () => {
        const server = fakeServer();
        server.seed('preferences', { id: 'lang', updatedAt: 5, value: 'fr' });
        server.seed('connectivity', { id: 'defaultListId', updatedAt: 5, value: 'mine' });
        const { edit } = startSync({ server });
        await settle();
        edit('theme', 'light');
        edit('theme', 'dark');
        await settle();
        assert.deepEqual(sent(server, 'preferences'), ['theme']);
        assert.equal(server.live('preferences').theme, 'dark');
        assert.equal(calls(server, 'connectivity', 'PUT').length, 0);
        edit('connectivityLists', otherLists());
        await settle();
        assert.deepEqual(sent(server, 'connectivity'), ['lists']);
    });

    it('another tab\'s saved values reach this tab unstamped, so its next edit does not send its old ones', async () => {
        const server = fakeServer();
        const { store, storage, edit, otherTab } = startSync({ server, prefs: { theme: 'auto' } });
        await settle();
        const before = calls(server, 'preferences', 'PUT').length;
        // The other tab's edit, as it leaves things: sent, held in the shared record, saved to storage.
        const at = clock + 500;
        server.seed('preferences', { id: 'theme', updatedAt: at, value: 'dark' });
        const shared = record(storage, 'preferences');
        writeSyncRecord(storage, SYNC_COLLECTIONS.preferences, {
            ...shared, items: { ...shared.items, theme: { hash: hashSyncValue('dark'), at, ack: at } },
        });
        otherTab({ ...store.userPreferences, theme: 'dark' });
        assert.equal(store.userPreferences.theme, 'dark');
        otherTab({ theme: 'light' }, 'someOtherKey');
        assert.equal(store.userPreferences.theme, 'dark');
        edit('simpleMode', !store.userPreferences.simpleMode);
        await settle();
        assert.deepEqual(calls(server, 'preferences', 'PUT').slice(before).flatMap((put) => put.body.items.map((item) => item.id)), ['simpleMode']);
        assert.equal(server.live('preferences').theme, 'dark');
    });

    it('another tab\'s values are left alone while the collection does not sync here', async () => {
        const { store, otherTab } = startSync({ server: fakeServer({ settings: { decided: true, collections: [] } }), prefs: { theme: 'auto' } });
        await settle();
        otherTab({ ...store.userPreferences, theme: 'dark' });
        assert.equal(store.userPreferences.theme, 'auto');
    });

    it('follows `more` across pages', async () => {
        const server = fakeServer({ pageSize: 1 });
        server.seed('connectivity', { id: 'lists', updatedAt: 5, value: otherLists() });
        server.seed('connectivity', { id: 'defaultListId', updatedAt: 5, value: 'work' });
        const { store, storage } = startSync({ server });
        await settle();
        assert.deepEqual(calls(server, 'connectivity', 'GET').map((c) => c.since), ['0', '1']);
        assert.equal(store.userPreferences.connectivityDefaultListId, 'work');
        assert.equal(record(storage, 'connectivity').cursor, 2);
    });

    it('another device\'s write in between: the push is followed by a pull', async () => {
        const server = fakeServer();
        server.seed('preferences', { id: 'lang', updatedAt: 5, value: 'fr' });
        const { edit } = startSync({ server });
        await settle();
        server.seed('preferences', { id: 'simpleMode', updatedAt: 1, value: true });
        edit('theme', 'dark');
        await settle();
        assert.equal(calls(server, 'preferences', 'GET').length, 2);
    });

    it('another user\'s record and an empty account: the device resets instead of uploading', async () => {
        const storage = memoryStorage();
        writeSyncRecord(storage, SYNC_COLLECTIONS.preferences, { user: 'old', cursor: 3, lastSyncAt: 1, items: {} });
        const { store, server } = startSync({ storage, prefs: { theme: 'dark' } });
        await settle();
        assert.equal(store.userPreferences.theme, DEFAULT_PREFERENCES.theme);
        assert.equal(calls(server, 'preferences', 'PUT').length, 0);
        assert.equal(record(storage, 'preferences').user, 'u1');
    });
});

describe('account sync — failures', () => {
    it('a 400 stops that collection for this page load; the other goes on', async () => {
        const server = fakeServer();
        server.fail = (collection) => (collection === 'connectivity' ? httpError(400) : null);
        const { edit } = startSync({ server });
        await settle();
        assert.equal(state.connectivity, 'reload');
        server.fail = null;
        edit('connectivityDefaultListId', 'other');
        await settle();
        assert.equal(calls(server, 'connectivity').length, 1);
        assert.equal(state.preferences, 'synced');
    });

    it('a 403 stops every collection', async () => {
        const server = fakeServer();
        server.fail = (collection) => (collection === 'preferences' ? httpError(403) : null);
        server.hold = new Promise((resolve) => setTimeout(resolve, 5));
        const { edit } = startSync({ server });
        await settle();
        assert.equal(state.connectivity, 'stopped');
        const before = server.calls.length;
        edit('theme', 'dark');
        await settle();
        assert.equal(server.calls.length, before);
    });

    it('a 5xx or network failure marks the collection failed for the panel', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['preferences'] } });
        server.fail = (collection) => (collection === 'preferences' ? httpError(503) : null);
        await quiet(async () => {
            startSync({ server });
            await settle();
        });
        assert.equal(state.preferences, 'failed');
    });

    it('a 5xx or network failure warns and retries on the next change', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['preferences'] } });
        server.fail = (collection) => (collection === 'preferences' ? httpError(503) : null);
        const { warnings } = await quiet(async () => {
            const { edit } = startSync({ server });
            await settle();
            server.fail = null;
            edit('theme', 'dark');
            await settle();
        });
        assert.equal(warnings.length, 1);
        assert.equal(calls(server, 'preferences', 'GET').length, 2);
        assert.equal(state.preferences, 'synced', 'the failure clears once a retry goes through');
        assert.equal(server.live('preferences').theme, 'dark');
    });
});

describe('account sync — sign-out', () => {
    // Signed in and adopted into an account holding both collections.
    const signedInDevice = async (options = {}) => {
        const server = options.server ?? fakeServer();
        server.seed('preferences', { id: 'theme', updatedAt: 5, value: 'dark' });
        server.seed('connectivity', { id: 'defaultListId', updatedAt: 5, value: 'work' });
        server.seed('connectivity', { id: 'lists', updatedAt: 5, value: otherLists() });
        const session = startSync({ server, ...options });
        await settle();
        return session;
    };

    it('sends pending edits first, then clears every enabled collection and its record', async () => {
        const { store, server, storage } = await signedInDevice();
        // An edit whose debounced push has not gone yet: the command runs before the change watcher.
        store.userPreferences.lang = 'fr';
        store.preferenceEdits += 1;
        assert.equal(await clearAccountDataBeforeSignOut('u1'), 2);
        assert.equal(server.live('preferences').lang, 'fr', 'flushed before the clearing');
        assert.equal(store.userPreferences.theme, DEFAULT_PREFERENCES.theme);
        assert.equal(store.userPreferences.connectivityDefaultListId, DEFAULT_PREFERENCES.connectivityDefaultListId);
        assert.deepEqual(store.userPreferences.connectivityLists, sanitizeLists(null, null, []));
        assert.equal(record(storage, 'preferences'), null);
        assert.equal(record(storage, 'connectivity'), null);
        assert.equal(storage.data[SYNC_SETTINGS_CACHE_KEY], undefined);
        assert.equal(server.live('connectivity').defaultListId, 'work', 'the account keeps its data');
    });

    it('a collection the account does not sync is device-only and stays', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['preferences'] } });
        const { store } = await signedInDevice({ server, prefs: { connectivityDefaultListId: 'mine-too' } });
        assert.equal(await clearAccountDataBeforeSignOut('u1'), 1);
        assert.equal(store.userPreferences.connectivityDefaultListId, 'mine-too');
    });

    it('a flush that hangs is cut off and the clearing still happens', async () => {
        const { store, server, storage } = await signedInDevice({ flushMs: 30 });
        let release;
        server.hold = new Promise((resolve) => { release = resolve; });
        store.userPreferences.lang = 'fr';
        store.preferenceEdits += 1;
        const { result } = await quiet(() => clearAccountDataBeforeSignOut('u1'));
        assert.equal(result, 2);
        assert.equal(store.userPreferences.lang, DEFAULT_PREFERENCES.lang);
        release();
        await settle();
        assert.equal(record(storage, 'preferences'), null, 'a late answer writes nothing back');
    });

    it('the commands have one owner while mounted', () => {
        startSync({ signedIn: false });
        assert.equal(hasAppCommand(SIGN_OUT_COMMAND), true);
        assert.equal(hasAppCommand(BEFORE_RELOAD_COMMAND), true);
        scope.stop();
        scope = null;
        assert.equal(hasAppCommand(SIGN_OUT_COMMAND), false);
    });
});

describe('account sync — boot after the session ended', () => {
    it('Firebase says nobody is signed in: records naming a user clear their collections, without a request', async () => {
        const storage = memoryStorage();
        writeSyncRecord(storage, SYNC_COLLECTIONS.connectivity, { user: 'u1', cursor: 3, lastSyncAt: 1, items: {} });
        writeCachedSyncSettings(storage, { user: 'u1', decided: true, collections: ['connectivity'] });
        const { store, server } = startSync({
            storage, signedIn: false, authResolved: true, prefs: { theme: 'dark', connectivityDefaultListId: 'work' },
        });
        await settle();
        assert.equal(store.userPreferences.connectivityDefaultListId, DEFAULT_PREFERENCES.connectivityDefaultListId);
        assert.equal(store.userPreferences.theme, 'dark', 'no record: device-only, untouched');
        assert.equal(record(storage, 'connectivity'), null);
        assert.equal(storage.data[SYNC_SETTINGS_CACHE_KEY], undefined);
        assert.deepEqual(server.calls, []);
    });

    it('unresolved auth clears nothing', async () => {
        const storage = memoryStorage();
        writeSyncRecord(storage, SYNC_COLLECTIONS.preferences, { user: 'u1', cursor: 3, lastSyncAt: 1, items: {} });
        const { store } = startSync({ storage, signedIn: false, authResolved: false, prefs: { theme: 'dark' } });
        await settle();
        assert.equal(store.userPreferences.theme, 'dark');
        assert.equal(record(storage, 'preferences').user, 'u1');
    });
});

describe('account sync — the popup sign-in\'s step before the reload', () => {
    it('fetches the settings and pulls every enabled collection for the new user; nothing is pushed', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['connectivity'] } });
        server.seed('connectivity', { id: 'defaultListId', updatedAt: 5, value: 'work' });
        const { store, storage } = startSync({ server, signedIn: false, authResolved: true });
        store.user = { uid: 'u9' };
        await settle();
        assert.equal(await syncBeforeReload('u9'), true);
        assert.equal(store.userPreferences.connectivityDefaultListId, 'work');
        assert.equal(record(storage, 'connectivity').user, 'u9');
        assert.deepEqual(readCachedSyncSettings(storage, 'u9').collections, ['connectivity']);
        assert.equal(calls(server, 'preferences').length, 0);
        assert.equal(calls(server, 'connectivity', 'PUT').length, 0);
    });

    it('an empty enabled account: every item waits as pending for after the reload', async () => {
        const server = fakeServer({ settings: { decided: true, collections: ['preferences'] } });
        const { store, storage } = startSync({ server, signedIn: false });
        store.user = { uid: 'u9' };
        assert.equal(await syncBeforeReload('u9'), true);
        assert.equal(calls(server, 'preferences', 'PUT').length, 0);
        assert.equal(Object.keys(record(storage, 'preferences').items).length, SYNCED_PREFERENCE_KEYS.length);
    });

    it('false without sync, when the settings fail, or on a timeout — the reload goes ahead', async () => {
        const server = fakeServer();
        const { store } = startSync({ server, signedIn: false, available: false });
        store.user = { uid: 'u9' };
        assert.equal(await syncBeforeReload('u9'), false);
        store.accountSyncAvailable = true;
        server.fail = (collection) => (collection === 'settings' ? httpError(500) : null);
        assert.equal((await quiet(() => syncBeforeReload('u9'))).result, false);
        server.fail = null;
        let release;
        server.hold = new Promise((resolve) => { release = resolve; });
        assert.equal(await syncBeforeReload('u9', { timeoutMs: 20 }), false);
        release();
        await settle();
    });
});

describe('account sync — records', () => {
    it('one record per collection and schema version, none while signed out', async () => {
        const { storage } = startSync({ signedIn: false });
        await settle();
        assert.equal(storage.data[syncRecordKey(SYNC_COLLECTIONS.preferences)], undefined);
        scope.stop();
        const signedIn = startSync();
        await settle();
        assert.ok(signedIn.storage.data[syncRecordKey(SYNC_COLLECTIONS.preferences)]);
        assert.ok(signedIn.storage.data[syncRecordKey(SYNC_COLLECTIONS.connectivity)]);
    });
});
