// use-shortcuts depends on shortcut.js, which calls document.addEventListener at module load time.
// Here we inject minimal document / window stubs first, then dynamically import the tested module.

import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { ref, computed, reactive } from 'vue';

const documentHandlers = {};
// Per-test override (see "o" shortcut cases below). Default: no card is
// currently highlighted via J/K, so any lookup returns null.
let querySelectorImpl = () => null;
globalThis.document = {
  addEventListener(type, handler) { documentHandlers[type] = handler; },
  getElementById() { return null; },
  querySelector(sel) { return querySelectorImpl(sel); },
};
globalThis.window = {
  scrollTo() {},
  scrollY: 0,
  pageYOffset: 0,
};

const { useShortcuts } = await import('../frontend/composables/use-shortcuts.js');

const t = (k) => `<${k}>`;

function makeStoreStub() {
  const state = reactive({
    userAchievements: { CleverTrickery: { achieved: false } },
    triggered: null,
    refreshRequested: false,
  });
  return {
    state,
    userAchievements: state.userAchievements,
    setTriggerUpdateAchievements(name) { state.triggered = name; },
    setRefreshEveryThing(v) { state.refreshRequested = v; },
  };
}

function makeRefs() {
  const calls = {
    queryOpen: 0,
    helpOpen: 0,
    additionalCurl: 0,
    footerAbout: 0,
    speedTest: 0,
    navPrefs: 0,
    advancedNavigate: [],
    advancedFullScreen: 0,
    ipRefresh: [],
    connectivity: [],
    webrtc: [],
    dnsleak: [],
    mask: 0,
  };

  const advancedToolsRef = ref({
    navigateAndToggleOffcanvas(path) { calls.advancedNavigate.push(path); },
    fullScreen() { calls.advancedFullScreen += 1; },
  });

  return {
    refs: {
      navBarRef:         ref({ OpenPreferences: () => { calls.navPrefs += 1; } }),
      preferencesRef:    ref({}),
      queryIPRef:        ref({ openModal: () => { calls.queryOpen += 1; } }),
      helpModalRef:      ref({ openModal: () => { calls.helpOpen += 1; }, keyMap: null }),
      additionalRef:     ref({ openCurlModal: () => { calls.additionalCurl += 1; } }),
      footerRef:         ref({ openAbout: () => { calls.footerAbout += 1; } }),
      speedTestRef:      ref({ speedTestController: () => { calls.speedTest += 1; } }),
      advancedToolsRef,
      IPCheckRef:        ref({
        ipDataCards: [
          { id: 'a', ip: '1.1.1.1' }, { id: 'b', ip: '2.2.2.2' }, { id: 'c', ip: '3.3.3.3' },
          { id: 'd', ip: '4.4.4.4' }, { id: 'e', ip: '5.5.5.5' }, { id: 'f', ip: '6.6.6.6' },
        ],
        refreshCard: (_card, i) => { calls.ipRefresh.push(i); },
      }),
      connectivityRef:   ref({ handelCheckStart: (flag) => { calls.connectivity.push(flag); } }),
      webRTCRef:         ref({ checkAllWebRTC: (flag) => { calls.webrtc.push(flag); } }),
      dnsLeaksRef:       ref({ checkAllDNSLeakTest: (flag) => { calls.dnsleak.push(flag); } }),
      isInfosLoaded:     ref(true),
      openedCard:        ref(1),
      toggleInfoMask:    () => { calls.mask += 1; },
    },
    calls,
  };
}

// use fake setTimeout to synchronize loadShortcuts
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => { fn(); return 0; };

after(() => {
  globalThis.setTimeout = realSetTimeout;
});

function loadAndGetKeyMap({ originalSite = false, isSignedIn = false } = {}) {
  const store = makeStoreStub();
  const { refs, calls } = makeRefs();
  const configs = computed(() => ({ originalSite, map: true }));
  const userPreferences = computed(() => ({ ipCardsToShow: 4 }));
  const signedInRef = computed(() => isSignedIn);

  const { loadShortcuts } = useShortcuts({
    refs, store, t, configs, userPreferences, isSignedIn: signedInRef,
  });
  loadShortcuts();

  // helpModalRef.keyMap receives the global keyMap after loadShortcuts
  const keyMap = refs.helpModalRef.value.keyMap || [];
  return { keyMap, store, refs, calls };
}

