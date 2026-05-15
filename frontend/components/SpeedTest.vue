<template>
  <!-- Speed Test -->
  <section class="mb-10">
    <!-- Header -->
    <header class="mb-2 flex flex-col items-start justify-between gap-4">
      <div class="flex flex-row items-center justify-between gap-4 w-full">
        <h2 id="SpeedTest"
          class="m-0 flex min-w-0 flex-1 items-center gap-2 text-xl md:text-3xl font-semibold tracking-tight leading-tight">
          🚀 {{ t('speedtest.Title') }}
        </h2>
      </div>
      <div class="text-base text-muted-foreground">
        <p v-if="!isSimpleMode">{{ t('speedtest.Note') }}</p>
      </div>
    </header>

    <Card class="keyboard-shortcut-card jn-card">
      <CardContent class="p-4 md:p-6">
        <!-- Control Area -->
        <div class="flex justify-end mb-5">
          <div class="inline-flex items-stretch">
            <!-- Download addon -->
            <span class="flex items-center px-3 border border-input rounded-l-md bg-muted" aria-label="Download Bytes">
              <CloudDownload class="size-4 text-muted-foreground" />
            </span>
            <!-- Download select -->
            <Select :model-value="String(state.config.package.download.bytes)"
              @update:model-value="(v) => v && (state.config.package.download.bytes = Number(v))"
              :disabled="isRunning || isPaused">
              <SelectTrigger class="rounded-none border-l-0 shadow-none gap-1.5 w-auto min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="size in sizeOptions" :key="size" :value="String(size)">
                  {{ size / 1e6 }} MB
                </SelectItem>
              </SelectContent>
            </Select>
            <!-- Upload addon -->
            <span class="flex items-center px-3 border border-input border-l-0 bg-muted" aria-label="Upload Bytes">
              <CloudUpload class="size-4 text-muted-foreground" />
            </span>
            <!-- Upload select -->
            <Select :model-value="String(state.config.package.upload.bytes)"
              @update:model-value="(v) => v && (state.config.package.upload.bytes = Number(v))"
              :disabled="isRunning || isPaused">
              <SelectTrigger class="rounded-none border-l-0 shadow-none gap-1.5 w-auto min-w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="size in sizeOptions" :key="size" :value="String(size)">
                  {{ size / 1e6 }} MB
                </SelectItem>
              </SelectContent>
            </Select>
            <!-- Start/Pause/Restart button -->
            <JnTooltip :text="t('Tooltips.SpeedTestButton')" side="top">
              <Button size="icon" variant="outline" class="rounded-l-none border-l-0 shadow-none cursor-pointer"
                @click="speedTestController" aria-label="Start/Pause Speed Test">
                <component :is="ctaIcon" />
              </Button>
            </JnTooltip>
          </div>
        </div>

        <!-- Connection Information -->
        <div class="min-h-6 mb-3">
          <Transition name="slide-fade">
            <div v-if="state.speedTest.status !== 'idle' && state.connection.colo"
              class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
              <span class="inline-flex items-center gap-1.5">
                <PersonStanding class="size-4 text-muted-foreground" />
                {{ state.connection.country }}
                <Icon v-if="state.connection.country" :icon="'circle-flags:' + state.connection.loc.toLowerCase()"
                  class="size-4" />
              </span>
              <ArrowLeftRight class="size-4 text-muted-foreground" />
              <span class="inline-flex items-center gap-1.5">
                <Globe class="size-4 text-muted-foreground" />
                {{ state.connection.colo }}, {{ state.connection.coloCountry }}
                <Icon v-if="state.connection.coloCountry"
                  :icon="'circle-flags:' + state.connection.coloCountryCode.toLowerCase()" class="size-4" />
              </span>
            </div>
          </Transition>
        </div>

        <!-- Progress Bar -->
        <Progress :model-value="state.speedTest.progress" class="mb-6"
          :class="[progressIndicatorClass, state.speedTest.status === 'idle' ? 'invisible' : '']" />

        <!-- 4 Metrics Tiles -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div v-for="m in metrics" :key="m.key" class="text-center">
            <p class="text-lg uppercase tracking-wider text-primary mb-1">{{ m.label }}</p>
            <p class="text-2xl md:text-3xl font-mono font-light tabular-nums" :class="metricColorClass">
              <span>{{ state.speedTest[m.key] }}</span>
              <span v-if="state.speedTest.status !== 'idle'" class="ml-1 text-sm font-normal text-muted-foreground">{{
                m.unit }}</span>
            </p>
          </div>
        </div>

        <div id="result"></div>

        <!-- Charts Area -->
        <div v-show="state.speedTest.status !== 'idle'" class="speed-charts-container jn-slide-in">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <div class="chart-wrapper"><canvas ref="downloadChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="uploadChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="latencyChart"></canvas></div>
            <div class="chart-wrapper"><canvas ref="jitterChart"></canvas></div>
          </div>
        </div>

        <!-- Result Block -->
        <div v-if="isFinished && state.speedTest.hasScores && state.connection.colo"
          class="jn-slide-in rounded-md border border-success/30 bg-success/10 p-4">
          <div class="flex items-start gap-2">
            <CalendarCheck2 class="size-5 text-success shrink-0 mt-0.5" />
            <span class="text-base text-success break-all" v-if="state.connection.colo">
              <p class="mb-2">
                {{ t('speedtest.connectionFrom') }}
                <span class="font-mono">{{ state.connection.ip }}</span>
                ( {{ state.connection.country }} )
                {{ t('speedtest.connectionTo') }}
                {{ state.connection.colo }}
                ( {{ state.connection.coloCity }}, {{ state.connection.coloCountry }} )
                {{ t('speedtest.connectionEnd') }}
              </p>
              <p class="mb-2">
                {{ t('speedtest.score') }}
                {{ t('speedtest.videoStreaming') }}
                <span :class="qualityBadgeClass(state.speedTest.streamingScore)">{{ t('speedtest.quality.' +
                  state.speedTest.streamingQuality) }}</span>
                {{ t('speedtest.gaming') }}
                <span :class="qualityBadgeClass(state.speedTest.gamingScore)">
                  {{ t('speedtest.quality.' + state.speedTest.gamingQuality) }}
                </span>
                {{ t('speedtest.rtc') }}
                <span :class="qualityBadgeClass(state.speedTest.rtcScore)">
                  {{ t('speedtest.quality.' + state.speedTest.rtcQuality) }}
                </span>
              </p>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>

