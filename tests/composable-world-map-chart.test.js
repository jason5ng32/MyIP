// Verify lazy map rendering stays bounded across updates, folds and unmounts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectScope, ref, shallowRef, nextTick } from 'vue';
import { useWorldMapChart } from '../frontend/composables/use-world-map-chart.js';

const flush = async () => {
    await nextTick();
    await new Promise((resolve) => setImmediate(resolve));
};
const fixture = () => {
    const scope = effectScope();
    const canvas = shallowRef(null);
    const visible = ref(true);
    const options = ref({ values: { US: 1 } });
    const theme = ref(false);
    const pending = [];
    const state = scope.run(() => useWorldMapChart({ canvas, visible, options, theme }, {
        render: (args) => new Promise((resolve, reject) => pending.push({ args, resolve, reject })),
    }));
    return { scope, canvas, visible, options, theme, pending, ...state };
};
const chart = () => ({ destroyed: false, destroy() { this.destroyed = true; } });

test('waits for a canvas, then serializes changes and renders only the latest state', async () => {
    const f = fixture();
    await flush();
    assert.equal(f.pending.length, 0);
    f.canvas.value = {};
    await flush();
    assert.equal(f.pending.length, 1);
    f.options.value = { values: { DE: 1 } };
    await flush();
    f.options.value = { values: { SG: 1 } };
    await flush();
    assert.equal(f.pending.length, 1);
    assert.equal(f.pending[0].args.isActive(), false);
    const stale = chart();
    f.pending[0].resolve(stale);
    await flush();
    assert.equal(stale.destroyed, true);
    assert.equal(f.pending.length, 2);
    assert.deepEqual(f.pending[1].args.values, { SG: 1 });
    const current = chart();
    f.pending[1].resolve(current);
    await flush();
    assert.equal(f.ready.value, true);
    f.scope.stop();
    assert.equal(current.destroyed, true);
});

test('folding during load discards the render; a live chart survives fold until the canvas leaves', async () => {
    const f = fixture();
    f.canvas.value = {};
    await flush();
    f.visible.value = false;
    await flush();
    assert.equal(f.pending[0].args.isActive(), false);
    f.pending[0].resolve(null);
    await flush();
    assert.equal(f.ready.value, false);
    assert.equal(f.failed.value, false);
    f.visible.value = true;
    await flush();
    const current = chart();
    f.pending[1].resolve(current);
    await flush();
    assert.equal(f.ready.value, true);
    f.visible.value = false;
    await flush();
    assert.equal(current.destroyed, false);
    assert.equal(f.ready.value, true);
    f.canvas.value = null;
    await flush();
    assert.equal(current.destroyed, true);
    assert.equal(f.ready.value, false);
    f.scope.stop();
});

test('scope disposal invalidates an unfinished render and destroys any late result', async () => {
    const f = fixture();
    f.canvas.value = {};
    await flush();
    f.scope.stop();
    assert.equal(f.pending[0].args.isActive(), false);
    const late = chart();
    f.pending[0].resolve(late);
    await flush();
    assert.equal(late.destroyed, true);
    assert.equal(f.ready.value, false);
});

test('failure is recoverable and theme changes update the existing instance', async () => {
    const f = fixture();
    f.canvas.value = {};
    await flush();
    f.pending[0].reject(new Error('chunk unavailable'));
    await flush();
    assert.equal(f.failed.value, true);
    f.visible.value = false;
    await flush();
    f.visible.value = true;
    await flush();
    const current = chart();
    f.pending[1].resolve(current);
    await flush();
    assert.equal(f.failed.value, false);
    f.theme.value = true;
    await flush();
    assert.equal(f.pending[2].args.chart, current);
    f.pending[2].resolve(current);
    await flush();
    assert.equal(f.ready.value, true);
    f.scope.stop();
});
