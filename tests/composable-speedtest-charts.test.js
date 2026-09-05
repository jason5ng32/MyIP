// Verify buffering, late chart loading, phase handoff, and stale async work.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markRaw } from 'vue';
import useSpeedTestCharts from '../frontend/composables/use-speedtest-charts.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const fixture = () => {
  const pending = [];
  const rendered = [];
  const frames = [];
  let time = 1000;
  class Chart {
    static register() {}
    static getChart() { return null; }
    constructor(_ctx, config) {
      Object.assign(this, config);
      rendered.push(this);
    }
    update() {}
    destroy() { this.destroyed = true; }
  }
  const module = { Chart, registerables: [] };
  const charts = useSpeedTestCharts(key => key, {
    loadChart: () => {
      const load = deferred();
      pending.push(load);
      return load.promise;
    },
    scheduleFrame: callback => frames.push(callback),
    now: () => time,
  });
  for (const type of ['download', 'upload', 'latency', 'jitter']) {
    charts[`${type}Chart`].value = markRaw({ getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }),
    }) });
  }
  return { charts, pending, rendered, module, frames, setTime: value => { time = value; } };
};

const raw = (count, finished = false) => ({
  download: { started: true, finished, results: { 100000: { timings: Array.from({ length: count }, () => ({})) } } },
});

test('buffer includes the finished preview and formal samples before Chart.js resolves', async () => {
  const { charts, pending, rendered, module, setTime } = fixture();
  const init = charts.initStartingPoints();
  const sharedInit = charts.initStartingPoints();
  assert.equal(pending.length, 1);
  const preview = raw(1, true);
  setTime(2000);
  charts.updateCharts(80, 0, 0, 0, preview);
  charts.updateCharts(80, 0, 0, 0, preview);
  const formal = raw(0);
  setTime(3000);
  charts.updateCharts(80, 0, 0, 0, formal);
  formal.download.results[100000].timings.push({});
  setTime(5000);
  charts.updateCharts(2, 0, 0, 0, formal);
  assert.deepEqual([...charts.chartData.download.data], [0, 80, 2]);
  pending[0].resolve(module);
  await Promise.all([init, sharedInit]);
  assert.equal(rendered.length, 4);
  assert.deepEqual(rendered[0].data.datasets[0].data, [0, 80, 2]);
  assert.deepEqual(rendered[0].data.labels, ['0.0', '1.0', '4.0']);
});

test('loading failure preserves samples and a later load can render them', async () => {
  const { charts, pending, rendered, module } = fixture();
  const init = charts.initStartingPoints();
  charts.updateCharts(3, 0, 0, 0, raw(1));
  pending[0].reject(new Error('chunk unavailable'));
  await init;
  assert.deepEqual([...charts.chartData.download.data], [0, 3]);
  const retry = charts.initStartingPoints();
  pending[1].resolve(module);
  await retry;
  assert.deepEqual(rendered[0].data.datasets[0].data, [0, 3]);
});

test('restart ignores the old import and its scheduled frames', async () => {
  const { charts, pending, rendered, module, frames } = fixture();
  const oldInit = charts.initStartingPoints();
  charts.updateCharts(99, 0, 0, 0, raw(1));
  charts.destroyCharts();
  charts.resetChartData();
  const newInit = charts.initStartingPoints();
  charts.updateCharts(5, 0, 0, 0, raw(1));
  pending[0].resolve(module);
  await oldInit;
  assert.equal(rendered.length, 0);
  const sharedInit = charts.initStartingPoints();
  assert.equal(pending.length, 2, 'old completion must not clear the current single-flight guard');
  pending[1].resolve(module);
  await Promise.all([newInit, sharedInit]);
  frames.forEach(callback => callback());
  assert.equal(rendered.length, 4);
  assert.deepEqual(rendered[0].data.datasets[0].data, [0, 5]);
});

test('unmount during import never creates charts', async () => {
  const { charts, pending, rendered, module } = fixture();
  const init = charts.initStartingPoints();
  charts.destroyCharts();
  pending[0].resolve(module);
  await init;
  assert.equal(rendered.length, 0);
});

test('two latency samples draw jitter and each formal series takes over independently', () => {
  const { charts } = fixture();
  const preview = { latency: { started: true, finished: true, results: { timings: [{}, {}] } } };
  charts.updateCharts(0, 0, 10, 2, preview);
  const formal = { latency: { started: true, results: { timings: [{}] } } };
  charts.updateCharts(0, 0, 30, 2, formal);
  assert.deepEqual([...charts.chartData.latency.data], [10, 30]);
  assert.deepEqual([...charts.chartData.jitter.data], [2]);
  formal.latency.results.timings.push({});
  charts.updateCharts(0, 0, 30, 0, formal);
  assert.deepEqual([...charts.chartData.jitter.data], [2, 0]);
});