<script setup>
import { reactive, computed, onMounted, markRaw, onUnmounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { fetchWithTimeout } from '@/utils/fetch-with-timeout.js';
import { isValidIP } from '@/utils/valid-ip.js';
import getCountryName from '@/data/country-name.js';
import SpeedTestEngine from '@cloudflare/speedtest';
import useSpeedTestCharts from '@/utils/use-speedtest-charts.js';
import { JnTooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeftRight, CalendarCheck2, Play, CloudDownload, CloudUpload,
  Globe, Pause, PersonStanding, RotateCw,
} from 'lucide-vue-next';
import { Icon } from '@iconify/vue';

const { t } = useI18n();
const store = useMainStore();
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);
const userPreferences = computed(() => store.userPreferences);
const isSimpleMode = computed(() => userPreferences.value.simpleMode);
// State Management
const state = reactive({
  speedTest: {
    id: 'speedTest',
    downloadSpeed: '-',
    uploadSpeed: '-',
    latency: '-',
    jitter: '-',
    streamingScore: '-',
    streamingQuality: '-',
    gamingScore: '-',
    gamingQuality: '-',
    rtcScore: '-',
    rtcQuality: '-',
    status: 'idle',
    hasScores: false,
    progress: 0,
  },
  connection: { ip: '', colo: '', loc: '', country: '', coloCountry: '', coloCountryCode: '', coloCity: '' },
  config: {
    package: {
      download: { bytes: 50e6, count: 4 },
      upload: { bytes: 15e6, count: 4 },
      latency: { count: 30 },
    },
  },
});

const {
  downloadChart, uploadChart, latencyChart, jitterChart,
  updateCharts, initStartingPoints, destroyCharts, resetChartData,
} = useSpeedTestCharts(t);

// Optional speed test sizes (bytes) for ToggleGroup
const sizeOptions = [1e6, 10e6, 15e6, 50e6, 100e6];

// --- Derived State ----------------------------------------------------------

const isRunning = computed(() => state.speedTest.status === 'running');
const isPaused = computed(() => state.speedTest.status === 'paused');
const isFinished = computed(() => state.speedTest.status === 'finished');
const isError = computed(() => state.speedTest.status === 'error');

