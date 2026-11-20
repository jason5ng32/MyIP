// Contract tests for the Pinia main store — key actions and getters.
//
// store.js has top-level dependencies (locales/i18n, firebase-init.js,
// import.meta.env.VITE_*) that don't exist in the Node test environment.
// The store source already uses explicit `.js` suffixes and reads
// import.meta.env via optional chaining so it imports cleanly here; we
// just need to inject minimal localStorage / window / document stubs
// BEFORE the store import (see below).

// ---- globalThis stubs (must be installed before importing store) ----
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] ?? null; },
  setItem(k, v) { this._data[k] = v; },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; },
};
globalThis.window = {
  location: { search: '' },
  addEventListener() {},
  innerWidth: 1024,
};
const classListCalls = [];
globalThis.document = {
  addEventListener() {},
  title: '',
  querySelector() { return null; },
  documentElement: {
    classList: {
      toggle(cls, on) { classListCalls.push({ cls, on }); },
    },
  },
};

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';

const { useMainStore } = await import('../frontend/store.js');
const { useAccountSync, createSyncAdapters } = await import('../frontend/composables/use-account-sync.js');
const { fakeServer } = await import('./fake-sync-server.js');
const { readSyncRecord } = await import('../frontend/utils/features/account-sync.js');
const { SYNC_COLLECTIONS } = await import('../frontend/utils/sync-collections.js');

beforeEach(() => {
  setActivePinia(createPinia());
  classListCalls.length = 0;
  globalThis.localStorage.clear();
});

describe('store — trivial setter actions', () => {
  it('setAlert bundles all five args into state.alert', () => {
    const s = useMainStore();
    s.setAlert(true, 'text-success', 'msg', 'title', 5000);
    assert.deepEqual(s.alert, {
      alertToShow: true,
      alertStyle: 'text-success',
      alertMessage: 'msg',
      alertTitle: 'title',
      alertDuration: 5000,
    });
  });
});

describe('store — sheet toggling', () => {
  it('setOpenSheet assigns directly', () => {
    const s = useMainStore();
    s.setOpenSheet('preferences');
    assert.equal(s.openSheet, 'preferences');
    s.setOpenSheet(null);
    assert.equal(s.openSheet, null);
  });

  it('toggleSheet opens when closed, closes when same name open', () => {
    const s = useMainStore();
    s.toggleSheet('tools');
    assert.equal(s.openSheet, 'tools');
    s.toggleSheet('tools');
    assert.equal(s.openSheet, null);
  });

  it('toggleSheet switches to new name when different sheet is open', () => {
    const s = useMainStore();
    s.toggleSheet('preferences');
    s.toggleSheet('tools');
    assert.equal(s.openSheet, 'tools');
  });

});

describe('store — dark mode side effect', () => {
  it('setDarkMode flips state AND toggles .dark class on <html>', () => {
    const s = useMainStore();
    s.setDarkMode(true);
    assert.equal(s.isDarkMode, true);
    assert.deepEqual(classListCalls.at(-1), { cls: 'dark', on: true });
    s.setDarkMode(false);
    assert.deepEqual(classListCalls.at(-1), { cls: 'dark', on: false });
  });
});

describe('store — IPDBs / allIPs', () => {

  it('updateAllIPs dedupes by ip and back-fills a missing country', () => {
    const s = useMainStore();
    s.updateAllIPs([{ ip: '1.1.1.1', country: 'US' }, { ip: '2.2.2.2', country: '' }]);
    s.updateAllIPs([{ ip: '2.2.2.2', country: 'DE' }, { ip: '3.3.3.3', country: 'JP' }]);
    const byIp = Object.fromEntries(s.allIPs.map((e) => [e.ip, e.country]));
    assert.deepEqual(byIp, { '1.1.1.1': 'US', '2.2.2.2': 'DE', '3.3.3.3': 'JP' });
  });

  it('updateAllIPs tolerates bare-string entries', () => {
    const s = useMainStore();
    s.updateAllIPs(['9.9.9.9']);
    assert.deepEqual(s.allIPs, [{ ip: '9.9.9.9', country: '', location: '', asn: '', org: '' }]);
  });

  it('updateAllIPs back-fills location / asn / org left empty by an earlier source', () => {
    const s = useMainStore();
    s.updateAllIPs([{ ip: '1.1.1.1', country: 'US' }]);
    s.updateAllIPs([{ ip: '1.1.1.1', location: 'United States · LA', asn: 'AS13335', org: 'Cloudflare' }]);
    // A later entry must not overwrite a field that already has a value.
    s.updateAllIPs([{ ip: '1.1.1.1', asn: 'AS9999' }]);
    assert.deepEqual(s.allIPs, [{
      ip: '1.1.1.1', country: 'US', location: 'United States · LA', asn: 'AS13335', org: 'Cloudflare',
    }]);
  });
});

