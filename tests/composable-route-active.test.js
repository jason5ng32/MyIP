// use-route-active.js — the KeepAlive-awareness helpers. Activation itself
// needs a mounted component tree (covered in the browser); here: the
// outside-a-component fallback and useActiveValue's hold-while-hidden rule
// with an injected `active` ref.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { effectScope, nextTick, ref, watch } from 'vue';
import { useActiveValue, useRouteActive } from '../frontend/composables/use-route-active.js';

describe('useRouteActive()', () => {
    it('is always active outside a component instance', () => {
        const scope = effectScope();
        const active = scope.run(() => useRouteActive());
        assert.equal(active.value, true);
        scope.stop();
    });
});

describe('useActiveValue()', () => {
    it('follows the getter while active', () => {
        const source = ref('a');
        const value = useActiveValue(() => source.value, { active: ref(true) });
        assert.equal(value.value, 'a');
        source.value = 'b';
        assert.equal(value.value, 'b');
    });

    it('holds the last active value while inactive', () => {
        const source = ref('a');
        const active = ref(true);
        const value = useActiveValue(() => source.value, { active });
        assert.equal(value.value, 'a');
        active.value = false;
        source.value = 'b';
        assert.equal(value.value, 'a');
        active.value = true;
        assert.equal(value.value, 'b', 'catches up on activation');
    });

    it('starts undefined when created inactive', () => {
        const value = useActiveValue(() => 'a', { active: ref(false) });
        assert.equal(value.value, undefined);
    });

    it('holds once the path leaves the one it was created on, even while still active', () => {
        const route = ref({ path: '/tools/asn', q: 'AS1' });
        const value = useActiveValue(() => route.value.q, { pathOf: () => route.value.path, active: ref(true) });
        assert.equal(value.value, 'AS1');
        route.value = { path: '/tools/ipcalculator', q: '10.0.0.0/22' };
        assert.equal(value.value, 'AS1', 'the next page\'s query never leaks in');
        route.value = { path: '/tools/asn', q: 'AS2' };
        assert.equal(value.value, 'AS2');
    });

    it('a watcher fires on activation only if the value changed while hidden', async () => {
        const source = ref('x');
        const active = ref(true);
        const seen = [];
        const scope = effectScope();
        scope.run(() => {
            watch(useActiveValue(() => source.value, { active }), (v) => seen.push(v), { immediate: true });
        });
        assert.deepEqual(seen, ['x']);

        active.value = false;
        source.value = 'y';
        await nextTick();
        source.value = 'x';
        active.value = true;
        await nextTick();
        assert.deepEqual(seen, ['x'], 'away and back to the same value: no re-run');

        active.value = false;
        source.value = 'z';
        await nextTick();
        assert.deepEqual(seen, ['x'], 'changes while hidden are not seen');
        active.value = true;
        await nextTick();
        assert.deepEqual(seen, ['x', 'z']);
        scope.stop();
    });
});
