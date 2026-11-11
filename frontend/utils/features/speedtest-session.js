// Orchestrate Cloudflare speed test preview + formal runs and derive receipt telemetry.

const scaleThreshold = (domain, range) => (value) => {
  let i = 0;
  while (i < domain.length && value >= domain[i]) i += 1;
  return range[i];
};

// Exact AIM scoring scales from @cloudflare/speedtest internalConfig.
const scorePacketLoss = scaleThreshold([0.01, 0.05, 0.25, 0.5], [10, 5, 0, -10, -20]);
const scoreLatency = scaleThreshold([10, 20, 50, 100, 500], [20, 10, 5, 0, -10, -20]);
const scoreLoadedLatencyIncrease = scaleThreshold([10, 20, 50, 100, 500], [20, 10, 5, 0, -10, -20]);
const scoreUpload = scaleThreshold([1e6, 1e7, 5e7, 1e8], [0, 5, 10, 20, 30]);
const classifyCloudSync = scaleThreshold([15, 20, 40, 60], [0, 1, 2, 3, 4]);
const CLASSIFICATION_NAMES = ['bad', 'poor', 'average', 'good', 'great'];

const defaultNow = () => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const collectDirectionBuckets = (entry) => {
  if (!entry || typeof entry !== 'object') return [];
  const serial = Object.entries(entry.results || {}).map(([bytes, bucket]) => ({
    bytes: Number(bytes) || 0,
    timings: bucket?.timings || [],
  }));
  const parallel = Object.values(entry.parallelResults || {}).flatMap((byBytes) => (
    Object.values(byBytes || {}).map((bucket) => ({
      bytes: Number(bucket?.bytes) || 0,
      timings: bucket?.timings || [],
    }))
  ));
  return [...serial, ...parallel];
};

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

// Sum actual bytes transferred across completed download and upload samples.
export const sumSpeedTestTransferredBytes = (raw = {}) => {
  let total = 0;
  for (const { bytes, timings } of collectDirectionBuckets(raw?.download)) {
    for (const sample of timings) {
      total += Number.isFinite(sample?.transferSize) && sample.transferSize > 0
        ? sample.transferSize
        : bytes;
    }
  }
  for (const { bytes, timings } of collectDirectionBuckets(raw?.upload)) {
    for (const sample of timings) {
      const responseBytes = Number.isFinite(sample?.transferSize) && sample.transferSize > 0
        ? sample.transferSize
        : 0;
      total += bytes + responseBytes;
    }
  }
  return total;
};

// Mirror Cloudflare AIM's streaming formula (latency + bandwidth +
// loadedLatencyIncrease, plus packetLoss only when TURN packetLoss ran;
// thresholds [15, 20, 40, 60]) using upload bandwidth instead of download.
export const computeCloudSyncScore = (measurements = {}, { includePacketLoss = false } = {}) => {
  const { latency, upload, downLoadedLatency, upLoadedLatency, packetLoss } = measurements;
  const loadedCandidates = [downLoadedLatency, upLoadedLatency].filter(Number.isFinite);
  if (!Number.isFinite(latency) || latency <= 0 || !Number.isFinite(upload) || !loadedCandidates.length) {
    return null;
  }
  const loadedIncrease = Math.max(...loadedCandidates) - latency;
  const lossPoints = includePacketLoss
    ? (packetLoss === undefined ? 0 : scorePacketLoss(packetLoss))
    : 0;
  const points = Math.max(
    0,
    scoreLatency(latency)
      + lossPoints
      + scoreUpload(upload)
      + scoreLoadedLatencyIncrease(loadedIncrease),
  );
  const classificationIdx = classifyCloudSync(points);
  return {
    points,
    classificationIdx,
    classificationName: CLASSIFICATION_NAMES[classificationIdx],
  };
};

// Format decimal byte totals to match the MB selector convention (1 MB = 1e6 B).
export const formatTransferredBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-';
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  if (bytes < 100e6) return `${Number((bytes / 1e6).toFixed(1))} MB`;
  if (bytes < 1e9) return `${Math.round(bytes / 1e6)} MB`;
  return `${Number((bytes / 1e9).toFixed(2))} GB`;
};

// Format active runtime (ms) while keeping sub-minute precision and clean minute rollovers.
export const formatDurationMs = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  const sec = ms / 1000;
  if (sec < 59.95) return `${Math.max(0.1, Math.round(sec * 10) / 10).toFixed(1)} s`;
  const totalSec = Math.round(sec);
  return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
};

// Map Cloudflare's 5-tier classification name onto a 1..5 segment count (0 when unmeasured).
export const qualityLevel = (classification) => {
  const idx = CLASSIFICATION_NAMES.indexOf(classification);
  return idx >= 0 ? idx + 1 : 0;
};

// Overhead above idle latency under full link saturation (bufferbloat delta).
export const loadedLatencyDelta = (idleLatency, loadedValue) => {
  if (!Number.isFinite(idleLatency) || idleLatency <= 0 || !Number.isFinite(loadedValue)) {
    return null;
  }
  return Math.round((loadedValue - idleLatency) * 10) / 10;
};

export const formatLoadedDelta = (delta) => {
  if (delta === null) return '';
  return delta > 0 ? `+${delta}` : `${delta}`;
};

export const createSpeedTestSession = (Engine, packages, { now = defaultNow } = {}) => {
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
  let activeStartedAt = null;
  let accumulatedActiveMs = 0;
  let probeTransferredBytes = 0;

  const startActiveClock = () => {
    if (activeStartedAt === null) activeStartedAt = now();
  };

  const stopActiveClock = () => {
    if (activeStartedAt !== null) {
      accumulatedActiveMs += Math.max(0, now() - activeStartedAt);
      activeStartedAt = null;
    }
  };

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
    getActiveDurationMs() {
      const live = running && activeStartedAt !== null ? Math.max(0, now() - activeStartedAt) : 0;
      return Math.round(accumulatedActiveMs + live);
    },
    getTransferredBytes() {
      return probeTransferredBytes + sumSpeedTestTransferredBytes(engine?.results?.raw);
    },
    play() {
      if (disposed || running) return;
      running = true;
      startActiveClock();
      session.onRunningChange(true);
      engine.play();
    },
    pause() {
      if (disposed) return;
      stopActiveClock();
      running = false;
      engine.pause();
      session.onRunningChange(false);
    },
    destroy() {
      stopActiveClock();
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
        probeTransferredBytes += sumSpeedTestTransferredBytes(results?.raw);
        detach();
        isProbe = false;
        prepare();
        if (running) engine.play();
      } else {
        stopActiveClock();
        running = false;
        session.onFinish(results);
      }
    };
  };

  prepare();
  return session;
};
