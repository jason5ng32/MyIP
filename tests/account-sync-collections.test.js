// Tests for the per-collection pure helpers of account sync: the preferences and Connectivity items over
// userPreferences and the unstamped hash refresh (utils/features/preferences-sync.js), the account's sync settings,
// their cache and the one-time dialog's show rule (utils/features/sync-settings.js), and the commands app code awaits
// (utils/features/account-sync-auth.js).

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import {
    SYNC_ITEM_READERS, CONNECTIVITY_ITEM_KEYS, syncItemKey, toPreferenceValues, syncItemDefaults, changedSyncItems,
    refreshSyncRecords,
} from '../frontend/utils/features/preferences-sync.js';
import {
    SYNC_SETTINGS_CACHE_KEY, createSyncSettings, readSyncSettingsAnswer, readCachedSyncSettings,
    writeCachedSyncSettings, clearCachedSyncSettings, collectionSyncState, chosenCollections, shouldShowSyncDialog,
    applySyncToggle,
} from '../frontend/utils/features/sync-settings.js';
import {
    BEFORE_RELOAD_COMMAND, SIGN_OUT_COMMAND, SET_SYNC_COLLECTIONS_COMMAND, SIGN_IN_SYNC_TIMEOUT_MS,
    SIGN_OUT_FLUSH_MS, SIGN_OUT_TIMEOUT_MS, syncBeforeReload, clearAccountDataBeforeSignOut, saveSyncCollections,
} from '../frontend/utils/features/account-sync-auth.js';
import { registerAppCommand } from '../frontend/utils/app-commands.js';
import { syncRecordKey, readSyncRecord, writeSyncRecord, hashSyncValue } from '../frontend/utils/features/account-sync.js';
import { SYNC_COLLECTIONS, SYNC_COLLECTION_IDS } from '../frontend/utils/sync-collections.js';
import { SYNCED_PREFERENCE_KEYS } from '../frontend/utils/preferences-schema.js';
import { sanitizeLists } from '../frontend/utils/features/connectivity-lists.js';
import { DEFAULT_PREFERENCES } from '../frontend/data/default-preferences.js';

const memoryStorage = (initial = {}) => ({
    data: { ...initial },
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, value) { this.data[key] = String(value); },
    removeItem(key) { delete this.data[key]; },
});

const prefs = (over = {}) => ({ ...DEFAULT_PREFERENCES, connectivityLists: sanitizeLists(null, null, []), ...over });

describe('account sync — the collections', () => {
    it('exactly the two registry collections, each read from userPreferences', () => {
        assert.deepEqual([...SYNC_COLLECTION_IDS], ['preferences', 'connectivity']);
        assert.deepEqual(Object.keys(SYNC_ITEM_READERS), [...SYNC_COLLECTION_IDS]);
    });

    it('preferences: every synced key, normalised as the server checks it; the Connectivity keys stay out', () => {
        const items = SYNC_ITEM_READERS.preferences(prefs({ snapshotsAuto: true }));
        assert.deepEqual(Object.keys(items).sort(), [...SYNCED_PREFERENCE_KEYS].sort());
        assert.equal(items.snapshotsAuto, 'smart');
        for (const [key, value] of Object.entries(items)) {
            assert.ok(SYNC_COLLECTIONS.preferences.isValidValue(key, value), key);
        }
        for (const key of ['connectivityLists', 'connectivityDefaultListId', 'connectivityTargets']) assert.equal(key in items, false, key);
    });

    it('connectivity: the sanitized lists and the default list id, valid for the server', () => {
        const items = SYNC_ITEM_READERS.connectivity(prefs({ connectivityLists: null, connectivityDefaultListId: 'mine' }));
        assert.deepEqual(Object.keys(items), ['lists', 'defaultListId']);
        for (const [id, value] of Object.entries(items)) assert.ok(SYNC_COLLECTIONS.connectivity.isValidValue(id, value), id);
    });

    it('item ids map to userPreferences keys', () => {
        assert.equal(syncItemKey('connectivity', 'lists'), CONNECTIVITY_ITEM_KEYS.lists);
        assert.equal(syncItemKey('preferences', 'theme'), 'theme');
        assert.deepEqual(toPreferenceValues('connectivity', { lists: 1, defaultListId: 'x', junk: 2 }),
            { connectivityLists: 1, connectivityDefaultListId: 'x' });
    });

    it('defaults are a fresh visitor\'s values', () => {
        assert.equal(syncItemDefaults('preferences').theme, DEFAULT_PREFERENCES.theme);
        assert.equal(syncItemDefaults('connectivity').defaultListId, DEFAULT_PREFERENCES.connectivityDefaultListId);
        assert.deepEqual(syncItemDefaults('connectivity').lists, sanitizeLists(null, null, []));
    });

    it('changedSyncItems compares normalised values: a legacy form is no change, a missing key is', () => {
        const after = prefs();
        assert.equal(changedSyncItems('preferences', { ...after, snapshotsAuto: true }, after).includes('snapshotsAuto'), false);
        assert.ok(changedSyncItems('preferences', {}, after).includes('theme'));
        assert.deepEqual(changedSyncItems('connectivity', after, { ...after, connectivityDefaultListId: 'other' }), ['defaultListId']);
    });

    it('refreshSyncRecords takes changed items unstamped, only into existing records', () => {
        const storage = memoryStorage();
        refreshSyncRecords(storage, prefs(), prefs({ theme: 'dark' }));
        assert.equal(storage.data[syncRecordKey(SYNC_COLLECTIONS.preferences)], undefined);
        writeSyncRecord(storage, SYNC_COLLECTIONS.preferences, { user: 'u1', cursor: 1, lastSyncAt: 1, items: { theme: { hash: 'x', at: 3, ack: 3 } } });
        refreshSyncRecords(storage, prefs(), prefs({ theme: 'dark', connectivityDefaultListId: 'other' }));
        assert.deepEqual(readSyncRecord(storage, SYNC_COLLECTIONS.preferences).items.theme, { hash: hashSyncValue('dark'), at: 3, ack: 3 });
        assert.equal(readSyncRecord(storage, SYNC_COLLECTIONS.connectivity), null);
    });
});

