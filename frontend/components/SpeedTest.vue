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
            <div class="row alert alert-success m-1 p-2 " :data-bs-theme="isDarkMode ? 'dark' : ''"
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
                <span :class="state.speedTest.streamingScore >= 50 ? 'text-success' : 'jn-text-warning'">
                  {{ state.speedTest.streamingScore }}
                </span>
                {{ t('speedtest.gaming') }}
                <span :class="state.speedTest.gamingScore >= 50 ? 'text-success' : 'jn-text-warning'">
                  {{ state.speedTest.gamingScore }}
                </span>
                {{ t('speedtest.rtc') }}
                <span :class="state.speedTest.rtcScore >= 50 ? 'text-success' : 'jn-text-warning'">
                  {{ state.speedTest.rtcScore }}
                </span>
                {{ t('speedtest.resultNote') }}
              </p>
            </div>
            <div id="result"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, markRaw } from 'vue';
import { useMainStore } from '@/store';
import { useI18n } from 'vue-i18n';
import { trackEvent } from '@/utils/use-analytics';
import { isValidIP } from '@/utils/valid-ip.js';
import getCountryName from '@/utils/country-name.js';
import getColoCountry from '@/utils/speedtest-colos.js';
import SpeedTestEngine from '@cloudflare/speedtest';

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
    gamingScore: "-",
    rtcScore: "-",
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
      latency: { count: 20 }
    }
  }
});

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
    const rawData = testEngine.results.raw;
    if (rawData.download?.results) {
      const downloadKeys = Object.keys(rawData.download.results);
      if (downloadKeys.length > 0) {
        const lastDownloadKey = downloadKeys[downloadKeys.length - 1];
        const downloadTimings = rawData.download.results[lastDownloadKey].timings;
        if (downloadTimings.length > 0) {
          state.speedTest.downloadSpeed = parseFloat((downloadTimings[downloadTimings.length - 1].bps / 1000000).toFixed(2));
        }
      }
    }

    if (rawData.upload?.results) {
      const uploadKeys = Object.keys(rawData.upload.results);
      if (uploadKeys.length > 0) {
        const lastUploadKey = uploadKeys[uploadKeys.length - 1];
        const uploadTimings = rawData.upload.results[lastUploadKey].timings;
        if (uploadTimings.length > 0) {
          state.speedTest.uploadSpeed = parseFloat((uploadTimings[uploadTimings.length - 1].bps / 1000000).toFixed(2));
        }
      }
    }

    if (rawData.latency?.results?.timings?.length > 0) {
      const latencyTimings = rawData.latency.results.timings;
      state.speedTest.latency = parseFloat(latencyTimings[latencyTimings.length - 1].ping.toFixed(2));
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
    state.speedTest.status = "finished";
    engineMethods.updateResults(results);

    const scores = results.getScores();
    if (scores?.streaming) {
      state.speedTest.hasScores = true;
      state.speedTest.streamingScore = scores.streaming.points;
      state.speedTest.gamingScore = scores.gaming.points;
      state.speedTest.rtcScore = scores.rtc.points;
    }

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
  if (state.speedTest.status === 'running') {
    testEngine.pause();
    state.speedTest.status = "paused";
    return;
  }

  if (state.speedTest.status === 'paused') {
    testEngine.play();
    return;
  }

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
  await setupTestEngine();

  trackEvent('Section', 'StartClick', 'SpeedTest');
  testEngine.play();
};

// 生命周期
onMounted(() => {
  store.setMountingStatus('speedtest', true);
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
</style>
