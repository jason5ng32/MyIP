// use-shortcuts depends on shortcut.js, which calls document.addEventListener at module load time.
// Here we inject minimal document / window stubs first, then dynamically import the tested module.
//
// pulse-beacon.js pulls `@/utils/...` (Vite alias) and gates the `p` shortcut on a
// build-time env flag — both are awkward in the Node runner. A load hook stubs
// that module with a mutable `isPulseEnabled` so we can cover both branches.

import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { registerHooks } from 'node:module';
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

registerHooks({
  load(url, context, nextLoad) {
    if (url.includes('/utils/pulse-beacon.js')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export const PULSE_URL = 'https://pulse.test';
          export const sendVisitBeacon = () => {};
          export let isPulseEnabled = false;
          globalThis.__setPulseEnabledForTest = (v) => { isPulseEnabled = Boolean(v); };
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { useShortcuts } = await import('../frontend/composables/use-shortcuts.js');
const { onAppEvent } = await import('../frontend/utils/app-events.js');

const t = (k) => `<${k}>`;

function makeStoreStub() {
  const state = reactive({
    refreshRequested: false,
    toggledSheets: [],
  });
  return {
    state,
    setRefreshEveryThing(v) { state.refreshRequested = v; },
    toggleSheet(name) { state.toggledSheets.push(name); },
  };
}

function makeRefs() {
  const calls = {
    queryOpen: 0,
    helpOpen: 0,
    shareOpen: 0,
    speedTest: 0,
    advancedNavigate: [],
    advancedFullScreen: 0,
    ipRefresh: [],
    connectivity: [],
    webrtc: [],
    dnsleak: [],
    mask: 0,
  };

  const advancedToolsRef = ref({
    openTool(slug) { calls.advancedNavigate.push(slug); },
    fullScreen() { calls.advancedFullScreen += 1; },
  });

  return {
    refs: {
      queryIPRef:        ref({ openModal: () => { calls.queryOpen += 1; } }),
      helpModalRef:      ref({ openModal: () => { calls.helpOpen += 1; }, keyMap: null }),
      shareReportRef:    ref({ openDialog: () => { calls.shareOpen += 1; } }),
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
      isToolOpen:        ref(true),
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
  globalThis.__setPulseEnabledForTest?.(false);
});

function loadAndGetKeyMap({
  originalSite = false,
  ipHistoryEnabled = true,
  pulseEnabled = false,
} = {}) {
  globalThis.__setPulseEnabledForTest(pulseEnabled);
  const store = makeStoreStub();
  const { refs, calls } = makeRefs();
  const configs = computed(() => ({ originalSite, map: true }));
  const userPreferences = computed(() => ({ ipCardsToShow: 2, ipHistoryEnabled }));

  const { loadShortcuts } = useShortcuts({
    refs, store, t, configs, userPreferences,
  });
  loadShortcuts();

  // helpModalRef.keyMap receives the global keyMap after loadShortcuts
  const keyMap = refs.helpModalRef.value.keyMap || [];
  return { keyMap, store, refs, calls };
}

describe('useShortcuts()', () => {
  it('loadShortcuts() registers a keymap of 27+ entries on a non-original site', () => {
    const { keyMap } = loadAndGetKeyMap({ originalSite: false, pulseEnabled: false });
    // 27 base entries (no invisibility / enhanced-DNS / pulse); keyMap is
    // append-only globally so ≥ 27
    const distinctKeys = new Set(keyMap.map((e) => e.keys));
    assert.ok(distinctKeys.size >= 27, `expected ≥27 distinct shortcut keys, got ${distinctKeys.size}`);
    assert.ok(distinctKeys.has('R'));
    assert.ok(distinctKeys.has('?'));
    assert.ok(distinctKeys.has('g'));
    assert.ok(distinctKeys.has('o'));
    assert.ok(distinctKeys.has('H'));
    assert.equal(distinctKeys.has('p'), false, 'pulse shortcut stays off when isPulseEnabled is false');
    assert.equal(distinctKeys.has('P'), false, 'persona shortcut stays off a self-hosted instance');
  });

  it('originalSite=true adds invisibility ("i"), enhanced DNS-leak ("D") and persona ("P") shortcuts', () => {
    const { keyMap, calls } = loadAndGetKeyMap({ originalSite: true });
    const hasInvisibility = keyMap.some((e) => e.keys === 'i');
    assert.ok(hasInvisibility, 'key "i" should be present on originalSite');
    const D = keyMap.findLast((e) => e.keys === 'D');
    assert.ok(D, 'key "D" should be present on originalSite');
    D.action();
    assert.deepEqual(calls.advancedNavigate, ['enhanceddnsleaktest']);
    // Uppercase P is its own key — lowercase p is Earth Online's.
    const P = keyMap.findLast((e) => e.keys === 'P');
    assert.ok(P, 'key "P" should be present on originalSite');
    P.action();
    assert.deepEqual(calls.advancedNavigate, ['enhanceddnsleaktest', 'personacheck']);
  });

  it('"R" action triggers store.setRefreshEveryThing(true)', () => {
    const { keyMap, store } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === 'R');
    assert.ok(entry, '"R" key should be registered');
    entry.action();
    assert.equal(store.state.refreshRequested, true);
  });

  it('advanced-tool shortcuts open via advancedToolsRef.openTool(slug)', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const l = keyMap.findLast((e) => e.keys === 'l'); l.action();
    const M = keyMap.findLast((e) => e.keys === 'M'); M.action();
    const t_ = keyMap.findLast((e) => e.keys === 't'); t_.action();
    assert.deepEqual(calls.advancedNavigate, ['pingtest', 'macchecker', 'mtrtest']);
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
    entry.action(6); // beyond ipCardsToShow (2)
    assert.deepEqual(calls.ipRefresh, [], 'num > ipCardsToShow → no-op');
  });

  it('"?" opens help modal and emits the shortcut:help-opened app event', () => {
    // The achievement itself (CleverTrickery) is the engine's concern —
    // use-shortcuts only emits the domain event. See achievement-rules tests.
    let emitted = 0;
    const off = onAppEvent('shortcut:help-opened', () => { emitted += 1; });
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === '?');
    entry.action();
    off();
    assert.equal(calls.helpOpen, 1);
    assert.equal(emitted, 1);
  });

  it('"e" opens the share report dialog', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === 'e');
    assert.ok(entry, '"e" key should be registered');
    entry.action();
    assert.equal(calls.shareOpen, 1);
  });

  it('"h" toggles info mask only when infos loaded', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    const entry = keyMap.findLast((e) => e.keys === 'h');
    entry.action();
    assert.equal(calls.mask, 1);
  });

  it('"H" opens the IP history sheet when ipHistoryEnabled', () => {
    const { keyMap, store } = loadAndGetKeyMap({ ipHistoryEnabled: true });
    const entry = keyMap.findLast((e) => e.keys === 'H');
    assert.ok(entry, '"H" key should be registered');
    entry.action();
    assert.deepEqual(store.state.toggledSheets, ['ipHistory']);
  });

  it('"H" is a no-op when ipHistoryEnabled is false', () => {
    const { keyMap, store } = loadAndGetKeyMap({ ipHistoryEnabled: false });
    const entry = keyMap.findLast((e) => e.keys === 'H');
    entry.action();
    assert.deepEqual(store.state.toggledSheets, []);
  });

  it('isPulseEnabled adds the pulse shortcut (key "p")', () => {
    const { keyMap, store } = loadAndGetKeyMap({ pulseEnabled: true });
    const entry = keyMap.findLast((e) => e.keys === 'p');
    assert.ok(entry, '"p" key should be present when isPulseEnabled');
    entry.action();
    assert.deepEqual(store.state.toggledSheets, ['pulse']);
  });

  it('"o" opens the highlighted advanced tool by its data-adv-slug', () => {
    const { keyMap, calls } = loadAndGetKeyMap();
    // Stub the highlighted card to be an advanced tool card pointing at mtrtest.
    querySelectorImpl = (sel) => {
      if (sel === '.keyboard-shortcut-card[data-keyboard-hover="true"]') {
        return {
          getAttribute: (name) => name === 'data-adv-slug' ? 'mtrtest' : null,
        };
      }
      return null;
    };
    const entry = keyMap.findLast((e) => e.keys === 'o');
    entry.action();
    querySelectorImpl = () => null;
    assert.deepEqual(calls.advancedNavigate, ['mtrtest']);
  });

  it('"o" is a no-op when the highlighted card has no data-adv-slug (e.g. IP card)', () => {
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