// CTA Icon: running=Pause, finished/error=Retry, otherwise=Start
const ctaIcon = computed(() => {
  if (isRunning.value) return Pause;
  if (isFinished.value || isError.value) return RotateCw;
  return Play;
});


// Color Class for Metrics
const metricColorClass = computed(() => {
  if (isRunning.value || isPaused.value) return 'text-info';
  if (isFinished.value) return 'text-success';
  if (isError.value) return 'text-destructive';
  return '';
});

const progressIndicatorClass = computed(() => {
  if (isFinished.value) return '[&>*]:bg-success';
  if (isError.value) return '[&>*]:bg-destructive';
  if (isRunning.value || isPaused.value) return '[&>*]:bg-info';
  return '';
});

// 4 Metrics Metadata
const metrics = computed(() => [
  { key: 'downloadSpeed', label: t('speedtest.Download'), unit: 'Mb/s' },
  { key: 'uploadSpeed', label: t('speedtest.Upload'), unit: 'Mb/s' },
  { key: 'latency', label: t('speedtest.Latency'), unit: 'ms' },
  { key: 'jitter', label: t('speedtest.Jitter'), unit: 'ms' },
]);

// Quality Badge Color: >=50 success, >=10 warning, else destructive
const qualityBadgeClass = (score) => {
  if (score === '-' || score === undefined) return 'text-muted-foreground';
  if (score >= 50) return 'text-success';
  if (score >= 10) return 'text-warning';
  return 'text-destructive';
};

// --- Connection Data ----------------------------------------------------------

const connectionMethods = {
  async getIPFromSpeedTest() {
    try {
      const response = await fetchWithTimeout('https://speed.cloudflare.com/cdn-cgi/trace');
      const data = await response.text();
      const lines = data.split('\n');
      const ip = lines.find((l) => l.startsWith('ip='))?.split('=')[1];
      const colo = lines.find((l) => l.startsWith('colo='))?.split('=')[1];
      const loc = lines.find((l) => l.startsWith('loc='))?.split('=')[1];

      if (!isValidIP(ip)) throw new Error('Invalid IP from SpeedTest Server');

      const { default: getColoCountry } = await import('@/data/speedtest-colos.js');

      return {
        ip, colo, loc,
        country: getCountryName(loc, lang.value) || '',
        coloCountryCode: getColoCountry(colo).country || '',
        coloCity: getColoCountry(colo).city || '',
        coloCountry: getCountryName(getColoCountry(colo).country, lang.value) || '',
      };
    } catch (error) {
      console.error('Error fetching IP from SpeedTest Server:', error);
      return null;
    }
  },
};

// --- Test Engine ----------------------------------------------------------

