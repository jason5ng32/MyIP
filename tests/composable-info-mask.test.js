import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { reactive, nextTick } from 'vue';

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

  it('toggle flips 0 ↔ 1 and fires a neutral info toast in both directions', () => {
    composable.toggleInfoMask();
    assert.equal(composable.infoMaskLevel.value, 1);
    assert.equal(store.state.lastAlert.style, 'text-info');
    assert.equal(store.state.lastAlert.title, '<alert.maskedInfoTitle>');

    composable.toggleInfoMask();
    assert.equal(composable.infoMaskLevel.value, 0);
    assert.equal(store.state.lastAlert.style, 'text-info');
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
