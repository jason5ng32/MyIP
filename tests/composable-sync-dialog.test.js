// Tests for frontend/composables/use-sync-dialog.js — the one-time sync dialog opens once its conditions hold (the
// table itself is in account-sync-collections.test.js), waits while another overlay is on screen, opens once per page
// load, and every exit saves a choice: Save the chosen collections, "Not now" / Esc / the overlay none.

globalThis.window ??= { location: { search: '' }, addEventListener() {}, innerWidth: 1024 };
globalThis.document ??= { addEventListener() {}, title: '', querySelector: () => null };

import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { effectScope, reactive, nextTick } from 'vue';

const { useSyncDialog } = await import('../frontend/composables/use-sync-dialog.js');

let scope = null;

const start = ({ settings = {}, store: over = {}, overlay = () => false, retryMs = 5 } = {}) => {
    const store = reactive({
        accountSyncAvailable: true,
        isSignedIn: true,
        user: { uid: 'u1' },
        allHasLoaded: true,
        openSheet: null,
        authPending: false,
        syncSettings: { user: 'u1', status: 'fresh', decided: false, collections: [], ...settings },
        ...over,
    });
    const route = reactive({ matched: [{}], name: 'home' });
    const saves = [];
    const tracks = [];
    let api;
    scope = effectScope();
    scope.run(() => {
        api = useSyncDialog({
            store, route, isOverlayOpen: overlay, retryMs,
            save: async (collections) => { saves.push(collections); return true; },
            track: (...args) => tracks.push(args),
        });
    });
    return { store, route, saves, tracks, ...api };
};

afterEach(() => {
    scope?.stop();
    scope = null;
});

describe('sync dialog — when it opens', () => {
    it('opens for a fresh, undecided account once Home\'s tests are done, and says so', async () => {
        const { open, store, tracks } = start({ store: { allHasLoaded: false } });
        await nextTick();
        assert.equal(open.value, false);
        store.allHasLoaded = true;
        await nextTick();
        assert.equal(open.value, true);
        assert.deepEqual(tracks, [['Sync', 'SyncDialog', 'Show']]);
    });

    it('never from the cache alone, never for a decided account', async () => {
        assert.equal(start({ settings: { status: 'cached' } }).open.value, false);
        scope.stop();
        assert.equal(start({ settings: { decided: true } }).open.value, false);
    });

    it('waits for another overlay to close', async () => {
        let overlayOpen = true;
        const { open } = start({ overlay: () => overlayOpen });
        assert.equal(open.value, false);
        overlayOpen = false;
        await new Promise((resolve) => setTimeout(resolve, 20));
        assert.equal(open.value, true);
    });

    it('waits for the Preferences sheet and a sign-in or sign-out', async () => {
        const { open, store } = start({ store: { openSheet: 'preferences', authPending: true } });
        store.openSheet = null;
        await nextTick();
        assert.equal(open.value, false);
        store.authPending = false;
        await nextTick();
        assert.equal(open.value, true);
    });

    it('opens once per page load', async () => {
        const { open, dismiss, store } = start();
        await dismiss();
        store.syncSettings = { ...store.syncSettings };
        await nextTick();
        assert.equal(open.value, false);
    });
});

describe('sync dialog — every exit saves a choice', () => {
    it('Save sends the chosen collections; nothing while the master is off', async () => {
        const first = start();
        await first.saveChoice({ master: true, preferences: true, connectivity: false });
        assert.deepEqual(first.saves, [['preferences']]);
        assert.deepEqual(first.tracks.at(-1), ['Sync', 'SyncDialog', 'Save']);
        assert.equal(first.open.value, false);
        scope.stop();
        const second = start();
        await second.saveChoice({ master: false, preferences: true, connectivity: true });
        assert.deepEqual(second.saves, [[]]);
    });

    it('"Not now", Esc or the overlay save an empty choice, once', async () => {
        const { dismiss, saveChoice, saves, tracks, open } = start();
        await dismiss();
        await dismiss();
        await saveChoice({ master: true, preferences: true, connectivity: true });
        assert.deepEqual(saves, [[]]);
        assert.deepEqual(tracks.at(-1), ['Sync', 'SyncDialog', 'Dismiss']);
        assert.equal(open.value, false);
    });
});