describe('store — trigger* actions', () => {
  it('setTriggerRemoteUserInfo only sets when truthy (guard against reset loops)', () => {
    const s = useMainStore();
    s.setTriggerRemoteUserInfo(true);
    assert.equal(s.triggerRemoteUserInfo, true);
    // Passing false should NOT flip it back in current implementation
    s.setTriggerRemoteUserInfo(false);
    assert.equal(s.triggerRemoteUserInfo, true);
  });

  it('setTriggerUpdateAchievements writes flag + achievement name', () => {
    const s = useMainStore();
    s.setTriggerUpdateAchievements('CleverTrickery');
    assert.equal(s.triggerUpdateAchievements, true);
    assert.equal(s.achievementToUpdate, 'CleverTrickery');
  });
});

describe('store — preferences', () => {
  it('setPreferences persists to localStorage', () => {
    const s = useMainStore();
    s.setPreferences({ lang: 'zh', simpleMode: false });
    assert.deepEqual(s.userPreferences, { lang: 'zh', simpleMode: false });
    const fromStorage = JSON.parse(globalThis.localStorage.getItem('userPreferences_v7'));
    assert.deepEqual(fromStorage, { lang: 'zh', simpleMode: false });
  });

  it('updatePreference mutates a single key AND persists', () => {
    const s = useMainStore();
    s.setPreferences({ lang: 'en', autoRunConnectivity: true });
    s.updatePreference('autoRunConnectivity', false);
    assert.equal(s.userPreferences.autoRunConnectivity, false);
    const fromStorage = JSON.parse(globalThis.localStorage.getItem('userPreferences_v7'));
    assert.equal(fromStorage.autoRunConnectivity, false);
  });

  it('loadPreferences seeds defaults when nothing stored', () => {
    const s = useMainStore();
    s.loadPreferences();
    // Defaults come from createDefaultPreferences(); we don't pin the whole shape,
    // just assert the result is a non-empty object and gets persisted.
    assert.equal(typeof s.userPreferences, 'object');
    assert.ok(Object.keys(s.userPreferences).length > 0);
    assert.ok(globalThis.localStorage.getItem('userPreferences_v7'));
  });

  it('loadPreferences merges stored over defaults (stored keys win)', () => {
    globalThis.localStorage.setItem('userPreferences_v7', JSON.stringify({ lang: 'zh' }));
    const s = useMainStore();
    s.loadPreferences();
    assert.equal(s.userPreferences.lang, 'zh', 'stored lang wins');
    // A default key still present (autoRunConnectivity exists in defaults)
    assert.ok('autoRunConnectivity' in s.userPreferences, 'default keys fill in missing slots');
  });

  it('loadPreferences ignores legacy pref keys entirely', () => {
    globalThis.localStorage.setItem(
      'userPreferences_v6',
      JSON.stringify({ lang: 'fr', autoStart: false }),
    );
    const s = useMainStore();
    s.loadPreferences();
    // Legacy migration was retired: v6 content must not leak into the store,
    // and the stale key is left untouched (nothing reads it anymore).
    assert.equal(s.userPreferences.lang, 'auto', 'legacy lang does not carry over');
    assert.equal(s.userPreferences.autoRunConnectivity, true, 'defaults win');
    assert.ok(!('autoStart' in s.userPreferences));
  });
});

