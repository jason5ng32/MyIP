import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { reactive, nextTick } from 'vue';

import { useInfoMask, createMaskGate } from '../frontend/composables/use-info-mask.js';

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

describe('useInfoMask()', () => {
  let store;
  let composable;

  beforeEach(() => {
    store = makeStoreStub();
    composable = useInfoMask({ store, t });
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

  it('toggle flips 0 ↔ 1; masking toasts success, unmasking toasts warning', () => {
    composable.toggleInfoMask();
    assert.equal(composable.infoMaskLevel.value, 1);
    assert.equal(store.state.lastAlert.style, 'text-success');
    assert.equal(store.state.lastAlert.title, '<alert.maskedInfoTitle>');

    composable.toggleInfoMask();
    assert.equal(composable.infoMaskLevel.value, 0);
    assert.equal(store.state.lastAlert.style, 'text-warning');
    assert.equal(store.state.lastAlert.title, '<alert.unmaskedInfoTitle>');
  });

  it('does not require component refs (CSS-driven masking, no data mutation)', () => {
    // Toggling must not throw even though the composable was constructed
    // without any refs — the previous implementation required IPCheckRef /
    // webRTCRef / dnsLeaksRef.
    assert.doesNotThrow(() => {
      composable.toggleInfoMask();
      composable.toggleInfoMask();
    });
  });
});

describe('createMaskGate()', () => {
  const maskAttr = createMaskGate(t);

  it("masks a real IP value with the 'ip' attribute", () => {
    assert.equal(maskAttr('1.2.3.4'), 'ip');
    assert.equal(maskAttr('2001:db8::1'), 'ip');
  });

  it('leaves waiting / error placeholders unmasked (undefined attr)', () => {
    for (const key of [
      'webrtc.StatusWait', 'webrtc.StatusTesting', 'webrtc.StatusError',
      'dnsleaktest.StatusWait', 'dnsleaktest.StatusTesting', 'dnsleaktest.StatusError',
      'ipInfos.IPv4Error', 'ipInfos.IPv6Error',
    ]) {
      assert.equal(maskAttr(t(key)), undefined, `${key} should not be masked`);
    }
  });
});
