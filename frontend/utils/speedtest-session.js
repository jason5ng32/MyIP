// Run a fixed preview before an independent, user-configured Cloudflare test.

export const getSpeedTestSampleCounts = (raw) => ({
  latency: raw.latency?.results?.timings?.length || 0,
  download: Object.values(raw.download?.results || {}).reduce((sum, bucket) => sum + bucket.timings.length, 0),
  upload: Object.values(raw.upload?.results || {}).reduce((sum, bucket) => sum + bucket.timings.length, 0),
});

// Missing formal samples leave the corresponding preview reading untouched.
export const getSpeedTestLiveValues = (results) => {
  const counts = getSpeedTestSampleCounts(results.raw);
  const metrics = [
    ['downloadSpeed', 'getDownloadBandwidth', counts.download, 1e6],
    ['uploadSpeed', 'getUploadBandwidth', counts.upload, 1e6],
    ['latency', 'getUnloadedLatency', counts.latency, 1],
    ['jitter', 'getUnloadedJitter', counts.latency >= 2, 1],
  ];
  return Object.fromEntries(metrics.flatMap(([key, getter, hasSamples, divisor]) => {
    if (!hasSamples) return [];
    const value = results[getter]();
    return Number.isFinite(value) ? [[key, Number((value / divisor).toFixed(2))]] : [];
  }));
};

export const createSpeedTestSession = (Engine, packages) => {
  // Snapshot options so the formal test uses the selection made at startup.
  const measurements = [
    { type: 'latency', numPackets: packages.latency.count },
    { type: 'download', bytes: packages.download.bytes, count: packages.download.count },
    { type: 'upload', bytes: packages.upload.bytes, count: packages.upload.count },
  ];
  let engine;
  let isProbe = true;
  let running = false;
  let disposed = false;
  let failed = false;

  const detach = () => {
    engine.onRunningChange = () => {};
    engine.onPhaseChange = () => {};
    engine.onResultsChange = () => {};
    engine.onFinish = () => {};
    engine.onError = () => {};
  };

  const session = {
    get results() { return engine.results; },
    get isProbe() { return isProbe; },
    onRunningChange: () => {},
    onPhaseChange: () => {},
    onResultsChange: () => {},
    onFinish: () => {},
    onError: () => {},
    play() {
      if (disposed || running) return;
      running = true;
      session.onRunningChange(true);
      engine.play();
    },
    pause() {
      if (disposed) return;
      running = false;
      engine.pause();
      session.onRunningChange(false);
    },
    destroy() {
      disposed = true;
      running = false;
      detach();
      engine.pause();
    },
  };

  const prepare = () => {
    const current = new Engine({
      autoStart: false,
      ...(isProbe ? {
        measurements: [
          { type: 'latency', numPackets: 2 },
          { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
        ],
        // Even a fast preview must produce a reading; only the formal run is logged.
        bandwidthMinRequestDuration: 0,
        measureDownloadLoadedLatency: false,
        measureUploadLoadedLatency: false,
        logAimApiUrl: null,
      } : { measurements }),
    });
    engine = current;
    const isCurrent = () => !disposed && engine === current;
    current.onPhaseChange = ({ measurement }) => {
      if (isCurrent()) session.onPhaseChange(isProbe ? 'probe' : measurement.type);
    };
    current.onResultsChange = () => {
      if (isCurrent()) session.onResultsChange();
    };
    current.onError = (error) => {
      if (!isCurrent()) return;
      failed = true;
      session.onError(error);
    };
    current.onFinish = (results) => {
      if (!isCurrent()) return;
      // Flush queued final samples before replacing the engine's result object.
      session.onResultsChange();
      if (isProbe && !failed) {
        detach();
        isProbe = false;
        prepare();
        if (running) engine.play();
      } else {
        running = false;
        session.onFinish(results);
      }
    };
  };

  prepare();
  return session;
};