describe('store — preference edits and account sync', () => {
  const RECORD_KEY = 'accountSync_preferences_v7';
  const record = () => JSON.parse(globalThis.localStorage.getItem(RECORD_KEY) ?? 'null');
  // A synced record holding one stamped key.
  const seedRecord = () => globalThis.localStorage.setItem(RECORD_KEY, JSON.stringify({
    user: 'u1', cursor: 3, lastSyncAt: 1, items: { theme: { hash: 'x', at: 5, ack: 5 } },
  }));

  it('updatePreference and setPreferences count an edit and write no sync record', () => {
    const s = useMainStore();
    s.loadPreferences();
    s.updatePreference('theme', 'dark');
    s.updatePreference('connectivityDefaultListId', 'work');
    s.setPreferences({ ...s.userPreferences, lang: 'fr' });
    assert.equal(s.preferenceEdits, 3);
    assert.equal(record(), null);
  });

  it('loadPreferences counts no edit and gives defaults unstamped hashes in an existing record', () => {
    seedRecord();
    globalThis.localStorage.setItem('userPreferences_v7', JSON.stringify({ theme: 'dark' }));
    const s = useMainStore();
    s.loadPreferences();
    assert.equal(s.preferenceEdits, 0);
    const { items } = record();
    assert.deepEqual(items.theme, { hash: 'x', at: 5, ack: 5 }, 'a stored value is left as recorded');
    assert.equal(typeof items.lang.hash, 'string');
    assert.equal(items.lang.at, undefined, 'a default is no edit');
    assert.equal(items.connectivityLists, undefined, 'Connectivity lists are their own collection');
  });

  it('loadPreferences starts no record', () => {
    const s = useMainStore();
    s.loadPreferences();
    assert.equal(record(), null);
  });

  it('applySyncedPreferences writes and persists without counting an edit, skipping invalid values', () => {
    const s = useMainStore();
    s.loadPreferences();
    s.applySyncedPreferences({ theme: 'light', ipCardsToShow: 3, connectivityDefaultListId: '', simpleMode: true, junk: 1 });
    assert.equal(s.userPreferences.theme, 'light');
    assert.equal(s.userPreferences.simpleMode, true);
    assert.equal(s.userPreferences.ipCardsToShow, 2);
    assert.equal(s.userPreferences.connectivityDefaultListId, 'mine');
    assert.equal('junk' in s.userPreferences, false);
    assert.equal(JSON.parse(globalThis.localStorage.getItem('userPreferences_v7')).theme, 'light');
    assert.equal(s.preferenceEdits, 0);
  });

  it('applySyncedPreferences sanitizes Connectivity lists and falls back from an unavailable IP source', () => {
    const s = useMainStore();
    s.loadPreferences();
    s.ipDBs = s.ipDBs.map((db) => ({ ...db, enabled: db.id !== 2 }));
    const lists = { schemaVersion: 1, lists: [{ id: 'mine', name: null, members: [] }] };
    s.applySyncedPreferences({ ipGeoSource: 2, connectivityLists: lists, connectivityDefaultListId: 'work' });
    assert.equal(s.userPreferences.ipGeoSource, 3);
    assert.ok(s.userPreferences.connectivityLists.lists[0].members.length > 0, 'an emptied Mine is re-seeded');
    assert.equal(s.userPreferences.connectivityDefaultListId, 'work');
    s.applySyncedPreferences({ connectivityLists: { schemaVersion: 1, lists: 'nope' } });
    assert.ok(Array.isArray(s.userPreferences.connectivityLists.lists), 'an invalid model is skipped');
  });

  it('the config-driven IP source fallback refreshes its hash unstamped and counts no edit', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ ipChecking: false }) });
    try {
      const s = useMainStore();
      s.loadPreferences();
      seedRecord();
      s.fetchConfigs();
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.notEqual(s.userPreferences.ipGeoSource, 0);
      assert.equal(typeof record().items.ipGeoSource.hash, 'string');
      assert.equal(record().items.ipGeoSource.at, undefined);
      assert.equal(s.preferenceEdits, 0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('resetSyncedPreferences resets one collection to a fresh visitor\'s values and counts no edit', () => {
    const s = useMainStore();
    s.loadPreferences();
    const freshLists = s.userPreferences.connectivityLists;
    s.updatePreference('theme', 'dark');
    s.updatePreference('ipCardsToShow', 4);
    s.updatePreference('connectivityDefaultListId', 'work');
    s.updatePreference('connectivityLists', { ...freshLists, lists: [...freshLists.lists, { id: 'work', name: 'Work', members: [] }] });
    const edits = s.preferenceEdits;
    s.resetSyncedPreferences('preferences');
    assert.equal(s.userPreferences.theme, 'auto');
    assert.equal(s.userPreferences.ipCardsToShow, 2);
    assert.equal(s.userPreferences.connectivityDefaultListId, 'work', 'the other collection is left alone');
    s.resetSyncedPreferences('connectivity');
    assert.equal(s.userPreferences.connectivityDefaultListId, 'mine');
    assert.deepEqual(s.userPreferences.connectivityLists, freshLists);
    assert.equal(JSON.parse(globalThis.localStorage.getItem('userPreferences_v7')).theme, 'auto');
    assert.equal(s.preferenceEdits, edits);
  });

  it('setSyncSettings holds the account\'s settings, unknown at first', () => {
    const s = useMainStore();
    assert.equal(s.syncSettings.status, 'unknown');
    s.setSyncSettings({ user: 'u1', status: 'fresh', decided: true, collections: ['preferences'] });
    assert.deepEqual(s.syncSettings.collections, ['preferences']);
  });

  it('accountSyncAvailable needs sign-in and user storage', () => {
    const s = useMainStore();
    for (const [accounts, configs, available] of [
      [false, { userStorage: true }, false], [true, {}, false], [true, { userStorage: true }, true],
    ]) {
      s.isFireBaseSet = accounts;
      s.configs = configs;
      assert.equal(s.accountSyncAvailable, available, JSON.stringify({ accounts, configs }));
    }
  });
});

