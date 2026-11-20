// Tests for the per-collection pure helpers of account sync: the preferences and Connectivity items over
// userPreferences, what a pull's changes make of them (lists rebuilt in order, Mine kept) and the unstamped hash refresh (utils/features/preferences-sync.js), the account's sync settings,
// their cache and the one-time dialog's show rule (utils/features/sync-settings.js), and the commands app code awaits
// (utils/features/account-sync-auth.js).

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';

import {
    SYNC_ITEM_READERS, SYNC_ITEM_WRITERS, applySyncItems, syncDefaultPreferences, orderConnectivityLists,
    changedSyncItems, refreshSyncRecords,
} from '../frontend/utils/features/preferences-sync.js';
import {
    SYNC_SETTINGS_CACHE_KEY, createSyncSettings, readSyncSettingsAnswer, readCachedSyncSettings,
    writeCachedSyncSettings, clearCachedSyncSettings, collectionSyncState, chosenCollections,
    applySyncToggle, defaultSyncChoice, syncChoiceOf,
} from '../frontend/utils/features/sync-settings.js';
import {
    BEFORE_RELOAD_COMMAND, SIGN_OUT_COMMAND, SET_SYNC_COLLECTIONS_COMMAND, SIGN_IN_SYNC_TIMEOUT_MS,
    SIGN_OUT_FLUSH_MS, SIGN_OUT_TIMEOUT_MS, syncBeforeReload, clearAccountDataBeforeSignOut, saveSyncCollections,
} from '../frontend/utils/features/account-sync-auth.js';
import { registerAppCommand } from '../frontend/utils/app-commands.js';
import {
    CHECKLIST_STORAGE_KEY, cleanChecklistProgress, readStoredChecklist, writeStoredChecklist, applyChecklistMarks,
    applyChecklistItems, unsetAllMarks,
} from '../frontend/utils/features/checklist-progress.js';
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

const ALL = ['preferences', 'connectivity', 'checklist', 'speedtest'];
const prefs = (over = {}) => ({ ...DEFAULT_PREFERENCES, connectivityLists: sanitizeLists(null, null, []), ...over });
const site = (id) => ({ id, name: `Site ${id}`, url: `https://${id}.example.com/favicon.ico` });
const withWork = () => {
    const base = sanitizeLists(null, null, []);
    return { ...base, lists: [...base.lists, { id: 'work', name: 'Work', members: [] }] };
};