describe('account sync — the account\'s settings', () => {
    it('reads an answer into registry ids, in registry order', () => {
        assert.deepEqual(readSyncSettingsAnswer({ decided: true, collections: ['connectivity', 'snapshots', 'preferences'] }),
            { decided: true, collections: ['preferences', 'connectivity'] });
        for (const bad of [null, { decided: 'yes', collections: [] }, { decided: false }]) {
            assert.equal(readSyncSettingsAnswer(bad), null);
        }
    });

    it('caches per user: another user, junk or nothing reads as no cache', () => {
        const storage = memoryStorage();
        assert.equal(readCachedSyncSettings(storage, 'u1'), null);
        writeCachedSyncSettings(storage, { user: 'u1', status: 'fresh', decided: true, collections: ['preferences'] });
        assert.deepEqual(readCachedSyncSettings(storage, 'u1'), { user: 'u1', status: 'cached', decided: true, collections: ['preferences'] });
        assert.equal(readCachedSyncSettings(storage, 'u2'), null);
        clearCachedSyncSettings(storage);
        assert.equal(storage.data[SYNC_SETTINGS_CACHE_KEY], undefined);
        storage.data[SYNC_SETTINGS_CACHE_KEY] = '{x';
        assert.equal(readCachedSyncSettings(storage, 'u1'), null);
    });

    it('a collection is on or off only for the user the settings belong to, once known', () => {
        const settings = { user: 'u1', status: 'cached', decided: true, collections: ['connectivity'] };
        assert.equal(collectionSyncState(settings, 'u1', 'connectivity'), 'on');
        assert.equal(collectionSyncState(settings, 'u1', 'preferences'), 'off');
        assert.equal(collectionSyncState(settings, 'u2', 'connectivity'), 'unknown');
        assert.equal(collectionSyncState(settings, null, 'connectivity'), 'unknown');
        assert.equal(collectionSyncState({ ...createSyncSettings(), user: 'u1' }, 'u1', 'connectivity'), 'unknown');
    });

    it('the switches become the list: nothing while the master is off', () => {
        assert.deepEqual(chosenCollections({ master: true, preferences: true, connectivity: true }), ['preferences', 'connectivity']);
        assert.deepEqual(chosenCollections({ master: true, preferences: false, connectivity: true }), ['connectivity']);
        assert.deepEqual(chosenCollections({ master: false, preferences: true, connectivity: true }), []);
    });
});