describe('useShortcuts()', () => {
  it('loadShortcuts() registers a keymap of 27+ entries on a non-original site', () => {
    const { keyMap } = loadAndGetKeyMap({ originalSite: false });
    // 27 base entries (no invisibility); keyMap is append-only globally so ≥ 27
    const distinctKeys = new Set(keyMap.map((e) => e.keys));
    assert.ok(distinctKeys.size >= 27, `expected ≥27 distinct shortcut keys, got ${distinctKeys.size}`);
    assert.ok(distinctKeys.has('R'));
    assert.ok(distinctKeys.has('?'));
    assert.ok(distinctKeys.has('g'));
    assert.ok(distinctKeys.has('o'));
  });

  it('originalSite=true adds the invisibility-test shortcut (key "i")', () => {
    const { keyMap } = loadAndGetKeyMap({ originalSite: true });
    const hasInvisibility = keyMap.some((e) => e.keys === 'i');
    assert.ok(hasInvisibility, 'key "i" should be present on originalSite');
  });

  it('"R" action triggers store.setRefreshEveryThing(true)', () => {
    const { keyMap, store } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === 'R');
    assert.ok(entry, '"R" key should be registered');
    entry.action();
    assert.equal(store.state.refreshRequested, true);
  });

  it('advanced-tool shortcuts navigate via advancedToolsRef.navigateAndToggleOffcanvas', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const l = keyMap.findLast((e) => e.keys === 'l'); l.action();
    const M = keyMap.findLast((e) => e.keys === 'M'); M.action();
    const t_ = keyMap.findLast((e) => e.keys === 't'); t_.action();
    assert.deepEqual(calls.advancedNavigate, ['/pingtest', '/macchecker', '/mtrtest']);
  });

  it('numeric regex "[1-6]" passes through number argument to refreshCard', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.type === 'regex');
    assert.ok(entry);
    entry.action(2); // user typed "2"
    assert.deepEqual(calls.ipRefresh, [1], 'action receives num; refreshCard(card, num-1)');
  });

  it('numeric shortcut respects userPreferences.ipCardsToShow upper bound', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.type === 'regex');
    entry.action(6); // beyond ipCardsToShow (4)
    assert.deepEqual(calls.ipRefresh, [], 'num > ipCardsToShow → no-op');
  });

  it('"?" opens help modal and triggers CleverTrickery achievement when signed in', () => {
    const { keyMap, store } = loadAndGetKeyMap({ isSignedIn: true });
    const entry = keyMap.findLast((e) => e.keys === '?');
    entry.action();
    assert.equal(store.state.triggered, 'CleverTrickery');
  });

  it('"?" skips achievement trigger when user is not signed in', () => {
    const { keyMap, store } = loadAndGetKeyMap({ isSignedIn: false });
    const entry = keyMap.findLast((e) => e.keys === '?');
    entry.action();
    assert.equal(store.state.triggered, null);
  });

  it('"h" toggles info mask only when infos loaded', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === 'h');
    entry.action();
    assert.equal(calls.mask, 1);
  });

  it('"o" opens the highlighted advanced tool by its data-adv-path', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    // Stub the highlighted card to be an advanced tool card pointing at /mtrtest.
    querySelectorImpl = (sel) => {
      if (sel === '.keyboard-shortcut-card[data-keyboard-hover="true"]') {
        return {
          getAttribute: (name) => name === 'data-adv-path' ? '/mtrtest' : null,
        };
      }
      return null;
    };
    const entry = keyMap.findLast((e) => e.keys === 'o');
    entry.action();
    querySelectorImpl = () => null;
    assert.deepEqual(calls.advancedNavigate, ['/mtrtest']);
  });

  it('"o" is a no-op when the highlighted card has no data-adv-path (e.g. IP card)', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    querySelectorImpl = () => ({ getAttribute: () => null });
    const entry = keyMap.findLast((e) => e.keys === 'o');
    entry.action();
    querySelectorImpl = () => null;
    assert.deepEqual(calls.advancedNavigate, []);
  });

  it('"o" is a no-op when nothing is highlighted', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    // querySelectorImpl default returns null (nothing highlighted).
    const entry = keyMap.findLast((e) => e.keys === 'o');
    entry.action();
    assert.deepEqual(calls.advancedNavigate, []);
  });
});