describe('store — an edit lands on the freshest stored preferences', () => {
  const PREFS_KEY = 'userPreferences_v7';
  const stored = () => JSON.parse(globalThis.localStorage.getItem(PREFS_KEY));
  // A tab: its own store over the shared localStorage, booted like the page.
  const tab = () => {
    setActivePinia(createPinia());
    const s = useMainStore();
    s.loadPreferences();
    return s;
  };
  const listIds = (s) => s.userPreferences.connectivityLists.lists.map((list) => list.id);
  const addList = (id) => (lists) => ({ lists: [...lists, { id, name: id, members: [] }] });

  it('a key edit keeps the keys another tab saved since', () => {
    const one = tab();
    const two = tab();
    one.updatePreference('theme', 'dark');
    two.updatePreference('simpleMode', true);
    assert.equal(stored().theme, 'dark');
    assert.equal(stored().simpleMode, true);
    assert.equal(two.userPreferences.theme, 'dark', 'the editing tab shows it too');
    assert.equal(one.userPreferences.simpleMode, false, 'an idle tab is never rewritten');
  });

  it('a list edit runs on the freshest lists: two tabs each adding a list keep both', () => {
    const one = tab();
    const two = tab();
    one.editConnectivityLists(addList('list-a'));
    two.editConnectivityLists(addList('list-b'));
    assert.deepEqual(listIds(two), ['mine', 'list-a', 'list-b']);
    assert.deepEqual(stored().connectivityLists.lists.map((list) => list.id), ['mine', 'list-a', 'list-b']);
    assert.deepEqual(listIds(one), ['mine', 'list-a'], 'the idle tab keeps what it showed');
  });

  it('account sync reads what storage holds now, so another tab\'s new list is not taken for a delete here', () => {
    const one = tab();
    const two = tab();
    one.editConnectivityLists(addList('list-a'));
    const items = createSyncAdapters(two).find((adapter) => adapter.id === 'connectivity').readLocal();
    assert.ok(Object.hasOwn(items, 'list:list-a'));
    assert.deepEqual(items.order, ['mine', 'list-a']);
  });

  it('editConnectivityLists returns the op\'s result; an error saves nothing and counts no edit', () => {
    const s = tab();
    const edits = s.preferenceEdits;
    assert.deepEqual(s.editConnectivityLists(() => ({ error: 'list-limit' })), { error: 'list-limit' });
    assert.equal(s.preferenceEdits, edits);
    const result = s.editConnectivityLists(addList('list-a'));
    assert.deepEqual(result.lists.map((list) => list.id), ['mine', 'list-a']);
    assert.equal(s.preferenceEdits, edits + 1);
  });

  it('values read back are checked as at boot: invalid ones ignored, lists sanitized', () => {
    const s = tab();
    globalThis.localStorage.setItem(PREFS_KEY, JSON.stringify({
      ...stored(), theme: 'purple', ipCardsToShow: 4, junk: 1,
      connectivityLists: { schemaVersion: 1, lists: [{ id: 'mine', name: null, members: [] }, { id: 'x', name: '', members: [] }] },
    }));
    s.updatePreference('simpleMode', true);
    assert.equal(s.userPreferences.theme, 'auto');
    assert.equal(s.userPreferences.ipCardsToShow, 4);
    assert.equal('junk' in s.userPreferences, false);
    assert.deepEqual(listIds(s), ['mine']);
    assert.ok(s.userPreferences.connectivityLists.lists[0].members.length > 0, 'an emptied Mine is re-seeded');
    assert.equal(stored().theme, 'auto');
  });

  it('a missing or unreadable blob changes nothing but the edit', () => {
    const s = tab();
    s.updatePreference('theme', 'dark');
    for (const blob of [null, '{x', '[1]', '"text"']) {
      if (blob === null) globalThis.localStorage.removeItem(PREFS_KEY);
      else globalThis.localStorage.setItem(PREFS_KEY, blob);
      s.updatePreference('simpleMode', !s.userPreferences.simpleMode);
      assert.equal(s.userPreferences.theme, 'dark', String(blob));
      assert.equal(stored().theme, 'dark', String(blob));
    }
  });

  describe('with account sync in both tabs', () => {
    const scopes = [];
    afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));
    const settle = async () => {
      for (let i = 0; i < 8; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2));
        await nextTick();
      }
    };
    let clock = 1_000_000;
    const syncedTab = (server) => {
      const s = tab();
      Object.assign(s, { isFireBaseSet: true, configs: { userStorage: true }, user: { uid: 'u1' }, isSignedIn: true, authResolved: true });
      const scope = effectScope();
      scopes.push(scope);
      // The second tab registers the commands again: that warning is expected here.
      const realWarn = console.warn;
      console.warn = () => {};
      try {
        scope.run(() => useAccountSync({ store: s, request: server.request, storage: globalThis.localStorage, now: () => (clock += 1000), delayMs: 0 }));
      } finally {
        console.warn = realWarn;
      }
      return s;
    };

    it('two tabs each adding a list: both lists locally and in the account; the re-read stamps nothing', async () => {
      const server = fakeServer();
      const one = syncedTab(server);
      await settle();
      const two = syncedTab(server);
      await settle();
      one.editConnectivityLists(addList('list-a'));
      await settle();
      const mark = server.calls.length;
      two.editConnectivityLists(addList('list-b'));
      await settle();
      assert.deepEqual(listIds(two), ['mine', 'list-a', 'list-b']);
      assert.deepEqual(stored().connectivityLists.lists.map((list) => list.id), ['mine', 'list-a', 'list-b']);
      assert.deepEqual(Object.keys(server.live('connectivity')).filter((id) => id.startsWith('list:')).sort(), ['list:list-a', 'list:list-b', 'list:mine']);
      assert.deepEqual(server.live('connectivity').order, ['mine', 'list-a', 'list-b']);
      const later = server.calls.slice(mark).filter((call) => call.method === 'PUT');
      assert.deepEqual(later.map((call) => call.collection), ['connectivity'], 'no preference was stamped by the re-read');
      assert.deepEqual(later[0].body.items.map((item) => item.id), ['order', 'list:list-b'], 'tab one\'s list is not sent again');
      const record = readSyncRecord(globalThis.localStorage, SYNC_COLLECTIONS.connectivity);
      assert.equal(Object.values(record.items).some((entry) => entry.at > (entry.ack ?? 0)), false, 'nothing left pending');
    });
  });
});

