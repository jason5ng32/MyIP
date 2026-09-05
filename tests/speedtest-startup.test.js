// Exercise the component's startup orchestration with unresolved resource loads.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { reactive, ref, computed, markRaw, nextTick } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { createSpeedTestSession, getSpeedTestLiveValues } from '../frontend/utils/speedtest-session.js';

// Run setup logic without mounting a DOM or evaluating UI component imports.
const source = readFileSync(new URL('../frontend/components/SpeedTest.vue', import.meta.url), 'utf8');
const script = parse(source).descriptor.scriptSetup.content.replace(/^import[\s\S]*?;$/gm, '');
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

const fixture = () => {
  const chartLoad = deferred();
  const connectionLoads = [];
  const engines = [];
  const ips = [];
  let unmount;
  let chartLoads = 0;
  class Engine {
    constructor() { this.results = { raw: {} }; this.plays = 0; engines.push(this); }
    play() { this.plays++; }
    pause() { this.paused = true; }
  }
  const bindings = {
    reactive, ref, computed, markRaw, nextTick,
    createSpeedTestSession, getSpeedTestLiveValues,
    onMounted: () => {},
    onUnmounted: callback => { unmount = callback; },
    useMainStore: () => ({ lang: 'en', userPreferences: {}, updateAllIPs: value => ips.push(value) }),
    useI18n: () => ({ t: (key, params) => params ? `${key}: ${params.phase}` : key }),
    useAppCommand: () => {},
    trackEvent: () => {},
    SpeedTestEngine: Engine,
    useSpeedTestCharts: () => ({
      updateCharts: () => {}, destroyCharts: () => {}, resetChartData: () => {},
      initStartingPoints: () => { chartLoads++; return chartLoad.promise; },
    }),
  };
  const setup = new Function(...Object.keys(bindings), `${script}\nreturn { state, speedTestController, connectionMethods, progressLabel };`);
  const component = setup(...Object.values(bindings));
  component.connectionMethods.getIPFromSpeedTest = () => {
    const request = deferred();
    connectionLoads.push(request);
    return request.promise;
  };
  return { ...component, engines, ips, chartLoad, connectionLoads,
    unmount: () => unmount(), get chartLoads() { return chartLoads; } };
};

test('starting and pausing work while both resources remain unresolved', { timeout: 1000 }, async () => {
  const run = fixture();
  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'running');
  assert.equal(run.engines[0].plays, 1);
  assert.equal(run.chartLoads, 1);
  assert.equal(run.connectionLoads.length, 1);
  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'paused');
  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'running');
  assert.equal(run.engines.length, 1);
  assert.equal(run.engines[0].plays, 2);
  run.unmount();
});

test('resource failures do not change a running test to an error', async (t) => {
  t.mock.method(console, 'error', () => {});
  const run = fixture();
  await run.speedTestController();
  run.chartLoad.reject(new Error('chart unavailable'));
  run.connectionLoads[0].resolve(null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(run.state.speedTest.status, 'running');
  run.unmount();
});

test('progress appears immediately, never regresses across handoff or resume, and resets on retry', async () => {
  const run = fixture();
  assert.equal(run.state.speedTest.progress, 0);
  await run.speedTestController();
  assert.equal(run.state.speedTest.progress, 5);
  run.engines[0].onResultsChange();
  assert.equal(run.state.speedTest.progress, 5);
  run.engines[0].onFinish(run.engines[0].results);
  run.engines[1].onResultsChange();
  assert.equal(run.state.speedTest.progress, 5, 'empty formal results preserve startup progress');
  run.engines[1].results.raw.latency = { started: true, finished: true };
  run.engines[1].results.raw.download = { started: true, finished: false };
  run.engines[1].onResultsChange();
  const progress = run.state.speedTest.progress;
  assert(progress > 5);
  await run.speedTestController();
  await run.speedTestController();
  assert.equal(run.state.speedTest.progress, progress);
  run.state.speedTest.status = 'finished';
  run.state.speedTest.progress = 100;
  await run.speedTestController();
  assert.equal(run.state.speedTest.progress, 5, 'a fresh test starts with fresh progress');
  run.unmount();
});

test('progress text follows phases and preserves the paused phase', async () => {
  const run = fixture();
  await run.speedTestController();
  assert.equal(run.progressLabel.value, 'speedtest.phases.probe');
  run.engines[0].onPhaseChange({ measurement: { type: 'download' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.probe');
  run.engines[0].onFinish(run.engines[0].results);
  run.engines[1].onPhaseChange({ measurement: { type: 'latency' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.latency');
  await run.speedTestController();
  assert.equal(run.progressLabel.value, 'speedtest.phasePaused: speedtest.phases.latency');
  await run.speedTestController();
  run.engines[1].onPhaseChange({ measurement: { type: 'upload' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.upload');
  run.state.speedTest.status = 'finished';
  assert.equal(run.progressLabel.value, 'speedtest.phaseFinished');
  run.state.speedTest.status = 'error';
  assert.equal(run.progressLabel.value, 'speedtest.phaseFailed');
  run.unmount();
});

test('connection information can arrive later, but stale runs and unmount cannot publish it', async () => {
  const run = fixture();
  await run.speedTestController();
  run.state.speedTest.status = 'error';
  await run.speedTestController();
  run.connectionLoads[0].resolve({ ip: '192.0.2.1', loc: 'US', country: 'United States' });
  await nextTick();
  assert.equal(run.state.connection.ip, '');
  run.connectionLoads[1].resolve({ ip: '192.0.2.2', loc: 'SG', country: 'Singapore' });
  await nextTick();
  assert.equal(run.state.connection.ip, '192.0.2.2');
  assert.equal(run.ips.length, 1);
  run.unmount();

  const abandoned = fixture();
  await abandoned.speedTestController();
  abandoned.unmount();
  abandoned.connectionLoads[0].resolve({ ip: '192.0.2.3' });
  await nextTick();
  assert.equal(abandoned.state.connection.ip, '');
  assert.equal(abandoned.ips.length, 0);
});
