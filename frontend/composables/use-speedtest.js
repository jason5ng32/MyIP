// Reactive state, boot-draw orchestration, and Cloudflare engine lifecycle for SpeedTest.
import {
  computed, getCurrentScope, markRaw, nextTick, onScopeDispose, reactive, ref, toValue,
} from 'vue';
import { useStatusTone } from './use-status-tone.js';
import { trackEvent } from '../utils/analytics.js';
import { emitAppEvent } from '../utils/app-events.js';
import { fetchWithTimeout } from '../utils/fetch-with-timeout.js';
import { isValidIP } from '../utils/ip/valid-ip.js';
import { parseTrace } from '../utils/ip/parse-trace.js';
import getCountryName from '../utils/country-name.js';
import {
  computeCloudSyncScore, createSpeedTestSession,
  getSpeedTestLiveValues, sumSpeedTestTransferredBytes,
} from '../utils/features/speedtest-session.js';

const BOOT_DRAW_MS = 680;
export const SPEEDTEST_SIZE_OPTIONS = [1e6, 10e6, 15e6, 50e6, 100e6];

let SpeedTestEngineClass = null;
let speedTestEnginePromise = null;

export const useSpeedTest = ({
  t,
  lang,
  updateAllIPs = () => {},
  initStartingPoints = () => Promise.resolve(),
  updateCharts = () => {},
  resetChartData = () => {},
  destroyCharts = () => {},
}) => {
  const hasEverSettled = ref(false);

  const state = reactive({
    speedTest: {
      id: 'speedTest',
      downloadSpeed: '-', uploadSpeed: '-', latency: '-', jitter: '-',
      downLoadedLatency: '-', upLoadedLatency: '-', downLoadedJitter: '-', upLoadedJitter: '-',
      streamingScore: '-', gamingScore: '-', rtcScore: '-', cloudSyncScore: '-',
      streamingQuality: '-', gamingQuality: '-', rtcQuality: '-', cloudSyncQuality: '-',
      transferredBytes: 0, activeDurationMs: 0,
      status: 'idle', phase: 'probe', hasScores: false, progress: 0,
      isDrawing: false, hasDrawn: false,
    },
    connection: {
      ip: '', colo: '', loc: '', country: '', coloCountry: '', coloCountryCode: '', coloCity: '',
    },
    config: {
      package: {
        download: { bytes: 50e6, count: 4 },
        upload: { bytes: 15e6, count: 4 },
        latency: { count: 20 },
      },
    },
  });

  // --- Derived State --------------------------------------------------------

  const isIdle = computed(() => state.speedTest.status === 'idle');
  const isRunning = computed(() => state.speedTest.status === 'running');
  const isPaused = computed(() => state.speedTest.status === 'paused');
  const isFinished = computed(() => state.speedTest.status === 'finished');
  const isError = computed(() => state.speedTest.status === 'error');

  // Estimated payload across all configured download + upload rounds (in MB).
  const estimatedTotalMB = computed(() => {
    const { download, upload } = state.config.package;
    return Math.round((download.bytes * download.count + upload.bytes * upload.count) / 1e6);
  });

  const progressLabel = computed(() => {
    if (isIdle.value) return t('speedtest.phaseStandby');
    if (isFinished.value) return t('speedtest.phaseFinished');
    if (isError.value) return t('speedtest.phaseFailed');
    const phase = t(`speedtest.phases.${state.speedTest.phase}`);
    return isPaused.value ? t('speedtest.phasePaused', { phase }) : phase;
  });

  // Drives the directional packet stream on the Client <-> Edge Server link.
  const linkFlow = computed(() => {
    if (isFinished.value) return 'done';
    if (isError.value) return 'error';
    if (isPaused.value) return 'paused';
    if (!isRunning.value || state.speedTest.isDrawing) return 'idle';
    const { phase } = state.speedTest;
    if (phase === 'download') return 'download';
    if (phase === 'upload') return 'upload';
    return 'ping';
  });

  const { dotClass, textClass, toneVar } = useStatusTone();

  const runTone = computed(() => {
    if (isFinished.value) return 'ok-fast';
    if (isError.value) return 'fail';
    if (isPaused.value) return 'ok-slow';
    if (isRunning.value) return state.speedTest.isDrawing ? 'wait' : 'active';
    return null;
  });

  const statusDotClass = computed(() => (
    runTone.value ? dotClass(runTone.value) : 'bg-muted-foreground/35'
  ));

  const metricColorClass = computed(() => {
    if (isIdle.value || state.speedTest.isDrawing) return 'text-muted-foreground/45';
    return runTone.value ? textClass(runTone.value) : '';
  });

  const progressIndicatorClass = computed(() => (
    runTone.value ? dotClass(runTone.value) : 'bg-border'
  ));

  const isMetricActive = (key) => {
    if (!isRunning.value || state.speedTest.isDrawing) return false;
    const { phase } = state.speedTest;
    if (phase === 'probe') return key === 'latency' || key === 'downloadSpeed';
    if (phase === 'latency') return key === 'latency' || key === 'jitter';
    if (phase === 'download') return key === 'downloadSpeed';
    if (phase === 'upload') return key === 'uploadSpeed';
    return false;
  };

  const metricTone = (key) => {
    if (isMetricActive(key)) return 'active';
    if (isPaused.value) return 'ok-slow';
    if (isFinished.value && state.speedTest[key] !== '-') return 'ok-fast';
    return null;
  };

  const metricDotClass = (key) => {
    const tone = metricTone(key);
    return tone ? dotClass(tone) : 'bg-border';
  };

  const metricToneVar = (key) => {
    const tone = metricTone(key);
    return tone ? toneVar(tone) : undefined;
  };

  // --- Connection & Engine Methods ------------------------------------------

  const connectionMethods = {
    async getIPFromSpeedTest() {
      // Browser privacy extensions frequently block /cdn-cgi/trace while still
      // allowing __down / __up; keep network/block failures at console.warn so
      // visitor-side filters do not trigger Sentry error captures.
      let data;
      try {
        const response = await fetchWithTimeout('https://speed.cloudflare.com/cdn-cgi/trace');
        if (!response.ok) {
          console.warn(`Error fetching IP from SpeedTest Server: HTTP ${response.status}`);
          return null;
        }
        data = await response.text();
      } catch (error) {
        console.warn('Error fetching IP from SpeedTest Server:', error);
        return null;
      }

      try {
        const { ip, colo, loc } = parseTrace(data);

        if (!isValidIP(ip)) {
          const detail = ip == null ? 'no-ip-line'
            : ip === '' ? 'empty-value'
              : `len=${ip.length} tail=0x${ip.charCodeAt(ip.length - 1).toString(16)}`;
          throw new Error(`Invalid IP from SpeedTest Server (${detail})`);
        }

        const { default: getColoCountry } = await import('../data/speedtest-colos.js');
        const currentLang = toValue(lang);
        const coloMeta = getColoCountry(colo);

        return {
          ip,
          colo,
          loc,
          country: getCountryName(loc, currentLang) || '',
          coloCountryCode: coloMeta.country || '',
          coloCity: coloMeta.city || '',
          coloCountry: getCountryName(coloMeta.country, currentLang) || '',
        };
      } catch (error) {
        console.error('Error fetching IP from SpeedTest Server:', error);
        return null;
      }
    },
  };

  let testEngine = null;
  let runId = 0;

  const engineMethods = {
    waitForBootDraw() {
      if (typeof window === 'undefined') return null;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return null;
      return new Promise((resolve) => { setTimeout(resolve, BOOT_DRAW_MS); });
    },

    loadEngine() {
      if (SpeedTestEngineClass) return Promise.resolve(SpeedTestEngineClass);
      speedTestEnginePromise ??= import('@cloudflare/speedtest')
        .then((mod) => {
          SpeedTestEngineClass = mod.default;
          return SpeedTestEngineClass;
        })
        .catch((error) => {
          speedTestEnginePromise = null;
          throw error;
        });
      return speedTestEnginePromise;
    },

    reset(Engine) {
      return markRaw(createSpeedTestSession(Engine, state.config.package));
    },

    updateResults(results) {
      const summary = results.getSummary();
      const fmt = (v, div = 1) => (v == null ? 0 : parseFloat((v / div).toFixed(2)));
      Object.assign(state.speedTest, {
        downloadSpeed: fmt(summary.download, 1000000),
        uploadSpeed: fmt(summary.upload, 1000000),
        latency: fmt(summary.latency),
        jitter: fmt(summary.jitter),
        downLoadedLatency: summary.downLoadedLatency == null ? '-' : fmt(summary.downLoadedLatency),
        upLoadedLatency: summary.upLoadedLatency == null ? '-' : fmt(summary.upLoadedLatency),
        downLoadedJitter: summary.downLoadedJitter == null ? '-' : fmt(summary.downLoadedJitter),
        upLoadedJitter: summary.upLoadedJitter == null ? '-' : fmt(summary.upLoadedJitter),
      });
    },

    updateProgress() {
      const rawData = testEngine?.results?.raw;
      if (!rawData || testEngine.isProbe) return;
      const perStage = 100 / 3;
      let progress = 0;
      if (rawData.latency?.started) progress += rawData.latency.finished ? perStage : perStage / 2;
      if (rawData.download?.started) progress += rawData.download.finished ? perStage : perStage / 2;
      if (rawData.upload?.started) progress += rawData.upload.finished ? perStage : perStage / 2;
      state.speedTest.progress = Math.max(state.speedTest.progress, Math.min(progress, 100));
    },

    updateSpeedInRealTime() {
      if (state.speedTest.status === 'finished' || state.speedTest.status === 'error') return;
      try {
        const results = testEngine?.results;
        if (!results) return;
        Object.assign(state.speedTest, getSpeedTestLiveValues(results));
        updateCharts(
          state.speedTest.downloadSpeed,
          state.speedTest.uploadSpeed,
          state.speedTest.latency,
          state.speedTest.jitter,
          results.raw,
        );
      } catch (error) {
        console.error('Error in updateSpeedInRealTime:', error);
      }
    },
  };

  // --- Orchestration --------------------------------------------------------

  const loadConnection = async (currentRun) => {
    if (!state.connection.ip) {
      const connectionData = await connectionMethods.getIPFromSpeedTest();
      if (connectionData && currentRun === runId) {
        Object.assign(state.connection, connectionData);
        updateAllIPs([{
          ip: connectionData.ip,
          country: connectionData.loc || '',
          location: connectionData.country || '',
        }]);
      }
    }
  };

  const detachEngineCallbacks = () => {
    if (!testEngine) return;
    testEngine.onRunningChange = () => {};
    testEngine.onResultsChange = () => {};
    testEngine.onError = () => {};
  };

  const setupTestEngine = () => {
    testEngine.onPhaseChange = (phase) => { state.speedTest.phase = phase; };
    testEngine.onRunningChange = (running) => {
      state.speedTest.status = running ? 'running' : 'paused';
      if (running) state.speedTest.progress = Math.max(state.speedTest.progress, 5);
    };
    testEngine.onResultsChange = () => {
      engineMethods.updateProgress();
      engineMethods.updateSpeedInRealTime();
    };
    testEngine.onFinish = (results) => {
      const summary = results?.getSummary?.() ?? {};
      const hasData = [summary.download, summary.upload, summary.latency]
        .some((v) => Number.isFinite(v) && v > 0);
      if (state.speedTest.status === 'error' || !hasData) {
        state.speedTest.status = 'error';
        detachEngineCallbacks();
        testEngine = null;
        return;
      }

      state.speedTest.status = 'finished';
      state.speedTest.progress = 100;
      detachEngineCallbacks();
      engineMethods.updateResults(results);
      state.speedTest.transferredBytes = testEngine?.getTransferredBytes?.()
        ?? sumSpeedTestTransferredBytes(results?.raw);
      state.speedTest.activeDurationMs = testEngine?.getActiveDurationMs?.()
        ?? summary.totalDurationMs
        ?? 0;

      const scores = results.getScores();
      const cloudSync = computeCloudSyncScore(summary, {
        includePacketLoss: Boolean(results?.raw?.packetLoss),
      });
      if (scores?.streaming) {
        state.speedTest.hasScores = true;
        state.speedTest.streamingScore = scores.streaming.points;
        state.speedTest.gamingScore = scores.gaming.points;
        state.speedTest.rtcScore = scores.rtc.points;
        state.speedTest.cloudSyncScore = cloudSync?.points ?? '-';
        state.speedTest.streamingQuality = scores.streaming.classificationName;
        state.speedTest.gamingQuality = scores.gaming.classificationName;
        state.speedTest.rtcQuality = scores.rtc.classificationName;
        state.speedTest.cloudSyncQuality = cloudSync?.classificationName ?? '-';
      }

      testEngine = null;
      hasEverSettled.value = true;
      emitAppEvent('speedtest:finished', {
        downloadSpeed: state.speedTest.downloadSpeed,
        uploadSpeed: state.speedTest.uploadSpeed,
        latency: state.speedTest.latency,
        jitter: state.speedTest.jitter,
        downLoadedLatency: state.speedTest.downLoadedLatency,
        upLoadedLatency: state.speedTest.upLoadedLatency,
        scores: state.speedTest.hasScores
          ? {
            streaming: state.speedTest.streamingScore,
            gaming: state.speedTest.gamingScore,
            rtc: state.speedTest.rtcScore,
          }
          : null,
        qualities: state.speedTest.hasScores
          ? {
            streaming: state.speedTest.streamingQuality,
            gaming: state.speedTest.gamingQuality,
            rtc: state.speedTest.rtcQuality,
          }
          : null,
        connection: { ...state.connection },
      });
    };
    testEngine.onError = (e) => {
      if (typeof e === 'string' && !e.includes('ICE')) {
        state.speedTest.status = 'error';
      }
      console.error('Speed Test Error: ', e);
    };
  };

  const resetSpeedTestReadings = (initialValue, progress, isDrawing) => {
    Object.assign(state.speedTest, {
      downloadSpeed: initialValue, uploadSpeed: initialValue,
      latency: initialValue, jitter: initialValue,
      downLoadedLatency: '-', upLoadedLatency: '-', downLoadedJitter: '-', upLoadedJitter: '-',
      streamingScore: '-', gamingScore: '-', rtcScore: '-', cloudSyncScore: '-',
      streamingQuality: '-', gamingQuality: '-', rtcQuality: '-', cloudSyncQuality: '-',
      transferredBytes: 0, activeDurationMs: 0,
      hasScores: false, progress, phase: 'probe', status: 'running', isDrawing,
    });
  };

  const speedTestController = async () => {
    let currentRun = runId;
    try {
      if (state.speedTest.status === 'running') {
        if (testEngine) testEngine.pause();
        else runId += 1;
        if (state.speedTest.isDrawing) {
          state.speedTest.isDrawing = false;
          state.speedTest.status = 'idle';
          return;
        }
        state.speedTest.status = 'paused';
        return;
      }
      if (state.speedTest.status === 'paused' && testEngine) {
        testEngine.play();
        return;
      }

      currentRun = ++runId;
      testEngine?.destroy();
      testEngine = null;
      resetChartData();
      destroyCharts();

      const bootDraw = !state.speedTest.hasDrawn ? engineMethods.waitForBootDraw() : null;
      const engineLoad = engineMethods.loadEngine();
      engineLoad.catch(() => {});
      void loadConnection(currentRun).catch((err) => console.error('Error loading speed test connection:', err));
      trackEvent('Section', 'StartClick', 'SpeedTest');

      if (bootDraw) {
        resetSpeedTestReadings('-', 0, true);
        await bootDraw;
        if (currentRun !== runId) return;
      }

      resetSpeedTestReadings(0, 5, false);
      state.speedTest.hasDrawn = true;

      void nextTick().then(() => {
        if (currentRun === runId && state.speedTest.status !== 'error') return initStartingPoints();
      }).catch((err) => console.error('Error initializing speed test charts:', err));

      const Engine = await engineLoad;
      if (currentRun !== runId) return;

      testEngine = engineMethods.reset(Engine);
      if (!testEngine) {
        state.speedTest.status = 'error';
        console.error('Failed to initialize test engine');
        return;
      }

      setupTestEngine();
      testEngine.play();
    } catch (error) {
      console.error('Error in speedTestController:', error);
      if (currentRun === runId) {
        state.speedTest.isDrawing = false;
        state.speedTest.hasDrawn = true;
        state.speedTest.status = 'error';
      }
    }
  };

  const cleanup = () => {
    runId += 1;
    if (testEngine) {
      detachEngineCallbacks();
      testEngine.onFinish = () => {};
      testEngine.destroy();
      testEngine = null;
    }
    destroyCharts();
  };

  if (getCurrentScope()) onScopeDispose(cleanup);

  return {
    state,
    hasEverSettled,
    sizeOptions: SPEEDTEST_SIZE_OPTIONS,
    isIdle,
    isRunning,
    isPaused,
    isFinished,
    isError,
    estimatedTotalMB,
    progressLabel,
    statusDotClass,
    progressIndicatorClass,
    metricColorClass,
    metricDotClass,
    metricToneVar,
    linkFlow,
    isMetricActive,
    connectionMethods,
    engineMethods,
    speedTestController,
    cleanup,
  };
};
export default useSpeedTest;