describe('store — getters', () => {
  it('allHasLoaded is false when any loading flag is false', () => {
    const s = useMainStore();
    assert.equal(s.allHasLoaded, false);
  });

  it('allHasLoaded flips true when every flag is true', () => {
    const s = useMainStore();
    for (const key of Object.keys(s.loadingStatus)) s.setLoadingStatus(key, true);
    assert.equal(s.allHasLoaded, true);
  });

  it('activeSources returns only enabled databases', () => {
    const s = useMainStore();
    const firstId = s.ipDBs[0].id;
    // Availability is config-derived state; flip it the way fetchConfigs does.
    s.ipDBs[0].enabled = false;
    const active = s.activeSources;
    assert.ok(active.every((db) => db.enabled));
    assert.ok(!active.find((db) => db.id === firstId));
  });

  it('capabilities spreads configs and adds accounts from the sign-in setup', () => {
    const s = useMainStore();
    s.configs = { ipChecking: true, cloudFlare: false };
    s.isFireBaseSet = false;
    s.probeCapabilities = { invisibilityProbe: false, dnsLeakProbe: false };
    const base = { ipChecking: true, cloudFlare: false, invisibilityProbe: false, dnsLeakProbe: false, userStorage: false };
    assert.deepEqual(s.capabilities, { ...base, accounts: false });
    s.isFireBaseSet = true;
    assert.deepEqual(s.capabilities, { ...base, accounts: true });
  });

  it('capabilities carries userStorage from configs, false until they load', () => {
    const s = useMainStore();
    s.configs = {};
    assert.equal(s.capabilities.userStorage, false);
    s.configs = { userStorage: true };
    assert.equal(s.capabilities.userStorage, true);
  });

  it('achievements need sign-in + user storage, usage sign-in + the IPCheck.ing API, independently', () => {
    const s = useMainStore();
    const combos = [
      // [accounts, configs, achievements, usage]
      [false, { userStorage: true, ipChecking: true }, false, false],
      [true, {}, false, false],
      [true, { userStorage: true }, true, false],
      [true, { ipChecking: true }, false, true],
      [true, { userStorage: true, ipChecking: true }, true, true],
    ];
    for (const [accounts, configs, achievements, usage] of combos) {
      s.isFireBaseSet = accounts;
      s.configs = configs;
      assert.equal(s.achievementsAvailable, achievements, JSON.stringify({ accounts, configs }));
      assert.equal(s.usageAvailable, usage, JSON.stringify({ accounts, configs }));
    }
  });

  it('capabilities carries the build-time probe facts, never configs values', () => {
    const s = useMainStore();
    s.configs = { invisibilityProbe: true, dnsLeakProbe: true };
    s.probeCapabilities = { invisibilityProbe: false, dnsLeakProbe: true };
    assert.equal(s.capabilities.invisibilityProbe, false);
    assert.equal(s.capabilities.dnsLeakProbe, true);
  });

  it('probe facts default to off without the build-time variables', () => {
    const s = useMainStore();
    // No VITE_INVISIBILITY_TEST_SCRIPT_URL / VITE_DNS_LEAK_TEST_DOMAIN in Node tests.
    assert.deepEqual(s.probeCapabilities, { invisibilityProbe: false, dnsLeakProbe: false });
  });

  it('capabilities.accounts follows the sign-in setup, never a configs value', () => {
    const s = useMainStore();
    s.configs = { accounts: true };
    s.isFireBaseSet = false;
    assert.equal(s.capabilities.accounts, false);
    s.configs = { accounts: false };
    s.isFireBaseSet = true;
    assert.equal(s.capabilities.accounts, true);
  });

  it('curlDomainsHadSet is false when env not set', () => {
    const s = useMainStore();
    // In Node tests we don't inject VITE_CURL_* → curl.* is undefined → getter is falsy
    assert.equal(Boolean(s.curlDomainsHadSet), false);
  });
});