let testEngine;
const engineMethods = {
  reset() {
    state.speedTest.hasScores = false;
    Object.assign(state.speedTest, {
      downloadSpeed: 0, uploadSpeed: 0, latency: 0, jitter: 0,
      streamingScore: '-', gamingScore: '-', rtcScore: '-',
      progress: 0,
    });
    if (testEngine) testEngine = null;

    return markRaw(new SpeedTestEngine({
      autoStart: false,
      measurements: [
        { type: 'latency', numPackets: state.config.package.latency.count },
        { type: 'download', bytes: state.config.package.download.bytes, count: state.config.package.download.count },
        { type: 'upload', bytes: state.config.package.upload.bytes, count: state.config.package.upload.count },
      ],
    }));
  },

  updateResults(results) {
    const summary = results.getSummary();
    Object.assign(state.speedTest, {
      downloadSpeed: parseFloat((summary.download / 1000000).toFixed(2)),
      uploadSpeed: parseFloat((summary.upload / 1000000).toFixed(2)),
      latency: parseFloat(summary.latency.toFixed(2)),
      jitter: parseFloat(summary.jitter.toFixed(2)),
    });
  },

  updateProgress() {
    const rawData = testEngine.results.raw;
    const perStage = 100 / 3;
    let progress = 0;
    if (rawData.download?.started) progress += rawData.download.finished ? perStage : perStage / 2;
    if (rawData.upload?.started) progress += rawData.upload.finished ? perStage : perStage / 2;
    if (rawData.latency?.started) progress += rawData.latency.finished ? perStage : perStage / 2;
    state.speedTest.progress = Math.min(progress, 100);
  },

  updateSpeedInRealTime() {
    if (state.speedTest.status === 'finished' || state.speedTest.status === 'error') return;
    try {
      const rawData = testEngine?.results?.raw;
      if (!rawData) return;

      if (rawData.latency?.started) {
        if (rawData.latency?.results?.timings?.length > 0) {
          const latencyTimings = rawData.latency.results.timings;
          state.speedTest.latency = parseFloat(latencyTimings[latencyTimings.length - 1].ping.toFixed(2));

          if (latencyTimings.length >= 2) {
            const differences = [];
            for (let i = 1; i < latencyTimings.length; i++) {
              differences.push(Math.abs(latencyTimings[i].ping - latencyTimings[i - 1].ping));
            }
            const mean = differences.reduce((a, b) => a + b, 0) / differences.length;
            const variance = differences.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / differences.length;
            state.speedTest.jitter = parseFloat(Math.sqrt(variance).toFixed(2));
          }
        }
      }

      if (rawData.download?.started) {
        if (rawData.download.current?.timings?.length > 0) {
          const timings = rawData.download.current.timings;
          state.speedTest.downloadSpeed = parseFloat((timings[timings.length - 1].bps / 1000000).toFixed(2));
        } else if (rawData.download?.results) {
          const downloadKeys = Object.keys(rawData.download.results);
          if (downloadKeys.length > 0) {
            const lastKey = downloadKeys[downloadKeys.length - 1];
            const downloadTimings = rawData.download.results[lastKey].timings;
            if (downloadTimings?.length > 0) {
              const latestTiming = downloadTimings[downloadTimings.length - 1];
              state.speedTest.downloadSpeed = parseFloat((latestTiming.bps / 1000000).toFixed(2));
            }
          }
        } else {
          state.speedTest.downloadSpeed = 0;
        }
      }

      if (rawData.upload?.started) {
        if (rawData.upload.current?.timings?.length > 0) {
          const timings = rawData.upload.current.timings;
          state.speedTest.uploadSpeed = parseFloat((timings[timings.length - 1].bps / 1000000).toFixed(2));
        } else if (rawData.upload?.results) {
          const uploadKeys = Object.keys(rawData.upload.results);
          if (uploadKeys.length > 0) {
            const lastKey = uploadKeys[uploadKeys.length - 1];
            const uploadTimings = rawData.upload.results[lastKey].timings;
            if (uploadTimings?.length > 0) {
              const latestTiming = uploadTimings[uploadTimings.length - 1];
              state.speedTest.uploadSpeed = parseFloat((latestTiming.bps / 1000000).toFixed(2));
            }
          }
        } else {
          state.speedTest.uploadSpeed = 0;
        }
      }

      updateCharts(
        state.speedTest.downloadSpeed,
        state.speedTest.uploadSpeed,
        state.speedTest.latency,
        state.speedTest.jitter,
        rawData,
      );
    } catch (error) {
      console.error('Error in updateSpeedInRealTime:', error);
    }
  },

  updateLatency(rawData) {
    if (!rawData.latency?.results?.timings?.length) return;
    const latencyTimings = rawData.latency.results.timings;
    const latestLatency = latencyTimings[latencyTimings.length - 1].ping;
    const newLatency = parseFloat(latestLatency.toFixed(2));
    if (newLatency < state.speedTest.latency || state.speedTest.latency === 0) {
      state.speedTest.latency = newLatency;
    }
  },
};

// --- Achievements --------------------------------------------------------------

const achievementHandler = {
  checkAndUpdate() {
    if (state.speedTest.status !== 'finished') return;
    const achievements = this.getQualifiedAchievements();
    this.triggerAchievementsWithDelay(achievements);
  },

  getQualifiedAchievements() {
    const { downloadSpeed, uploadSpeed } = state.speedTest;
    const achievements = [];
    if (downloadSpeed >= 100) achievements.push('BarelyEnough');
    if (downloadSpeed >= 500) achievements.push('RapidPace');
    if (downloadSpeed >= 1000) achievements.push('TorrentFlow');
    if (uploadSpeed >= 50) achievements.push('SteadyGoing');
    if (uploadSpeed >= 200) achievements.push('TooFastTooSimple');
    if (uploadSpeed >= 1000) achievements.push('SwiftAscent');
    return achievements.filter((a) => !store.userAchievements[a].achieved);
  },

  triggerAchievementsWithDelay(achievements, delay = 2000) {
    if (!achievements.length) return;
    const achievement = achievements.shift();
    store.setTriggerUpdateAchievements(achievement);
    if (achievements.length) {
      setTimeout(() => this.triggerAchievementsWithDelay(achievements, delay), delay);
    }
  },
};

