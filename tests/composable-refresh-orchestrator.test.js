import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { ref, computed, reactive, nextTick } from 'vue';

import { useRefreshOrchestrator } from '../frontend/composables/use-refresh-orchestrator.js';
import { registerAppCommand } from '../frontend/utils/app-commands.js';

const t = (k) => `<${k}>`;

function makeStoreStub({ mountedFlags = {}, shouldRefresh = false, autoRun = {} } = {}) {
  const state = reactive({
    mountingStatus: { IPInfo: false, Connectivity: false, WebRTC: false, DNSLeakTest: false, ...mountedFlags },
    loadingStatus: { IPInfo: false, Connectivity: false, WebRTC: false, DNSLeakTest: false },
    shouldRefreshEveryThing: shouldRefresh,
    // Per-module auto-run switches (default all off unless overridden).
    userPreferences: {
      autoRunConnectivity: false,
      autoRunWebRTC: false,
      autoRunDnsLeak: false,
      ...autoRun,
    },
    alertHistory: [],
  });
  return {
    state,
    get mountingStatus() { return state.mountingStatus; },
    get shouldRefreshEveryThing() { return state.shouldRefreshEveryThing; },
    setLoadingStatus(key, val) { state.loadingStatus[key] = val; },
    setRefreshEveryThing(val) { state.shouldRefreshEveryThing = val; },
    setAlert(show, style, message, title) {
      state.alertHistory.push({ show, style, message, title });
    },
  };
}

// The orchestrator drives sections through the command bus; stub the four
// owner commands and record the payloads each dispatch carried.
function registerCommandStubs() {
  const calls = { ip: [], conn: [], web: [], dns: [] };
  const unregisters = [
    registerAppCommand('ipinfo:refresh', (payload) => { calls.ip.push(payload); }),
    registerAppCommand('connectivity:run', (payload) => { calls.conn.push(payload.trigger); }),
    registerAppCommand('webrtc:run', (payload) => { calls.web.push(payload.isRefresh); }),
    registerAppCommand('dnsleak:run', (payload) => { calls.dns.push(payload.isRefresh); }),
  ];
  return { calls, unregister: () => unregisters.forEach((off) => off()) };
}

describe('useRefreshOrchestrator()', () => {
  let realSetTimeout;
  let stubs;
  beforeEach(() => {
    // synchronize setTimeout immediately: ignore delay, for assertion order
    realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    stubs = registerCommandStubs();
  });
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
    stubs.unregister();
  });

  it('loadingControl: all cards mounted + every module on dispatches all four commands', () => {
    const store = makeStoreStub({
      mountedFlags: { IPInfo: true, Connectivity: true, WebRTC: true, DNSLeakTest: true },
      autoRun: { autoRunConnectivity: true, autoRunWebRTC: true, autoRunDnsLeak: true },
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { calls } = stubs;

    const { loadingControl } = useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });
    loadingControl();

    assert.equal(calls.ip.length, 1);
    assert.deepEqual(calls.conn, ['boot'], 'initial load runs the boot trigger');
    assert.deepEqual(calls.web, [undefined], 'initial load leaves isRefresh to the owner default');
    assert.deepEqual(calls.dns, [undefined]);
  });

  it('loadingControl: every module off skips auto checks and flags loading complete', () => {
    const store = makeStoreStub({
      mountedFlags: { IPInfo: true, Connectivity: true, WebRTC: true, DNSLeakTest: true },
      autoRun: { autoRunConnectivity: false, autoRunWebRTC: false, autoRunDnsLeak: false },
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { calls } = stubs;

    const { loadingControl } = useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });
    loadingControl();

    assert.equal(calls.ip.length, 1, 'IP info always runs');
    assert.deepEqual(calls.conn, [], 'connectivity should not auto-run');
    assert.deepEqual(calls.web, [], 'webrtc should not auto-run');
    assert.deepEqual(calls.dns, [], 'dns leak test should not auto-run');
    assert.equal(store.state.loadingStatus.Connectivity, true);
    assert.equal(store.state.loadingStatus.WebRTC, true);
    assert.equal(store.state.loadingStatus.DNSLeakTest, true);
  });

  it('loadingControl: per-module — only the enabled modules run, the rest flag loaded', () => {
    const store = makeStoreStub({
      mountedFlags: { IPInfo: true, Connectivity: true, WebRTC: true, DNSLeakTest: true },
      autoRun: { autoRunConnectivity: true, autoRunWebRTC: false, autoRunDnsLeak: false },
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { calls } = stubs;

    const { loadingControl } = useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });
    loadingControl();

    assert.equal(calls.ip.length, 1);
    assert.deepEqual(calls.conn, ['boot'], 'connectivity runs');
    assert.deepEqual(calls.web, [], 'webrtc stays off');
    assert.deepEqual(calls.dns, [], 'dns stays off');
    // Connectivity flags itself loaded when its check resolves (not here);
    // the two disabled modules are flagged loaded immediately.
    assert.equal(store.state.loadingStatus.WebRTC, true);
    assert.equal(store.state.loadingStatus.DNSLeakTest, true);
  });

  it('watch: shouldRefreshEveryThing=true triggers full refresh, resets flag + mask', async () => {
    // Manual "refresh everything" runs every module regardless of the per-module
    // auto-run switches, so the prefs here are irrelevant (left at defaults).
    const store = makeStoreStub();
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(2);
    const { calls } = stubs;

    useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });

    // flip the trigger
    store.state.shouldRefreshEveryThing = true;
    await nextTick();

    assert.equal(calls.ip.length, 1, 'ipcheck refreshes');
    assert.deepEqual(calls.conn, ['refresh'], 'connectivity refresh via the refresh trigger');
    assert.deepEqual(calls.web, [true]);
    assert.deepEqual(calls.dns, [true]);
    assert.equal(infoMaskLevel.value, 0, 'info mask reset on refresh');
    assert.equal(store.state.shouldRefreshEveryThing, false, 'trigger flag cleared');
    // refresh resets all loading flags to false
    assert.equal(store.state.loadingStatus.IPInfo, false);
    // A success alert was published
    const alert = store.state.alertHistory.at(-1);
    assert.equal(alert.style, 'text-success');
  });

  it('refresh with no command owners logs, never throws', async () => {
    stubs.unregister();
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => { warns.push(args[0]); };
    try {
      const store = makeStoreStub();
      const userPreferences = computed(() => store.state.userPreferences);
      const infoMaskLevel = ref(0);
      useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });
      store.state.shouldRefreshEveryThing = true;
      await nextTick();
      // Let the dispatch rejections reach their .catch handlers.
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(warns.length, 4, 'each unavailable command logs one warning');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('loadingControl: not all mounted → re-schedules itself until ready', () => {
    let attemptCount = 0;
    const scheduled = [];
    // custom setTimeout to record recursion count, first time does not execute, second time switches mountingStatus
    globalThis.setTimeout = (fn, delay) => {
      attemptCount += 1;
      scheduled.push(delay);
      if (attemptCount < 3) return 0; // first and second time skip
      fn();
      return 0;
    };

    const store = makeStoreStub({
      // initially no card mounted
      mountedFlags: { IPInfo: false, Connectivity: false, WebRTC: false, DNSLeakTest: false },
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);

    const { loadingControl } = useRefreshOrchestrator({ store, t, userPreferences, infoMaskLevel });

    // run first attempt (mounted = false) → schedule retry 1s later
    loadingControl();
    assert.ok(scheduled.includes(100), 'should see 100ms recursive retry delay');
  });
});