describe('account sync — the sync controls', () => {
    const off = { master: false, preferences: true, connectivity: true };
    const on = { master: true, preferences: true, connectivity: true };
    const sends = (choice) => chosenCollections(choice);

    it('Enable turns both collections on; off sends nothing', () => {
        const enabled = applySyncToggle({ master: false, preferences: false, connectivity: false }, 'master', true);
        assert.deepEqual(enabled, on);
        assert.deepEqual(sends(enabled), ['preferences', 'connectivity']);
        assert.deepEqual(sends(applySyncToggle(on, 'master', false)), []);
    });

    it('unchecking one leaves the other; unchecking the last turns Enable off', () => {
        const one = applySyncToggle(on, 'connectivity', false);
        assert.deepEqual(one, { master: true, preferences: true, connectivity: false });
        assert.deepEqual(sends(one), ['preferences']);
        const none = applySyncToggle(one, 'preferences', false);
        assert.equal(none.master, false);
        assert.deepEqual(sends(none), []);
        assert.deepEqual(sends(applySyncToggle(one, 'connectivity', true)), ['preferences', 'connectivity']);
        assert.deepEqual(applySyncToggle(off, 'preferences', true), off, 'a checkbox never turns Enable on by itself');
    });
});

describe('account sync — when the one-time dialog shows', () => {
    const base = {
        available: true, userId: 'u1', settings: { user: 'u1', status: 'fresh', decided: false, collections: [] },
        allHasLoaded: true, offHome: false, overlayOpen: false, authPending: false, shown: false,
    };
    const cases = [
        ['undecided, fresh, tests done', {}, true],
        ['off Home before the tests finish', { allHasLoaded: false, offHome: true }, true],
        ['decided', { settings: { ...base.settings, decided: true } }, false],
        ['from the cache only', { settings: { ...base.settings, status: 'cached' } }, false],
        ['settings unknown', { settings: { ...base.settings, status: 'unknown' } }, false],
        ['another user\'s settings', { settings: { ...base.settings, user: 'u2' } }, false],
        ['not signed in', { userId: null }, false],
        ['sync not available', { available: false }, false],
        ['Home\'s tests still running', { allHasLoaded: false }, false],
        ['another overlay open', { overlayOpen: true }, false],
        ['a sign-in or sign-out under way', { authPending: true }, false],
        ['already shown this page load', { shown: true }, false],
    ];
    for (const [name, over, expected] of cases) {
        it(name, () => assert.equal(shouldShowSyncDialog({ ...base, ...over }), expected));
    }
});

describe('account sync — the commands app code awaits', () => {
    let unregister = () => {};
    afterEach(() => unregister());

    it('syncBeforeReload: true once the owner has done it; false on a timeout, an error or no owner', async () => {
        assert.equal(SIGN_IN_SYNC_TIMEOUT_MS, 3000);
        assert.equal(await syncBeforeReload('u1'), false, 'no owner');
        const calls = [];
        unregister = registerAppCommand(BEFORE_RELOAD_COMMAND, async (payload) => {
            calls.push(payload);
            return true;
        });
        assert.equal(await syncBeforeReload('u1'), true);
        assert.deepEqual(calls, [{ userId: 'u1' }]);
        unregister();
        unregister = registerAppCommand(BEFORE_RELOAD_COMMAND, () => new Promise(() => {}));
        assert.equal(await syncBeforeReload('u1', { timeoutMs: 20 }), false, 'timeout');
        unregister();
        unregister = registerAppCommand(BEFORE_RELOAD_COMMAND, async () => { throw new Error('boom'); });
        assert.equal(await syncBeforeReload('u1'), false, 'error');
    });

    it('clearAccountDataBeforeSignOut: the number cleared, 0 on any failure; the flush bound sits inside the cap', async () => {
        assert.ok(SIGN_OUT_FLUSH_MS < SIGN_OUT_TIMEOUT_MS);
        assert.equal(await clearAccountDataBeforeSignOut('u1'), 0);
        unregister = registerAppCommand(SIGN_OUT_COMMAND, async () => 2);
        assert.equal(await clearAccountDataBeforeSignOut('u1'), 2);
        unregister();
        unregister = registerAppCommand(SIGN_OUT_COMMAND, () => new Promise(() => {}));
        assert.equal(await clearAccountDataBeforeSignOut('u1', { timeoutMs: 20 }), 0);
    });

    it('saveSyncCollections: true once saved, false otherwise', async () => {
        assert.equal(await saveSyncCollections([]), false);
        const calls = [];
        unregister = registerAppCommand(SET_SYNC_COLLECTIONS_COMMAND, async (payload) => {
            calls.push(payload);
            return true;
        });
        assert.equal(await saveSyncCollections(['preferences']), true);
        assert.deepEqual(calls, [{ collections: ['preferences'] }]);
    });
});
