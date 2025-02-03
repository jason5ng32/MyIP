<template>
  <!-- Speed Test -->
  <div class="speed-test-section mb-4">
    <div class="jn-title2">
      <h2 id="SpeedTest" :class="{ 'mobile-h2': isMobile }">🚀 {{ t('speedtest.Title') }}</h2>

    </div>
    <div class="text-secondary">
      <p>{{ t('speedtest.Note') }}</p>
    </div>
    <div class="row">
      <div class="col-12 mb-3">
        <div class="card jn-card keyboard-shortcut-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">

            <div class="row justify-content-end mt-3 mb-4" :data-bs-theme="isDarkMode ? 'dark' : ''">
              <div class="input-group" :class="[isMobile ? 'w-100' : 'w-50']">
                <span class="input-group-text"><i class="bi bi-cloud-download"></i></span>
                <select aria-label="Download Bytes" class="form-select" :class="{ 'jn-ip-font': isMobile }"
                  id="downloadBytes"
                  :disabled="state.speedTest.status === 'running' || state.speedTest.status === 'paused'"
                  v-model="state.config.package.download.bytes">
                  <option v-for="size in [100e6, 50e6, 15e6, 10e6, 1e6]" :key="size" :value="size">{{ size / 1e6 }} MB
                  </option>
                </select>
                <span class="input-group-text"><i class="bi bi-cloud-upload"></i></span>
                <select aria-label="Upload Bytes" class="form-select" :class="{ 'jn-ip-font': isMobile }"
                  id="uploadBytes"
                  :disabled="state.speedTest.status === 'running' || state.speedTest.status === 'paused'"
                  v-model="state.config.package.upload.bytes">
                  <option v-for="size in [100e6, 50e6, 15e6, 10e6, 1e6]" :key="size" :value="size">{{ size / 1e6 }} MB
                  </option>
                </select>
                <button @click="speedTestController" class="btn"
                  :class="[isDarkMode ? 'jn-startbtn-dark' : 'btn-light jn-startbtn']"
                  aria-label="Start/Pause Speed Test"
                  v-tooltip="{ title: t('Tooltips.SpeedTestButton'), placement: 'top' }">
                  <span v-if="state.speedTest.status === 'running'">
                    <i class="bi bi-pause-fill"></i>
                  </span>
                  <span v-else-if="state.speedTest.status === 'finished' || state.speedTest.status === 'error'">
                    <i class="bi bi-arrow-clockwise"></i>
                  </span>
                  <span v-else><i class="bi bi-caret-right-fill"></i></span>
                </button>
              </div>
            </div>

            <Transition name="slide-fade">
              <div class="d-flex align-items-center align-content-center justify-content-end pb-2"
                :data-bs-theme="isDarkMode ? 'dark' : ''"
                v-if="state.speedTest.status !== 'idle' && state.connection.colo">
                <div>
                  <i class="bi bi-person-arms-up"></i>
                  {{state.connection.country}}
                  <span v-if="state.connection.country"
                    :class="'jn-fl fi fi-' + state.connection.loc.toLowerCase()"></span>
                </div>
                <div class=" mx-2">
                  <i class="bi bi-arrow-left-right"></i>
                </div>
                <div>
                  <i class="bi bi-globe"></i>
                  {{state.connection.colo}},&nbsp;
                  {{state.connection.coloCountry}} <span v-if="state.connection.coloCountry"
                    :class="'jn-fl fi fi-' + state.connection.coloCountryCode.toLowerCase()"></span>
                </div>
              </div>
            </Transition>
            <div class="progress" style="height: 20px; margin: 4pt 0 20pt 0;"
              :class="{ 'jn-opacity-0': state.speedTest.status == 'idle', 'jn-progress-dark': isDarkMode }">
              <div class="progress-bar progress-bar-striped jn-progress"
                :class="[state.speedTest.status === 'finished' ? 'bg-success' : 'bg-info progress-bar-animated']"
                role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"
                id="speedtest-progress" aria-label="Progress Bar">
              </div>
            </div>
            <div class="row" style="margin-bottom: 10pt;">
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ t('speedtest.Download') }}</p>
                <p id="download-speed" class="speedtest-h5" :class="updateSpeedTestColor(state.speedTest.status)">
                  <span class="jn-speedtest-number">{{ state.speedTest.downloadSpeed }}</span>
                  <span v-if="state.speedTest.status !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ t('speedtest.Upload') }}</p>
                <p id="upload-speed" class="speedtest-h5" :class="updateSpeedTestColor(state.speedTest.status)">
                  <span class="jn-speedtest-number">{{ state.speedTest.uploadSpeed }}</span>
                  <span v-if="state.speedTest.status !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ t('speedtest.Latency') }}</p>
                <p id="latency" class="speedtest-h5" :class="updateSpeedTestColor(state.speedTest.status)">
                  <span class="jn-speedtest-number">{{ state.speedTest.latency }}</span>
                  <span v-if="state.speedTest.status !== 'idle'">ms</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ t('speedtest.Jitter') }}</p>
                <p id="jitter" class="speedtest-h5" :class="updateSpeedTestColor(state.speedTest.status)">
                  <span class="jn-speedtest-number">{{ state.speedTest.jitter }}</span>
                  <span v-if="state.speedTest.status !== 'idle'">ms</span>
                </p>
              </div>
            </div>

            <div id="result"></div>

            <!-- 在结果区域上方添加图表 -->
            <div class="speed-charts-container mb-4 jn-slide-in" v-show="state.speedTest.status !== 'idle'">
              <div class="row">
                <div class="col-md-6 col-lg-3">
                  <div class="chart-wrapper">
                    <canvas ref="downloadChart"></canvas>
                  </div>
                </div>
                <div class="col-md-6 col-lg-3">
                  <div class="chart-wrapper">
                    <canvas ref="uploadChart"></canvas>
                  </div>
                </div>
                <div class="col-md-6 col-lg-3">
                  <div class="chart-wrapper">
                    <canvas ref="latencyChart"></canvas>
                  </div>
                </div>
                <div class="col-md-6 col-lg-3">
                  <div class="chart-wrapper">
                    <canvas ref="jitterChart"></canvas>
                  </div>
                </div>
              </div>
            </div>

            <div class="row alert alert-success m-1 p-2 jn-slide-in" :data-bs-theme="isDarkMode ? 'dark' : ''"
              v-if="state.speedTest.status === 'finished' && state.speedTest.hasScores">
              <p id="score" class="speedtest-p"><i class="bi bi-calendar2-check"></i>&nbsp;
                <span v-if="state.connection.colo">
                  {{ t('speedtest.connectionFrom') }}
                  {{ state.connection.ip }} ( {{ state.connection.country }} )
                  {{ t('speedtest.connectionTo') }}
                  {{ state.connection.colo }}
                  ( {{ state.connection.coloCity }}
                  , {{ state.connection.coloCountry }} )
                  {{ t('speedtest.connectionEnd') }}
                </span>
                {{ t('speedtest.score') }}
                {{ t('speedtest.videoStreaming') }}
                <span
                  :class="state.speedTest.streamingScore >= 50 ? 'text-success' : state.speedTest.streamingScore >= 10 ? 'jn-text-warning' : 'text-danger'">
                  {{ t('speedtest.quality.' + state.speedTest.streamingQuality) }}
                </span>
                {{ t('speedtest.gaming') }}
                <span
                  :class="state.speedTest.gamingScore >= 50 ? 'text-success' : state.speedTest.gamingScore >= 10 ? 'jn-text-warning' : 'text-danger'">
                  {{ t('speedtest.quality.' + state.speedTest.gamingQuality) }}
                </span>
                {{ t('speedtest.rtc') }}
                <span
                  :class="state.speedTest.rtcScore >= 50 ? 'text-success' : state.speedTest.rtcScore >= 10 ? 'jn-text-warning' : 'text-danger'">
                  {{ t('speedtest.quality.' + state.speedTest.rtcQuality) }}
                </span>
                {{ t('speedtest.resultNote') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, markRaw, onUnmounted } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { isValidIP } from '@/utils/valid-ip.js';
import getCountryName from '@/utils/country-name.js';
import SpeedTestEngine from '@cloudflare/speedtest';
import useSpeedTestCharts from '@/utils/use-speedtest-charts.js';

const { t } = useI18n();
const store = useMainStore();

// 计算属性
const isDarkMode = computed(() => store.isDarkMode);
const isMobile = computed(() => store.isMobile);
const lang = computed(() => store.lang);
const isSignedIn = computed(() => store.isSignedIn);

// 状态管理
const state = reactive({
  speedTest: {
    id: "speedTest",
    downloadSpeed: "-",
    uploadSpeed: "-",
    latency: "-",
    jitter: "-",
    streamingScore: "-",
    streamingQuality: "-",
    gamingScore: "-",
    gamingQuality: "-",
    rtcScore: "-",
    rtcQuality: "-",
    status: 'idle',
    hasScores: false
  },
  connection: {
    ip: "",
    colo: "",
    loc: "",
    country: "",
    coloCountry: "",
    coloCountryCode: "",
    coloCity: ""
  },
  config: {
    package: {
      download: { bytes: 50e6, count: 4 },
      upload: { bytes: 15e6, count: 4 },
      latency: { count: 30 }
    }
  }
});

const {
  downloadChart,
  uploadChart,
  latencyChart,
  jitterChart,
  updateCharts,
  initStartingPoints,
  destroyCharts,
  resetChartData
} = useSpeedTestCharts(t);

// 连接数据处理
const connectionMethods = {
  async getIPFromSpeedTest() {
    try {
      const response = await fetch("https://speed.cloudflare.com/cdn-cgi/trace");
      const data = await response.text();
      const lines = data.split("\n");

      const ip = lines.find(line => line.startsWith("ip="))?.split("=")[1];
      const colo = lines.find(line => line.startsWith("colo="))?.split("=")[1];
      const loc = lines.find(line => line.startsWith("loc="))?.split("=")[1];

      if (!isValidIP(ip)) {
        throw new Error("Invalid IP from SpeedTest Server");
      }

      // 动态导入 getColoCountry
      const { default: getColoCountry } = await import('@/utils/speedtest-colos.js');

      return {
        ip,
        colo,
        loc,
        country: getCountryName(loc, lang.value) || '',
        coloCountryCode: getColoCountry(colo).country || '',
        coloCity: getColoCountry(colo).city || '',
        coloCountry: getCountryName(getColoCountry(colo).country, lang.value) || ''
      };
    } catch (error) {
      console.error("Error fetching IP from SpeedTest Server:", error);
      return null;
    }
  }
};

// 测试引擎方法
let testEngine;
const engineMethods = {
  reset() {
    state.speedTest.hasScores = false;
    Object.assign(state.speedTest, {
      downloadSpeed: 0,
      uploadSpeed: 0,
      latency: 0,
      jitter: 0,
      streamingScore: "-",
      gamingScore: "-",
      rtcScore: "-"
    });

    // 清理之前的引擎实例的事件监听
    if (testEngine) {
      testEngine = null;
    }

    return markRaw(new SpeedTestEngine({
      autoStart: false,
      measurements: [
        { type: 'latency', numPackets: state.config.package.latency.count },
        { type: 'download', bytes: state.config.package.download.bytes, count: state.config.package.download.count },
        { type: 'upload', bytes: state.config.package.upload.bytes, count: state.config.package.upload.count }
      ]
    }));
  },

  updateResults(results) {
    const summary = results.getSummary();
    Object.assign(state.speedTest, {
      downloadSpeed: parseFloat((summary.download / 1000000).toFixed(2)),
      uploadSpeed: parseFloat((summary.upload / 1000000).toFixed(2)),
      latency: parseFloat(summary.latency.toFixed(2)),
      jitter: parseFloat(summary.jitter.toFixed(2))
    });
  },

  updateProgress() {
    const rawData = testEngine.results.raw;
    const progressPerStage = 100 / 3;
    let progress = 0;

    if (rawData.download?.started) {
      progress += rawData.download.finished ? progressPerStage : progressPerStage / 2;
    }
    if (rawData.upload?.started) {
      progress += rawData.upload.finished ? progressPerStage : progressPerStage / 2;
    }
    if (rawData.latency?.started) {
      progress += rawData.latency.finished ? progressPerStage : progressPerStage / 2;
    }

    progress = Math.min(progress, 100);
    this.updateProgressBar(progress);
  },

  updateProgressBar(progress) {
    const progressBar = document.getElementById('speedtest-progress');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    }
  },

  updateSpeedInRealTime() {
    // 如果测试已结束，不再更新
    if (state.speedTest.status === 'finished' || state.speedTest.status === 'error') {
      return;
    }

    try {
      const rawData = testEngine?.results?.raw;
      if (!rawData) return;
      // 处理延迟数据和计算抖动
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

      // 处理下载速度
      if (rawData.download?.started) {
        if (rawData.download.current?.timings?.length > 0) {
          const timings = rawData.download.current.timings;
          state.speedTest.downloadSpeed = parseFloat((timings[timings.length - 1].bps / 1000000).toFixed(2));
        } else if (rawData.download?.results) {
          const downloadKeys = Object.keys(rawData.download.results);
          if (downloadKeys.length > 0) {
            const lastDownloadKey = downloadKeys[downloadKeys.length - 1];
            const downloadTimings = rawData.download.results[lastDownloadKey].timings;
            if (downloadTimings?.length > 0) {
              const latestTiming = downloadTimings[downloadTimings.length - 1];
              state.speedTest.downloadSpeed = parseFloat((latestTiming.bps / 1000000).toFixed(2));
            }
          }
        } else {
          state.speedTest.downloadSpeed = 0;
        }
      }

      // 处理上传速度
      if (rawData.upload?.started) {
        if (rawData.upload.current?.timings?.length > 0) {
          const timings = rawData.upload.current.timings;
          state.speedTest.uploadSpeed = parseFloat((timings[timings.length - 1].bps / 1000000).toFixed(2));
        } else if (rawData.upload?.results) {
          const uploadKeys = Object.keys(rawData.upload.results);
          if (uploadKeys.length > 0) {
            const lastUploadKey = uploadKeys[uploadKeys.length - 1];
            const uploadTimings = rawData.upload.results[lastUploadKey].timings;
            if (uploadTimings?.length > 0) {
              const latestTiming = uploadTimings[uploadTimings.length - 1];
              state.speedTest.uploadSpeed = parseFloat((latestTiming.bps / 1000000).toFixed(2));
            }
          }
        } else {
          state.speedTest.uploadSpeed = 0;
        }
      }

      // 更新完状态后立即更新图表
      updateCharts(
        state.speedTest.downloadSpeed,
        state.speedTest.uploadSpeed,
        state.speedTest.latency,
        state.speedTest.jitter,
        rawData
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
  }
};

// 成就处理
const achievementHandler = {
  checkAndUpdate() {
    if (state.speedTest.status !== "finished") return;

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

    return achievements.filter(achievement =>
      !store.userAchievements[achievement].achieved);
  },

  triggerAchievementsWithDelay(achievements, delay = 2000) {
    if (!achievements.length) return;

    const achievement = achievements.shift();
    store.setTriggerUpdateAchievements(achievement);

    if (achievements.length) {
      setTimeout(() => this.triggerAchievementsWithDelay(achievements, delay), delay);
    }
  }
};

// 将方法直接暴露给模板使用
const updateSpeedTestColor = (status) => {
  const colorMap = {
    idle: 'text-secondary',
    running: 'text-info',
    paused: 'text-info',
    finished: 'text-success',
    error: 'text-danger'
  };
  return colorMap[status] || '';
};

// 测试控制方法
const setupTestEngine = async () => {
  if (!state.connection.ip) {
    const connectionData = await connectionMethods.getIPFromSpeedTest();
    if (connectionData) {
      Object.assign(state.connection, connectionData);
    }
  }

  testEngine.onRunningChange = () => {
    state.speedTest.status = "running";
  };

  testEngine.onResultsChange = () => {
    engineMethods.updateProgress();
    engineMethods.updateSpeedInRealTime();
  };

  testEngine.onFinish = results => {
    // 先更新状态，防止后续更新
    state.speedTest.status = "finished";

    // 清理事件监听
    testEngine.onRunningChange = null;
    testEngine.onResultsChange = null;
    testEngine.onError = null;

    // 最后一次更新结果
    engineMethods.updateResults(results);

    const scores = results.getScores();
    if (scores?.streaming) {
      state.speedTest.hasScores = true;
      state.speedTest.streamingScore = scores.streaming.points;
      state.speedTest.gamingScore = scores.gaming.points;
      state.speedTest.rtcScore = scores.rtc.points;
      // 根据 Score 分数来判断 Quality 质量
      state.speedTest.streamingQuality = scores.streaming.points >= 50 ? 'Good' : scores.streaming.points >= 10 ? 'Medium' : 'Bad';
      state.speedTest.gamingQuality = scores.gaming.points >= 50 ? 'Good' : scores.gaming.points >= 10 ? 'Medium' : 'Bad';
      state.speedTest.rtcQuality = scores.rtc.points >= 50 ? 'Good' : scores.rtc.points >= 10 ? 'Medium' : 'Bad';
    }

    // 清理引擎实例
    testEngine = null;

    if (isSignedIn.value) {
      achievementHandler.checkAndUpdate();
    }
  };

  testEngine.onError = (e) => {
    if (typeof e === 'string' && !e.includes("ICE")) {
      state.speedTest.status = "error";
    }
    console.error('Speed Test Error: ', e);
  };
};

const speedTestController = async () => {
  try {
    if (state.speedTest.status === 'running') {
      testEngine.pause();
      state.speedTest.status = "paused";
      return;
    }

    if (state.speedTest.status === 'paused') {
      testEngine.play();
      return;
    }

    // 重置图表数据
    resetChartData();
    destroyCharts();

    // 初始化图表并设置起始点
    await initStartingPoints();

    Object.assign(state.speedTest, {
      downloadSpeed: 0,
      uploadSpeed: 0,
      latency: 0,
      jitter: 0,
      streamingScore: "-",
      gamingScore: "-",
      rtcScore: "-",
      hasScores: false
    });

    testEngine = engineMethods.reset();
    if (!testEngine) {
      console.error('Failed to initialize test engine');
      return;
    }

    await setupTestEngine();
    trackEvent('Section', 'StartClick', 'SpeedTest');
    testEngine.play();
  } catch (error) {
    console.error('Error in speedTestController:', error);
    state.speedTest.status = "error";
  }
};

// 生命周期
onMounted(() => {
  store.setMountingStatus('speedtest', true);
});

// 清理
onUnmounted(() => {
  if (testEngine) {
    testEngine = null;
  }
  destroyCharts();
});

// 暴露方法
defineExpose({
  speedTestController
});
</script>

<style scoped>
.jn-startbtn {
  background-color: rgb(248, 249, 250);
  border-color: rgb(222, 226, 230);
}

.jn-startbtn-dark {
  background-color: rgb(20, 22, 24);
  border-color: rgb(73, 80, 87);
}

.jn-startbtn-dark:hover {
  color: var(--bs-btn-hover-color);
  background-color: rgba(0, 0, 0, 0.33);
}


.jn-startbtn:hover {
  color: var(--bs-btn-hover-color);
  background-color: var(--bs-btn-hover-bg);
  border-color: var(--bs-btn-hover-border-color);
}

.jn-text-warning {
  --bs-text-opacity: 1;
  color: #c67c14;
}

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

.jn-slide-in {
  animation: slide-in 0.2s ease-in forwards;
}

@keyframes slide-in {
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