describe('store — getDbUrl delegates to buildDbUrl', () => {
  it('returns a URL built from the matching db template', () => {
    const s = useMainStore();
    const db = s.ipDBs[0];
    const url = s.getDbUrl(db.id, '1.1.1.1', 'en');
    // db.url is a template like /api/x?ip={{ip}}&lang={{lang}} — verify substitution
    assert.match(url, /1\.1\.1\.1/);
    assert.match(url, /en/);
  });

  it('returns a falsy value when id is unknown', () => {
    const s = useMainStore();
    const result = s.getDbUrl(9999, '1.1.1.1', 'en');
    // buildDbUrl returns undefined/'' for no-match; we only guarantee falsy
    assert.ok(!result, `expected falsy result for unknown id, got ${result}`);
  });
});

describe('store — linkedProviders', () => {
  const signedInWith = (store, ...providerIds) => {
    store.isSignedIn = true;
    store.user = { providerData: providerIds.map((providerId) => ({ providerId })) };
  };

  it('is empty while signed out', () => {
    const s = useMainStore();
    s.user = null;
    assert.deepEqual(s.linkedProviders, []);
  });

  it('names each provider and the icon the menu renders', () => {
    const s = useMainStore();
    signedInWith(s, 'google.com');
    assert.deepEqual(s.linkedProviders, [
      { providerId: 'google.com', label: 'Google', icon: 'ri:google-line' },
    ]);
  });

  it('keeps Firebase order when several are present', () => {
    const s = useMainStore();
    signedInWith(s, 'github.com', 'google.com');
    assert.deepEqual(s.linkedProviders.map((entry) => entry.label), ['GitHub', 'Google']);
  });

  it('falls back to the raw id for a provider the app does not offer', () => {
    const s = useMainStore();
    signedInWith(s, 'password');
    // Shown rather than hidden: an account signing in some other way should
    // not read as having no sign-in method at all.
    assert.deepEqual(s.linkedProviders, [
      { providerId: 'password', label: 'password', icon: null },
    ]);
  });
});

