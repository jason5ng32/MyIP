// useUrlOverrideCleanup() with a reactive fake store and an injected route /
// router: a dropped URL override takes its parameter out of the current URL.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextTick, reactive } from 'vue';
import { useUrlOverrideCleanup } from '../frontend/composables/use-url-overrides.js';

const setup = (overrides, query) => {
  const store = reactive({ preferenceOverrides: overrides });
  const route = { path: '/tools/asn', query, hash: '#top' };
  const replaced = [];
  useUrlOverrideCleanup({ store, route, router: { replace: (to) => replaced.push(to) } });
  return { store, replaced };
};

describe('useUrlOverrideCleanup()', () => {
  it('strips a dropped override\'s parameter, keeping the rest of the URL', async () => {
    const { store, replaced } = setup({ lang: 'fr', theme: 'dark' }, { q: 'AS13335', hl: 'fr', theme: 'dark' });
    store.preferenceOverrides = { theme: 'dark' };
    await nextTick();
    assert.deepEqual(replaced, [{ path: '/tools/asn', query: { q: 'AS13335', theme: 'dark' }, hash: '#top' }]);
  });

  it('leaves a URL that no longer carries the parameter alone', async () => {
    const { store, replaced } = setup({ ipGeoSource: 6 }, { q: 'AS13335' });
    store.preferenceOverrides = {};
    await nextTick();
    assert.deepEqual(replaced, []);
  });
});
