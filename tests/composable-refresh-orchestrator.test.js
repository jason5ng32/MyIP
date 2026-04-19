import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { ref, computed, reactive, nextTick } from 'vue';

import { useRefreshOrchestrator } from '../frontend/composables/use-refresh-orchestrator.js';

const t = (k) => `<${k}>`;

function makeStoreStub({ mountedFlags = {}, shouldRefresh = false, autoStart = false } = {}) {
  const state = reactive({
    mountingStatus: { ipcheck: false, connectivity: false, webrtc: false, dnsleaktest: false, ...mountedFlags },
    loadingStatus: { ipcheck: false, connectivity: false, webrtc: false, dnsleaktest: false },
    shouldRefreshEveryThing: shouldRefresh,
    userPreferences: { autoStart },
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

function makeRefs() {
  const calls = { ip: 0, conn: [], web: [], dns: [] };
  const IPCheckRef      = ref({ checkAllIPs:            () => { calls.ip += 1; } });
  const connectivityRef = ref({ handelCheckStart:       (flag) => { calls.conn.push(flag); } });
  const webRTCRef       = ref({ checkAllWebRTC:         (flag) => { calls.web.push(flag); } });
  const dnsLeaksRef     = ref({ checkAllDNSLeakTest:    (flag) => { calls.dns.push(flag); } });
  return { refs: { IPCheckRef, connectivityRef, webRTCRef, dnsLeaksRef }, calls };
}

describe('useRefreshOrchestrator()', () => {
  let realSetTimeout;
  beforeEach(() => {
    // synchronize setTimeout immediately: ignore delay, for assertion order
    realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn) => { fn(); return 0; };
  });
  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it('loadingControl: all cards mounted + autoStart=true triggers all four checks', () => {
    const store = makeStoreStub({
      mountedFlags: { ipcheck: true, connectivity: true, webrtc: true, dnsleaktest: true },
      autoStart: true,
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { refs, calls } = makeRefs();

    const { loadingControl } = useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel });
    loadingControl();

    assert.equal(calls.ip, 1);
    assert.deepEqual(calls.conn, [undefined]); // initial load passes no arg
    assert.deepEqual(calls.web, [false]);
    assert.deepEqual(calls.dns, [false]);
  });

  it('loadingControl: autoStart=false skips auto checks and flags loading complete', () => {
    const store = makeStoreStub({
      mountedFlags: { ipcheck: true, connectivity: true, webrtc: true, dnsleaktest: true },
      autoStart: false,
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { refs, calls } = makeRefs();

    useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel });

    // Need to instantiate + call loadingControl — return value carries the action
    const { loadingControl } = useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel });
    loadingControl();

    assert.equal(calls.ip, 1);
    assert.deepEqual(calls.conn, [], 'connectivity should not auto-run');
    assert.deepEqual(calls.web, [], 'webrtc should not auto-run');
    assert.deepEqual(calls.dns, [], 'dns leak test should not auto-run');
    assert.equal(store.state.loadingStatus.connectivity, true);
    assert.equal(store.state.loadingStatus.webrtc, true);
    assert.equal(store.state.loadingStatus.dnsleaktest, true);
  });

  it('watch: shouldRefreshEveryThing=true triggers full refresh, resets flag + mask', async () => {
    const store = makeStoreStub({ autoStart: true });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(2);
    const { refs, calls } = makeRefs();

    useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel });

    // flip the trigger
    store.state.shouldRefreshEveryThing = true;
    await nextTick();

    assert.equal(calls.ip, 1, 'ipcheck refreshes');
    assert.deepEqual(calls.conn, [true], 'connectivity refresh with forced flag');
    assert.deepEqual(calls.web, [true]);
    assert.deepEqual(calls.dns, [true]);
    assert.equal(infoMaskLevel.value, 0, 'info mask reset on refresh');
    assert.equal(store.state.shouldRefreshEveryThing, false, 'trigger flag cleared');
    // refresh resets all loading flags to false
    assert.equal(store.state.loadingStatus.ipcheck, false);
    // A success alert was published
    const alert = store.state.alertHistory.at(-1);
    assert.equal(alert.style, 'text-success');
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
      mountedFlags: { ipcheck: false, connectivity: false, webrtc: false, dnsleaktest: false },
      autoStart: false,
    });
    const userPreferences = computed(() => store.state.userPreferences);
    const infoMaskLevel = ref(0);
    const { refs } = makeRefs();

    const { loadingControl } = useRefreshOrchestrator({ refs, store, t, userPreferences, infoMaskLevel });

    // run first attempt (mounted = false) → schedule retry 1s later
    loadingControl();
    assert.ok(scheduled.includes(1000), 'should see 1000ms recursive retry delay');
  });
});
