// Verify fixed preview sequencing, formal readings, and session cancellation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import CloudflareEngine from '@cloudflare/speedtest';
import { createSpeedTestSession, getSpeedTestLiveValues } from '../frontend/utils/speedtest-session.js';

const packages = () => ({
  latency: { count: 30 }, download: { bytes: 50e6, count: 4 }, upload: { bytes: 15e6, count: 4 },
});

const fixture = () => {
  const engines = [];
  class Engine {
    constructor(config) {
      this.config = config;
      this.results = { raw: {} };
      this.plays = 0;
      engines.push(this);
    }
    play() { this.plays++; }
    pause() {}
    finish() { this.onFinish(this.results); }
  }
  const config = packages();
  return { config, engines, session: createSpeedTestSession(Engine, config) };
};

test('preview is fixed and formal settings are captured before the preview starts', () => {
  const { session, engines, config } = fixture();
  assert.deepEqual(engines[0].config.measurements, [
    { type: 'latency', numPackets: 2 },
    { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  ]);
  assert.equal(engines[0].config.bandwidthMinRequestDuration, 0);
  assert.equal(engines[0].config.logAimApiUrl, null);
  config.download.bytes = 1e6;
  session.play();
  const delivered = [];
  session.onResultsChange = () => delivered.push(session.results);
  engines[0].finish();
  assert.equal(delivered.at(-1), engines[0].results, 'flush the preview before switching');
  assert.equal(session.isProbe, false);
  assert.equal(engines[1].plays, 1);
  assert.deepEqual(engines[1].config.measurements, [
    { type: 'latency', numPackets: 30 },
    { type: 'download', bytes: 50e6, count: 4 },
    { type: 'upload', bytes: 15e6, count: 4 },
  ]);
  assert.equal(session.results, engines[1].results);
});

test('a paused preview cannot auto-start the formal run; resume never repeats the preview', () => {
  const { session, engines } = fixture();
  session.play();
  session.pause();
  engines[0].finish();
  assert.equal(engines[1].plays, 0);
  session.play();
  session.play();
  assert.equal(engines.length, 2);
  assert.equal(engines[1].plays, 1);
});

test('destroy and phase replacement ignore saved callbacks from the old engine', () => {
  const { session, engines } = fixture();
  let updates = 0;
  session.onResultsChange = () => updates++;
  const oldUpdate = engines[0].onResultsChange;
  session.play();
  engines[0].finish();
  oldUpdate();
  assert.equal(updates, 1);
  const lateFinish = engines[1].onFinish;
  session.destroy();
  lateFinish(engines[1].results);
  session.play();
  assert.equal(updates, 1);
  assert.equal(engines[1].plays, 1);
});

test('a preview failure does not launch a formal test or report success', () => {
  const { session, engines } = fixture();
  let error;
  session.onError = (value) => { error = value; };
  session.play();
  engines[0].onError('connection failed');
  engines[0].finish();
  assert.equal(error, 'connection failed');
  assert.equal(engines.length, 1);
});

test('phase notifications group preview work and ignore phases from an old engine', () => {
  const { session, engines } = fixture();
  const phases = [];
  session.onPhaseChange = phase => phases.push(phase);
  const oldPhase = engines[0].onPhaseChange;
  engines[0].onPhaseChange({ measurement: { type: 'latency' } });
  engines[0].onPhaseChange({ measurement: { type: 'download' } });
  session.play();
  engines[0].finish();
  engines[1].onPhaseChange({ measurement: { type: 'latency' } });
  oldPhase({ measurement: { type: 'download' } });
  engines[1].onPhaseChange({ measurement: { type: 'download' } });
  engines[1].onPhaseChange({ measurement: { type: 'upload' } });
  assert.deepEqual(phases, ['probe', 'probe', 'latency', 'download', 'upload']);
  const latePhase = engines[1].onPhaseChange;
  session.destroy();
  latePhase({ measurement: { type: 'latency' } });
  assert.equal(phases.length, 5);
});

test('formal metrics replace preview readings only when their own samples arrive', () => {
  const values = { downloadSpeed: 90, latency: 12, jitter: 3, uploadSpeed: 0 };
  const results = {
    raw: { latency: { results: { timings: [] } }, download: { results: {} } },
    getDownloadBandwidth: () => 2e6,
    getUnloadedLatency: () => 30,
    getUnloadedJitter: () => 0,
  };
  Object.assign(values, getSpeedTestLiveValues(results));
  assert.equal(values.downloadSpeed, 90);
  assert.equal(values.latency, 12);
  results.raw.latency.results.timings.push({});
  Object.assign(values, getSpeedTestLiveValues(results));
  assert.equal(values.latency, 30);
  assert.equal(values.jitter, 3);
  assert.equal(values.downloadSpeed, 90);
  results.raw.latency.results.timings.push({});
  results.raw.download.results[50e6] = { timings: [{}] };
  Object.assign(values, getSpeedTestLiveValues(results));
  assert.equal(values.jitter, 0);
  assert.equal(values.downloadSpeed, 2, 'the faster preview does not bias the formal reading');
});

test('installed CF engine delivers a fast preview and all selected formal requests', async (t) => {
  const requests = [];
  const timings = new Map();
  const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://example.test' } } });
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: {
    now: () => 0, clearResourceTimings: () => timings.clear(), setResourceTimingBufferSize: () => {},
    getEntriesByName: (url) => [timings.get(url)],
  } });
  t.after(() => {
    Object.defineProperty(globalThis, 'performance', originalPerformance);
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  t.mock.method(console, 'log', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const bytes = Number(new URL(url).searchParams.get('bytes'));
    requests.push({ bytes, method: options.method || 'GET' });
    return { ok: true, headers: { get: () => null }, text: async () => {
      await new Promise(resolve => setTimeout(resolve, 2));
      timings.set(url, {
        transferSize: bytes + 300, requestStart: 0, responseStart: 1,
        responseEnd: bytes === 1e5 ? 2 : bytes ? 2001 : 1,
        connectStart: 0, connectEnd: 0, secureConnectionStart: 0, nextHopProtocol: 'h2',
      });
      return '';
    } };
  });
  class Engine extends CloudflareEngine {
    constructor(config) {
      // Exclude side probes and result logging from this deterministic network mock.
      super({ ...config, measureDownloadLoadedLatency: false, measureUploadLoadedLatency: false, logAimApiUrl: null });
    }
  }
  const session = createSpeedTestSession(Engine, packages());
  t.after(() => session.destroy());
  const phases = [];
  session.onPhaseChange = phase => phases.push(phase);
  let previewSpeed;
  session.onResultsChange = () => {
    if (session.isProbe) previewSpeed = getSpeedTestLiveValues(session.results).downloadSpeed ?? previewSpeed;
  };
  const result = await new Promise((resolve, reject) => {
    session.onFinish = resolve;
    session.onError = reject;
    session.play();
  });
  assert(previewSpeed > 0, 'a sub-10ms preview still provides a reading');
  assert.deepEqual(phases, ['probe', 'probe', 'latency', 'download', 'upload']);
  assert.deepEqual(requests.slice(0, 3).map(item => item.bytes), [0, 0, 1e5]);
  assert.equal(requests.filter(item => item.bytes === 0).length, 32);
  assert.equal(requests.filter(item => item.bytes === 50e6).length, 4);
  assert.equal(requests.filter(item => item.bytes === 15e6).length, 4);
  assert.equal(result.getUnloadedLatencyPoints().length, 30);
  assert.equal(result.getDownloadBandwidthPoints().length, 4);
  assert(result.getDownloadBandwidth() / 1e6 < previewSpeed, 'the final result excludes the preview');
});