describe('store — handleSignInError', () => {
  const google = { label: 'Google', other: 'GitHub' };
  const github = { label: 'GitHub', other: 'Google' };
  // i18n has no messages loaded here, so t() returns the key itself — which
  // makes these tests about WHICH message each code picks.
  const fail = (store, code, descriptor) => {
    store.setAlert(false, '', '', '', 0);
    store.handleSignInError({ code }, descriptor);
    return store.alert;
  };

  it('stays silent when the visitor just closes the popup', () => {
    const s = useMainStore();
    for (const code of ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']) {
      assert.equal(fail(s, code, github).alertToShow, false, code);
    }
  });

  it('warns and points at the other provider when the email is taken', () => {
    const s = useMainStore();
    for (const code of [
      'auth/account-exists-with-different-credential',
      'auth/email-already-in-use',
      'auth/credential-already-in-use',
    ]) {
      const alert = fail(s, code, github);
      assert.equal(alert.alertMessage, 'alert.SignInEmailTakenMessage', code);
      assert.equal(alert.alertStyle, 'text-warning', code);
    }
  });

  it('still surfaces unexpected failures as errors', () => {
    const s = useMainStore();
    const unknown = fail(s, 'auth/network-request-failed', google);
    assert.equal(unknown.alertStyle, 'text-danger');
    assert.ok(unknown.alertToShow);
  });

  it('survives an error object with no code at all', () => {
    const s = useMainStore();
    s.setAlert(false, '', '', '', 0);
    s.handleSignInError(new Error('boom'), google);
    assert.equal(s.alert.alertStyle, 'text-danger');
  });
});

describe('store — quota snapshot', () => {
  // The backend's /api/usage quota carries percentages only.
  const snapshot = (features) => ({ quota: { isSponsor: false, features } });

  it('quotaExceeded(key) reads the exhausted flag, not the percentage', () => {
    const s = useMainStore();
    s.remoteUserInfo = snapshot({
      ipinfo: { percent: 100, exhausted: true },
      dns_leak_test: { percent: 99, exhausted: false },
    });
    assert.equal(s.quotaExceeded('ipinfo'), true);
    assert.equal(s.quotaExceeded('dns_leak_test'), false);
    // Absent features and a missing snapshot read as not exceeded.
    assert.equal(s.quotaExceeded('persona_check'), false);
    s.remoteUserInfo = null;
    assert.equal(s.quotaExceeded('ipinfo'), false);
  });

  it('markQuotaExhausted pins a feature to exhausted after a 429', () => {
    const s = useMainStore();
    s.remoteUserInfo = snapshot({ invisibility_test: { percent: 42, exhausted: false } });
    s.markQuotaExhausted('invisibility_test');
    assert.deepEqual(s.remoteUserInfo.quota.features.invisibility_test, { percent: 100, exhausted: true });
    assert.equal(s.quotaExceeded('invisibility_test'), true);
  });

  it('quotaExceeded covers the IP Blocklist Check (ip_hitlist)', () => {
    const s = useMainStore();
    s.remoteUserInfo = snapshot({ ip_hitlist: { percent: 100, exhausted: true } });
    assert.equal(s.quotaExceeded('ip_hitlist'), true);
  });

  it('markQuotaExhausted is a no-op without a snapshot for the feature', () => {
    const s = useMainStore();
    s.remoteUserInfo = snapshot({});
    s.markQuotaExhausted('dns_leak_test');
    assert.deepEqual(s.remoteUserInfo.quota.features, {});
  });
});