// --- Test Control ----------------------------------------------------------

const setupTestEngine = async () => {
  if (!state.connection.ip) {
    const connectionData = await connectionMethods.getIPFromSpeedTest();
    if (connectionData) Object.assign(state.connection, connectionData);
  }

  testEngine.onRunningChange = () => { state.speedTest.status = 'running'; };
  testEngine.onResultsChange = () => {
    engineMethods.updateProgress();
    engineMethods.updateSpeedInRealTime();
  };
  testEngine.onFinish = (results) => {
    state.speedTest.status = 'finished';
    state.speedTest.progress = 100;
    testEngine.onRunningChange = null;
    testEngine.onResultsChange = null;
    testEngine.onError = null;
    engineMethods.updateResults(results);

    const scores = results.getScores();
    if (scores?.streaming) {
      state.speedTest.hasScores = true;
      state.speedTest.streamingScore = scores.streaming.points;
      state.speedTest.gamingScore = scores.gaming.points;
      state.speedTest.rtcScore = scores.rtc.points;
      state.speedTest.streamingQuality = scores.streaming.points >= 50 ? 'Good' : scores.streaming.points >= 10 ? 'Medium' : 'Bad';
      state.speedTest.gamingQuality = scores.gaming.points >= 50 ? 'Good' : scores.gaming.points >= 10 ? 'Medium' : 'Bad';
      state.speedTest.rtcQuality = scores.rtc.points >= 50 ? 'Good' : scores.rtc.points >= 10 ? 'Medium' : 'Bad';
    }

    testEngine = null;
    if (isSignedIn.value) achievementHandler.checkAndUpdate();
  };
  testEngine.onError = (e) => {
    if (typeof e === 'string' && !e.includes('ICE')) {
      state.speedTest.status = 'error';
    }
    console.error('Speed Test Error: ', e);
  };
};

const speedTestController = async () => {
  try {
    if (state.speedTest.status === 'running') {
      testEngine.pause();
      state.speedTest.status = 'paused';
      return;
    }
    if (state.speedTest.status === 'paused') {
      testEngine.play();
      return;
    }

    resetChartData();
    destroyCharts();
    await initStartingPoints();

    Object.assign(state.speedTest, {
      downloadSpeed: 0, uploadSpeed: 0, latency: 0, jitter: 0,
      streamingScore: '-', gamingScore: '-', rtcScore: '-',
      hasScores: false, progress: 0,
    });

    testEngine = engineMethods.reset();
    if (!testEngine) { console.error('Failed to initialize test engine'); return; }

    await setupTestEngine();
    trackEvent('Section', 'StartClick', 'SpeedTest');
    testEngine.play();
  } catch (error) {
    console.error('Error in speedTestController:', error);
    state.speedTest.status = 'error';
  }
};

// --- Lifecycle ----------------------------------------------------------

onMounted(() => { store.setMountingStatus('speedtest', true); });
// If the user navigates away mid-test, detach the engine's callbacks before
// dropping the reference — otherwise any in-flight async work inside the
// SpeedTestEngine would still try to write state refs that no longer exist.
onUnmounted(() => {
  if (testEngine) {
    testEngine.onRunningChange = null;
    testEngine.onResultsChange = null;
    testEngine.onFinish = null;
    testEngine.onError = null;
    testEngine = null;
  }
  destroyCharts();
});

defineExpose({ speedTestController });
</script>

<style scoped>
/* Vue transition: Connection information line fade-in/out slide */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.8s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* Charts container: Chart.js canvas needs a parent container with a clear height */
.speed-charts-container {
  margin: 20pt 0;
}

.chart-wrapper {
  position: relative;
  height: 130pt;
  width: 100%;
  margin-bottom: 15pt;
}

@media (max-width: 768px) {
  .chart-wrapper {
    height: 100pt;
    margin-bottom: 20pt;
  }
}

@media (min-width: 769px) and (max-width: 991px) {
  .chart-wrapper {
    height: 100pt;
    margin-bottom: 25pt;
  }
}

/* Test start / finish slide-in animation */
.jn-slide-in {
  animation: jn-slide-in 0.2s ease-in forwards;
}

@keyframes jn-slide-in {
  from {
    transform: translateY(20px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