describe('account sync — the collections', () => {
    it('the four registry collections; all but the checklist read from userPreferences', () => {
        assert.deepEqual([...SYNC_COLLECTION_IDS], ['preferences', 'connectivity', 'checklist', 'speedtest']);
        assert.deepEqual(Object.keys(SYNC_ITEM_READERS), ['preferences', 'connectivity', 'speedtest']);
    });

    it('speedtest: the two sizes, a stored size outside the options read as its default; never preferences', () => {
        assert.deepEqual(SYNC_ITEM_READERS.speedtest(prefs({ speedtestDownloadBytes: 100e6 })), { downloadBytes: 100e6, uploadBytes: 15e6 });
        assert.deepEqual(SYNC_ITEM_READERS.speedtest(prefs({ speedtestDownloadBytes: 7, speedtestUploadBytes: '1e6' })),
            { downloadBytes: DEFAULT_PREFERENCES.speedtestDownloadBytes, uploadBytes: DEFAULT_PREFERENCES.speedtestUploadBytes });
        for (const [id, value] of Object.entries(SYNC_ITEM_READERS.speedtest(prefs()))) {
            assert.ok(SYNC_COLLECTIONS.speedtest.isValidValue(id, value), id);
        }
        assert.deepEqual(SYNC_ITEM_WRITERS.speedtest(prefs(), { upserts: { uploadBytes: 1e6 }, deletes: ['downloadBytes'] }),
            { speedtestDownloadBytes: DEFAULT_PREFERENCES.speedtestDownloadBytes, speedtestUploadBytes: 1e6 });
        assert.deepEqual(syncDefaultPreferences('speedtest'), { speedtestDownloadBytes: 50e6, speedtestUploadBytes: 15e6 });
        const items = SYNC_ITEM_READERS.preferences(prefs());
        for (const key of ['speedtestDownloadBytes', 'speedtestUploadBytes']) assert.equal(key in items, false, key);
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

    it('connectivity: the order, the default list id and one item per list without its id, valid for the server', () => {
        const items = SYNC_ITEM_READERS.connectivity(prefs({ connectivityLists: withWork(), connectivityDefaultListId: 'mine' }));
        assert.deepEqual(Object.keys(items), ['order', 'defaultListId', 'list:mine', 'list:work']);
        assert.deepEqual(items.order, ['mine', 'work']);
        assert.deepEqual(items['list:work'], { name: 'Work', members: [] });
        assert.equal(items['list:mine'].name, null);
        for (const [id, value] of Object.entries(items)) assert.ok(SYNC_COLLECTIONS.connectivity.isValidValue(id, value), id);
        assert.deepEqual(Object.keys(SYNC_ITEM_READERS.connectivity(prefs({ connectivityLists: null }))), ['order', 'defaultListId', 'list:mine']);
    });

    it('writers: the collection\'s own items give back the very same preferences', () => {
        for (const id of Object.keys(SYNC_ITEM_READERS)) {
            const current = prefs({
                theme: 'dark', connectivityLists: withWork(), connectivityDefaultListId: 'work', speedtestUploadBytes: 100e6,
            });
            const values = applySyncItems(id, prefs(), { upserts: SYNC_ITEM_READERS[id](current), deletes: [] });
            assert.deepEqual(SYNC_ITEM_READERS[id]({ ...prefs(), ...values }), SYNC_ITEM_READERS[id](current), id);
        }
        assert.equal(SYNC_ITEM_WRITERS.preferences(prefs(), { upserts: {}, deletes: ['theme'] }).theme, DEFAULT_PREFERENCES.theme);
    });

    it('connectivity writer: lists added, replaced and deleted on top of the current model', () => {
        const current = prefs({ connectivityLists: withWork() });
        const { connectivityLists, ...rest } = applySyncItems('connectivity', current, {
            upserts: { 'list:home': { name: 'Home', members: [site('h')] }, 'list:work': { name: 'Office', members: [] } },
            deletes: [],
        });
        assert.deepEqual(rest, {}, 'the default list id is left alone');
        assert.deepEqual(connectivityLists.lists.map((list) => [list.id, list.name]), [['mine', null], ['work', 'Office'], ['home', 'Home']]);
        const deleted = applySyncItems('connectivity', current, { upserts: {}, deletes: ['list:work', 'defaultListId'] });
        assert.deepEqual(deleted.connectivityLists.lists.map((list) => list.id), ['mine']);
        assert.equal(deleted.connectivityDefaultListId, DEFAULT_PREFERENCES.connectivityDefaultListId);
    });

    it('connectivity writer: a tombstone never removes Mine, and Mine keeps a null name', () => {
        const current = prefs({ connectivityLists: withWork() });
        const mine = current.connectivityLists.lists[0];
        const kept = applySyncItems('connectivity', current, { upserts: {}, deletes: ['list:mine'] });
        assert.deepEqual(kept.connectivityLists.lists[0], mine);
        const renamed = applySyncItems('connectivity', current, { upserts: { 'list:mine': { name: 'Mine', members: [site('m')] } }, deletes: [] });
        assert.deepEqual(renamed.connectivityLists.lists[0], { id: 'mine', name: null, members: [site('m')] });
    });

    it('order: the order item\'s ids first, ids without a list skipped, the lists it lacks after it by id', () => {
        const byId = new Map(['mine', 'list-3', 'list-1', 'list-2'].map((id) => [id, { id }]));
        assert.deepEqual(orderConnectivityLists(['list-2', 'gone', 'mine', 'list-2'], byId).map((list) => list.id), ['list-2', 'mine', 'list-1', 'list-3']);
        const current = prefs({ connectivityLists: withWork() });
        const reordered = applySyncItems('connectivity', current, { upserts: { order: ['work', 'mine'] }, deletes: [] });
        assert.deepEqual(reordered.connectivityLists.lists.map((list) => list.id), ['work', 'mine']);
    });

    it('a fresh visitor\'s values per collection', () => {
        assert.equal(syncDefaultPreferences('preferences').theme, DEFAULT_PREFERENCES.theme);
        assert.equal('connectivityLists' in syncDefaultPreferences('preferences'), false);
        assert.deepEqual(syncDefaultPreferences('connectivity'), {
            connectivityLists: sanitizeLists(null, null, []),
            connectivityDefaultListId: DEFAULT_PREFERENCES.connectivityDefaultListId,
        });
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
        assert.deepEqual(readSyncSettingsAnswer({ collections: ['connectivity', 'snapshots', 'preferences'] }),
            { collections: ['preferences', 'connectivity'] });
        for (const bad of [null, [], { collections: 'preferences' }, { decided: true }]) {
            assert.equal(readSyncSettingsAnswer(bad), null);
        }
    });

    it('caches per user: another user, junk or nothing reads as no cache', () => {
        const storage = memoryStorage();
        assert.equal(readCachedSyncSettings(storage, 'u1'), null);
        writeCachedSyncSettings(storage, { user: 'u1', status: 'fresh', collections: ['preferences'] });
        assert.deepEqual(readCachedSyncSettings(storage, 'u1'), { user: 'u1', status: 'cached', collections: ['preferences'] });
        assert.equal(readCachedSyncSettings(storage, 'u2'), null);
        clearCachedSyncSettings(storage);
        assert.equal(storage.data[SYNC_SETTINGS_CACHE_KEY], undefined);
        storage.data[SYNC_SETTINGS_CACHE_KEY] = '{x';
        assert.equal(readCachedSyncSettings(storage, 'u1'), null);
    });

    it('a collection is on or off only for the user the settings belong to, once known', () => {
        const settings = { user: 'u1', status: 'cached', collections: ['connectivity'] };
        assert.equal(collectionSyncState(settings, 'u1', 'connectivity'), 'on');
        assert.equal(collectionSyncState(settings, 'u1', 'preferences'), 'off');
        assert.equal(collectionSyncState(settings, 'u2', 'connectivity'), 'unknown');
        assert.equal(collectionSyncState(settings, null, 'connectivity'), 'unknown');
        assert.equal(collectionSyncState({ ...createSyncSettings(), user: 'u1' }, 'u1', 'connectivity'), 'unknown');
    });

    it('the switches become the list: nothing while the master is off', () => {
        assert.deepEqual(chosenCollections(syncChoiceOf(ALL)), ALL);
        assert.deepEqual(chosenCollections({ master: true, preferences: false, connectivity: true, checklist: true }), ['connectivity', 'checklist']);
        assert.deepEqual(chosenCollections({ ...defaultSyncChoice(), master: false }), []);
    });

    it('the controls\' state: every collection on by default; the account\'s list shown as it is', () => {
        assert.deepEqual(defaultSyncChoice(), { master: false, preferences: true, connectivity: true, checklist: true, speedtest: true });
        assert.deepEqual(syncChoiceOf([]), defaultSyncChoice());
        assert.deepEqual(syncChoiceOf(['preferences', 'connectivity']),
            { master: true, preferences: true, connectivity: true, checklist: false, speedtest: false });
    });
});

describe('account sync — the sync controls', () => {
    const off = defaultSyncChoice();
    const on = { ...defaultSyncChoice(), master: true };
    const sends = (choice) => chosenCollections(choice);

    it('Enable turns every collection on; off sends nothing', () => {
        const none = Object.fromEntries(Object.keys(on).map((key) => [key, false]));
        const enabled = applySyncToggle(none, 'master', true);
        assert.deepEqual(enabled, on);
        assert.deepEqual(sends(enabled), ALL);
        assert.deepEqual(sends(applySyncToggle(on, 'master', false)), []);
    });

    it('unchecking one leaves the others; unchecking the last turns Enable off', () => {
        const one = applySyncToggle(on, 'connectivity', false);
        assert.deepEqual(one, { ...on, connectivity: false });
        assert.deepEqual(sends(one), ['preferences', 'checklist', 'speedtest']);
        let rest = one;
        for (const id of ['preferences', 'checklist']) rest = applySyncToggle(rest, id, false);
        assert.equal(rest.master, true);
        const none = applySyncToggle(rest, 'speedtest', false);
        assert.equal(none.master, false);
        assert.deepEqual(sends(none), []);
        assert.deepEqual(sends(applySyncToggle(one, 'connectivity', true)), ALL);
        assert.deepEqual(applySyncToggle(off, 'preferences', true), off, 'a checkbox never turns Enable on by itself');
    });
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

describe('account sync — the checklist progress', () => {
    it('keeps marked, well-formed slugs only; an unreadable copy reads as none', () => {
        assert.deepEqual(cleanChecklistProgress({ 'a-b': 'checked', 'c-d': '', 'E': 'checked', 'e-f': 'ignored', 'g-h': 1 }),
            { 'a-b': 'checked', 'e-f': 'ignored' });
        assert.equal(cleanChecklistProgress([]), null);
        const storage = memoryStorage({ [CHECKLIST_STORAGE_KEY]: '{x' });
        assert.equal(readStoredChecklist(storage), null);
        writeStoredChecklist(storage, { 'a-b': 'checked' });
        assert.deepEqual(readStoredChecklist(storage), { 'a-b': 'checked' });
    });

    it('marks and a pull\'s changes: \'\' and a delete unset, junk is skipped', () => {
        assert.deepEqual(applyChecklistMarks({ 'a-b': 'checked' }, { 'a-b': '', 'c-d': 'ignored', 'X Y': 'checked' }), { 'c-d': 'ignored' });
        assert.deepEqual(applyChecklistItems({ 'a-b': 'checked', 'c-d': 'ignored' }, { upserts: { 'e-f': 'checked' }, deletes: ['a-b'] }),
            { 'c-d': 'ignored', 'e-f': 'checked' });
        assert.deepEqual(unsetAllMarks({ 'a-b': 'checked' }), { 'a-b': '' });
    });
});
