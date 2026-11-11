// Exercise SpeedTest startup orchestration, boot-draw ceremony, and post-run diagnostics.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectScope, nextTick } from 'vue';
import { useSpeedTest } from '../frontend/composables/use-speedtest.js';
import {
  formatLoadedDelta, loadedLatencyDelta, qualityLevel,
} from '../frontend/utils/features/speedtest-session.js';

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
  let chartLoads = 0;

  class Engine {
    constructor() { this.results = { raw: {} }; this.plays = 0; engines.push(this); }
    play() { this.plays++; }
    pause() { this.paused = true; }
  }

  const scope = effectScope();
  const runner = scope.run(() => useSpeedTest({
    t: (key, params) => (params ? `${key}: ${params.phase}` : key),
    lang: 'en',
    updateAllIPs: (value) => ips.push(value),
    initStartingPoints: () => { chartLoads += 1; return chartLoad.promise; },
    updateCharts: () => {},
    resetChartData: () => {},
    destroyCharts: () => {},
  }));

  runner.engineMethods.loadEngine = () => Promise.resolve(Engine);
  runner.connectionMethods.getIPFromSpeedTest = () => {
    const request = deferred();
    connectionLoads.push(request);
    return request.promise;
  };

  return {
    ...runner,
    Engine,
    engines,
    ips,
    chartLoad,
    connectionLoads,
    unmount: () => scope.stop(),
    get chartLoads() { return chartLoads; },
  };
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
  await new Promise((resolve) => setImmediate(resolve));
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
  const { progress } = run.state.speedTest;
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
  assert.equal(run.progressLabel.value, 'speedtest.phaseStandby');
  assert.equal(run.statusDotClass.value, 'bg-muted-foreground/35');
  assert.equal(run.progressIndicatorClass.value, 'bg-border');
  assert.equal(run.metricDotClass('downloadSpeed'), 'bg-border');
  assert.equal(run.linkFlow.value, 'idle');
  assert.equal(run.estimatedTotalMB.value, 260);
  run.state.config.package.download.bytes = 100e6;
  assert.equal(run.estimatedTotalMB.value, 460);

  await run.speedTestController();
  assert.equal(run.progressLabel.value, 'speedtest.phases.probe');
  assert.equal(run.statusDotClass.value, 'bg-info');
  assert.equal(run.progressIndicatorClass.value, 'bg-info');
  assert.equal(run.metricDotClass('downloadSpeed'), 'bg-info');
  assert.equal(run.metricToneVar('downloadSpeed'), 'var(--info)');
  assert.equal(run.metricDotClass('uploadSpeed'), 'bg-border');
  assert.equal(run.metricToneVar('uploadSpeed'), undefined);
  assert.equal(run.linkFlow.value, 'ping');
  run.engines[0].onPhaseChange({ measurement: { type: 'download' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.probe');
  run.engines[0].onFinish(run.engines[0].results);
  run.engines[1].onPhaseChange({ measurement: { type: 'latency' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.latency');
  assert.equal(run.linkFlow.value, 'ping');
  run.engines[1].onPhaseChange({ measurement: { type: 'download' } });
  assert.equal(run.linkFlow.value, 'download');
  await run.speedTestController();
  assert.equal(run.progressLabel.value, 'speedtest.phasePaused: speedtest.phases.download');
  assert.equal(run.statusDotClass.value, 'bg-warning');
  assert.equal(run.progressIndicatorClass.value, 'bg-warning');
  assert.equal(run.metricColorClass.value, 'text-warning');
  assert.equal(run.metricDotClass('uploadSpeed'), 'bg-warning');
  assert.equal(run.metricToneVar('uploadSpeed'), 'var(--warning)');
  assert.equal(run.linkFlow.value, 'paused');
  await run.speedTestController();
  run.engines[1].onPhaseChange({ measurement: { type: 'upload' } });
  assert.equal(run.progressLabel.value, 'speedtest.phases.upload');
  assert.equal(run.statusDotClass.value, 'bg-info');
  assert.equal(run.progressIndicatorClass.value, 'bg-info');
  assert.equal(run.metricColorClass.value, 'text-info');
  assert.equal(run.linkFlow.value, 'upload');
  run.state.speedTest.status = 'finished';
  assert.equal(run.progressLabel.value, 'speedtest.phaseFinished');
  assert.equal(run.statusDotClass.value, 'bg-success');
  assert.equal(run.progressIndicatorClass.value, 'bg-success');
  assert.equal(run.metricColorClass.value, 'text-success');
  assert.equal(run.metricDotClass('downloadSpeed'), 'bg-success');
  assert.equal(run.metricToneVar('downloadSpeed'), 'var(--success)');
  assert.equal(run.linkFlow.value, 'done');
  run.state.speedTest.status = 'error';
  assert.equal(run.progressLabel.value, 'speedtest.phaseFailed');
  assert.equal(run.statusDotClass.value, 'bg-destructive');
  assert.equal(run.progressIndicatorClass.value, 'bg-destructive');
  assert.equal(run.metricColorClass.value, 'text-destructive');
  assert.equal(run.linkFlow.value, 'error');
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

test('lazy engine chunk supports mid-load pause/resume and surfaces load failure', async (t) => {
  t.mock.method(console, 'error', () => {});
  const run = fixture();
  const engineChunk = deferred();
  run.engineMethods.loadEngine = () => engineChunk.promise;

  const pendingStart = run.speedTestController();
  assert.equal(run.state.speedTest.status, 'running');
  assert.equal(run.state.speedTest.progress, 5);
  assert.equal(run.engines.length, 0);

  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'paused');
  engineChunk.resolve(run.Engine);
  await pendingStart;
  assert.equal(run.engines.length, 0);

  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'running');
  assert.equal(run.engines.length, 1);
  assert.equal(run.engines[0].plays, 1);
  run.unmount();

  const broken = fixture();
  broken.engineMethods.loadEngine = () => Promise.reject(new Error('chunk failed'));
  await broken.speedTestController();
  assert.equal(broken.state.speedTest.status, 'error');
  broken.unmount();
});

test('isMetricActive highlights only the channels matching the live measurement phase', async () => {
  const run = fixture();
  assert.equal(run.isMetricActive('downloadSpeed'), false);
  await run.speedTestController();

  assert.equal(run.isMetricActive('latency'), true);
  assert.equal(run.isMetricActive('downloadSpeed'), true);
  assert.equal(run.isMetricActive('uploadSpeed'), false);

  run.engines[0].onFinish(run.engines[0].results);
  run.engines[1].onPhaseChange({ measurement: { type: 'latency' } });
  assert.equal(run.isMetricActive('latency'), true);
  assert.equal(run.isMetricActive('jitter'), true);
  assert.equal(run.isMetricActive('downloadSpeed'), false);

  run.engines[1].onPhaseChange({ measurement: { type: 'download' } });
  assert.equal(run.isMetricActive('downloadSpeed'), true);
  assert.equal(run.isMetricActive('latency'), false);

  run.engines[1].onPhaseChange({ measurement: { type: 'upload' } });
  assert.equal(run.isMetricActive('uploadSpeed'), true);
  assert.equal(run.isMetricActive('downloadSpeed'), false);

  await run.speedTestController();
  assert.equal(run.isMetricActive('uploadSpeed'), false);
  run.unmount();
});

test('boot draw ceremony sweeps before revealing numbers, animations, charts, or engine play', async () => {
  const run = fixture();
  let bootDraw = deferred();
  run.engineMethods.waitForBootDraw = () => bootDraw.promise;

  // 1. Mid-draw cancel settles cleanly back to idle without marking drawn.
  const cancelledStart = run.speedTestController();
  assert.equal(run.state.speedTest.status, 'running');
  assert.equal(run.state.speedTest.isDrawing, true);
  assert.equal(run.state.speedTest.hasDrawn, false);
  assert.equal(run.state.speedTest.downloadSpeed, '-');
  assert.equal(run.state.speedTest.progress, 0);
  assert.equal(run.isMetricActive('latency'), false);
  assert.equal(run.engines.length, 0);

  await run.speedTestController();
  assert.equal(run.state.speedTest.status, 'idle');
  assert.equal(run.state.speedTest.isDrawing, false);
  assert.equal(run.state.speedTest.hasDrawn, false);
  bootDraw.resolve();
  await cancelledStart;
  assert.equal(run.engines.length, 0);

  // 2. Full ceremony holds numbers & active telemetry until the L->R draw finishes.
  bootDraw = deferred();
  const fullStart = run.speedTestController();
  assert.equal(run.state.speedTest.isDrawing, true);
  assert.equal(run.state.speedTest.downloadSpeed, '-');
  assert.equal(run.state.speedTest.latency, '-');
  assert.equal(run.state.speedTest.progress, 0);
  assert.equal(run.isMetricActive('downloadSpeed'), false);
  assert.equal(run.chartLoads, 0);
  assert.equal(run.engines.length, 0);

  bootDraw.resolve();
  await fullStart;
  await nextTick();
  assert.equal(run.state.speedTest.isDrawing, false);
  assert.equal(run.state.speedTest.hasDrawn, true);
  assert.equal(run.state.speedTest.downloadSpeed, 0);
  assert.equal(run.state.speedTest.latency, 0);
  assert.equal(run.state.speedTest.progress, 5);
  assert.equal(run.isMetricActive('latency'), true);
  assert.equal(run.isMetricActive('downloadSpeed'), true);
  assert.equal(run.chartLoads, 1);
  assert.equal(run.engines.length, 1);
  assert.equal(run.engines[0].plays, 1);
  run.unmount();
});

test('post-run helpers map 5-tier quality levels, bufferbloat deltas, and 4th cloudSync score on finish', async () => {
  const run = fixture();
  assert.deepEqual(
    ['bad', 'poor', 'average', 'good', 'great', '-'].map(qualityLevel),
    [1, 2, 3, 4, 5, 0],
  );

  assert.equal(loadedLatencyDelta('-', 42), null);
  assert.equal(loadedLatencyDelta(20, '-'), null);
  assert.equal(loadedLatencyDelta(20, 32.44), 12.4);
  assert.equal(formatLoadedDelta(12.4), '+12.4');
  assert.equal(formatLoadedDelta(0), '0');

  await run.speedTestController();
  run.engines[0].results.raw = { download: { results: { 1e5: { timings: [{ transferSize: 100_200 }] } } } };
  run.engines[0].onFinish(run.engines[0].results);

  const formal = run.engines[1];
  formal.results = {
    raw: {
      download: { results: { 50e6: { timings: [{ transferSize: 50_000_500 }] } } },
      upload: { results: { 15e6: { timings: [{ transferSize: 250 }] } } },
    },
    getSummary: () => ({
      download: 300e6,
      upload: 20e6,
      latency: 15,
      jitter: 2.1,
      downLoadedLatency: 38.4,
      upLoadedLatency: 52.8,
      downLoadedJitter: 3.45,
      upLoadedJitter: 6.12,
      totalDurationMs: 11_200,
    }),
    getScores: () => ({
      streaming: { points: 55, classificationName: 'good' },
      gaming: { points: 25, classificationName: 'good' },
      rtc: { points: 30, classificationName: 'good' },
    }),
  };
  formal.onFinish(formal.results);

  assert.equal(run.state.speedTest.status, 'finished');
  assert.equal(run.state.speedTest.hasScores, true);
  assert.equal(run.state.connection.colo, '');
  assert.equal(run.state.speedTest.streamingQuality, 'good');
  assert.equal(run.state.speedTest.cloudSyncQuality, 'average');
  assert.equal(run.state.speedTest.downLoadedJitter, 3.45);
  assert.equal(run.state.speedTest.upLoadedJitter, 6.12);
  assert.equal(run.state.speedTest.transferredBytes, 100_200 + 50_000_500 + 15_000_250);
  assert(Number.isFinite(run.state.speedTest.activeDurationMs));
  run.unmount();
});

test('getIPFromSpeedTest warns on blocked trace requests without triggering console.error', async (t) => {
  const warns = [];
  const errors = [];
  t.mock.method(console, 'warn', (...args) => warns.push(args));
  t.mock.method(console, 'error', (...args) => errors.push(args));

  const scope = effectScope();
  const runner = scope.run(() => useSpeedTest({
    t: (k) => k,
    lang: 'en',
  }));

  // 1. Privacy extension blocking /cdn-cgi/trace (TypeError: Failed to fetch) -> console.warn, null.
  t.mock.method(globalThis, 'fetch', () => Promise.reject(new TypeError('Failed to fetch')));
  assert.equal(await runner.connectionMethods.getIPFromSpeedTest(), null);
  assert.equal(warns.length, 1);
  assert.equal(errors.length, 0);

  // 2. Non-2xx block page -> console.warn, null.
  t.mock.method(globalThis, 'fetch', () => Promise.resolve({ ok: false, status: 403 }));
  assert.equal(await runner.connectionMethods.getIPFromSpeedTest(), null);
  assert.equal(warns.length, 2);
  assert.equal(errors.length, 0);

  // 3. 200 OK with malformed trace body -> console.error preserved for format diagnostics.
  t.mock.method(globalThis, 'fetch', () => Promise.resolve({ ok: true, text: () => Promise.resolve('colo=SJC\n') }));
  assert.equal(await runner.connectionMethods.getIPFromSpeedTest(), null);
  assert.equal(errors.length, 1);

  scope.stop();
});
