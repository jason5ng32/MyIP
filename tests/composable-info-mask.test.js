import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { ref, reactive, nextTick } from 'vue';

import { useInfoMask } from '../frontend/composables/use-info-mask.js';

// minimal i18n stub: return key with prefix for assertions
const t = (key) => `<${key}>`;

// create a minimal store stub, only requiring the API used by useInfoMask:
//   - setAlert(show, style, message, title) —— will be recorded in lastAlert
//   - allHasLoaded —— reactive, getter triggers watch
function makeStoreStub() {
  const state = reactive({ allHasLoaded: false, lastAlert: null });
  return {
    state,
    get allHasLoaded() { return state.allHasLoaded; },
    setAlert(show, style, message, title) {
      state.lastAlert = { show, style, message, title };
    },
  };
}

// create three component refs for masking: ipDataCards / stunServers / leakTest are arrays
function makeCards() {
  const IPCheckRef = ref({
    ipDataCards: [
      { id: 'cloudflare_v4', ip: '1.1.1.1', country_name: 'AU', city: 'Sydney' },
      { id: 'cloudflare_v6', ip: '2606:4700::1', country_name: 'AU', city: 'Sydney' },
      { id: 'ipify_v6',     ip: '2607:f8b0::1', country_name: 'US', city: 'Mountain View' },
    ],
  });
  const webRTCRef = ref({
    stunServers: [
      { name: 'stun1', ip: '203.0.113.10' },
      { name: 'stun2', ip: '2001:db8::10' },
    ],
  });
  const dnsLeaksRef = ref({
    leakTest: [
      { server: 'A', ip: '198.51.100.1', geo: 'Test Region' },
      { server: 'B', ip: '198.51.100.2', geo: 'Test Region' },
    ],
  });
  return { IPCheckRef, webRTCRef, dnsLeaksRef };
}

describe('useInfoMask()', () => {
  let store;
  let refs;
  let composable;

  beforeEach(() => {
    store = makeStoreStub();
    refs = makeCards();
    composable = useInfoMask({ refs, store, t });
  });

  it('initial state: level=0, mask button hidden, infos not loaded', () => {
    assert.equal(composable.infoMaskLevel.value, 0);
    assert.equal(composable.showMaskButton.value, false);
    assert.equal(composable.isInfosLoaded.value, false);
  });

  it('sets showMaskButton + isInfosLoaded when store.allHasLoaded flips true', async () => {
    store.state.allHasLoaded = true;
    await nextTick();
    assert.equal(composable.showMaskButton.value, true);
    assert.equal(composable.isInfosLoaded.value, true);
  });

  it('level 0→1: IPv4/IPv6 cards use family-specific dummy IPs, store alert warning', () => {
    composable.toggleInfoMask();
    assert.equal(composable.infoMaskLevel.value, 1);
    assert.equal(refs.IPCheckRef.value.ipDataCards[0].ip, '8.8.8.8', 'v4 card uses v4 dummy');
    assert.equal(refs.IPCheckRef.value.ipDataCards[1].ip, '2001:4860:4860::8888', 'cloudflare_v6 uses v6 dummy');
    assert.equal(refs.IPCheckRef.value.ipDataCards[2].ip, '2001:4860:4860::8888', 'ipify_v6 uses v6 dummy');
    assert.equal(refs.webRTCRef.value.stunServers[0].ip, '100.100.200.100');
    assert.equal(refs.dnsLeaksRef.value.leakTest[0].ip, '12.34.56.78');
    assert.equal(store.state.lastAlert.style, 'text-warning');
  });

  it('level 1→2: full card identity replaced + dns geo masked, alert turns success', () => {
    composable.toggleInfoMask(); // 0 → 1
    composable.toggleInfoMask(); // 1 → 2
    assert.equal(composable.infoMaskLevel.value, 2);
    assert.equal(refs.IPCheckRef.value.ipDataCards[0].country_name, 'United States',
      'card country overwritten to maskedInfo country');
    assert.equal(refs.IPCheckRef.value.ipDataCards[0].city, 'Mountain View');
    assert.equal(refs.dnsLeaksRef.value.leakTest[0].geo, 'United States');
    assert.equal(store.state.lastAlert.style, 'text-success');
  });

  it('level 2→0: restores original values snapshot-ed at 0→1 transition', () => {
    const originalV4Ip = refs.IPCheckRef.value.ipDataCards[0].ip;
    const originalCity = refs.IPCheckRef.value.ipDataCards[0].city;
    const originalStunIp = refs.webRTCRef.value.stunServers[0].ip;
    const originalDnsGeo = refs.dnsLeaksRef.value.leakTest[0].geo;

    composable.toggleInfoMask(); // 0 → 1
    composable.toggleInfoMask(); // 1 → 2
    composable.toggleInfoMask(); // 2 → 0

    assert.equal(composable.infoMaskLevel.value, 0);
    assert.equal(refs.IPCheckRef.value.ipDataCards[0].ip, originalV4Ip);
    assert.equal(refs.IPCheckRef.value.ipDataCards[0].city, originalCity);
    assert.equal(refs.webRTCRef.value.stunServers[0].ip, originalStunIp);
    assert.equal(refs.dnsLeaksRef.value.leakTest[0].geo, originalDnsGeo);
    assert.equal(store.state.lastAlert.style, 'text-danger');
  });
});
