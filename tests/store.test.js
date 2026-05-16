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
import { describe, it, beforeEach } from 'node:test';
import { createPinia, setActivePinia } from 'pinia';

const { useMainStore } = await import('../frontend/store.js');

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

  it('setLoadingStatus mutates one key at a time', () => {
    const s = useMainStore();
    assert.equal(s.loadingStatus.IPInfo, false);
    s.setLoadingStatus('IPInfo', true);
    assert.equal(s.loadingStatus.IPInfo, true);
    assert.equal(s.loadingStatus.Connectivity, false, 'other keys untouched');
  });

  it('setRefreshEveryThing mirrors payload', () => {
    const s = useMainStore();
    s.setRefreshEveryThing(true);
    assert.equal(s.shouldRefreshEveryThing, true);
    s.setRefreshEveryThing(false);
    assert.equal(s.shouldRefreshEveryThing, false);
  });

  it('setCurrentPath writes {path, id}', () => {
    const s = useMainStore();
    s.setCurrentPath('/mtrtest', 3);
    assert.deepEqual(s.currentPath, { path: '/mtrtest', id: 3 });
  });

  it('setMountingStatus mutates one key', () => {
    const s = useMainStore();
    s.setMountingStatus('WebRTC', true);
    assert.equal(s.mountingStatus.WebRTC, true);
  });

  it('setIsMobile mirrors payload', () => {
    const s = useMainStore();
    s.setIsMobile(true);
    assert.equal(s.isMobile, true);
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
  it('updateIPDBs flips the enabled flag of a matching entry', () => {
    const s = useMainStore();
    const firstId = s.ipDBs[0].id;
    assert.equal(s.ipDBs[0].enabled, true);
    s.updateIPDBs({ id: firstId, enabled: false });
    assert.equal(s.ipDBs[0].enabled, false);
  });

  it('updateIPDBs ignores unknown ids', () => {
    const s = useMainStore();
    const snapshot = s.ipDBs.map((d) => d.enabled);
    s.updateIPDBs({ id: 9999, enabled: false });
    assert.deepEqual(s.ipDBs.map((d) => d.enabled), snapshot);
  });

  it('updateAllIPs dedupes via Set union semantics', () => {
    const s = useMainStore();
    s.updateAllIPs(['1.1.1.1', '2.2.2.2']);
    s.updateAllIPs(['2.2.2.2', '3.3.3.3']);
    assert.deepEqual([...s.allIPs].sort(), ['1.1.1.1', '2.2.2.2', '3.3.3.3']);
  });
});

describe('store — trigger* actions', () => {
  it('setTriggerAchievements mirrors payload', () => {
    const s = useMainStore();
    s.setTriggerAchievements(true);
    assert.equal(s.triggerAchievements, true);
  });

  it('setTriggerUserBenefits mirrors payload', () => {
    const s = useMainStore();
    s.setTriggerUserBenefits(true);
    assert.equal(s.triggerUserBenefits, true);
  });

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
    s.setPreferences({ lang: 'zh', autoStart: false });
    assert.deepEqual(s.userPreferences, { lang: 'zh', autoStart: false });
    const fromStorage = JSON.parse(globalThis.localStorage.getItem('userPreferences_v6'));
    assert.deepEqual(fromStorage, { lang: 'zh', autoStart: false });
  });

  it('updatePreference mutates a single key AND persists', () => {
    const s = useMainStore();
    s.setPreferences({ lang: 'en', autoStart: true });
    s.updatePreference('autoStart', false);
    assert.equal(s.userPreferences.autoStart, false);
    const fromStorage = JSON.parse(globalThis.localStorage.getItem('userPreferences_v6'));
    assert.equal(fromStorage.autoStart, false);
  });

  it('loadPreferences seeds defaults when nothing stored', () => {
    const s = useMainStore();
    s.loadPreferences();
    // Defaults come from createDefaultPreferences(); we don't pin the whole shape,
    // just assert the result is a non-empty object and gets persisted.
    assert.equal(typeof s.userPreferences, 'object');
    assert.ok(Object.keys(s.userPreferences).length > 0);
    assert.ok(globalThis.localStorage.getItem('userPreferences_v6'));
  });

  it('loadPreferences merges stored over defaults (stored keys win)', () => {
    globalThis.localStorage.setItem('userPreferences_v6', JSON.stringify({ lang: 'zh' }));
    const s = useMainStore();
    s.loadPreferences();
    assert.equal(s.userPreferences.lang, 'zh', 'stored lang wins');
    // A default key still present (autoStart exists in defaults)
    assert.ok('autoStart' in s.userPreferences, 'default keys fill in missing slots');
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
    s.updateIPDBs({ id: firstId, enabled: false });
    const active = s.activeSources;
    assert.ok(active.every((db) => db.enabled));
    assert.ok(!active.find((db) => db.id === firstId));
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
