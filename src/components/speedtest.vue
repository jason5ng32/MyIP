<template>
  <!-- Speed Test -->
  <div class="speed-test-section mb-4">
    <div class="jn-title2">
      <h2 id="SpeedTest" :class="{ 'mobile-h2': isMobile }">🚀 {{ $t('speedtest.Title') }}</h2>

    </div>
    <div class="text-secondary">
      <p>{{ $t('speedtest.Note') }}</p>
    </div>
    <div class="row">
      <div class="col-12 mb-3">
        <div class="card jn-card keyboard-shortcut-card" :class="{ 'dark-mode dark-mode-border': isDarkMode }">
          <div class="card-body">

            <div class="row justify-content-end mt-3 mb-4" :data-bs-theme="isDarkMode ? 'dark' : ''">
              <div class="input-group" :class="[isMobile ? 'w-100' : 'w-50']">
                <span class="input-group-text"><i class="bi bi-cloud-download"></i></span>
                <select class="form-select" :class="{ 'jn-ip-font': isMobile }" id="downloadBytes"
                  :disabled="speedTestStatus === 'running' || speedTestStatus === 'paused'"
                  v-model="packageSize.download.bytes">
                  <option :value="100e6">100 MB</option>
                  <option :value="50e6">50 MB</option>
                  <option :value="15e6">15 MB</option>
                  <option :value="10e6">10 MB</option>
                  <option :value="1e6">1 MB</option>
                </select>
                <span class="input-group-text"><i class="bi bi-cloud-upload"></i></span>
                <select class="form-select" :class="{ 'jn-ip-font': isMobile }" id="uploadBytes"
                  :disabled="speedTestStatus === 'running' || speedTestStatus === 'paused'"
                  v-model="packageSize.upload.bytes">
                  <option :value="100e6">100 MB</option>
                  <option :value="50e6">50 MB</option>
                  <option :value="15e6">15 MB</option>
                  <option :value="10e6">10 MB</option>
                  <option :value="1e6">1 MB</option>
                </select>
                <button @click="speedTestController" class="btn-primary btn" aria-label="Start/Pause Speed Test"
                  v-tooltip="{ title: $t('Tooltips.SpeedTestButton'), placement: 'top' }">
                  <span v-if="speedTestStatus === 'running'">
                    <i class="bi bi-pause-fill"></i>
                  </span>
                  <span v-else-if="speedTestStatus === 'finished' || speedTestStatus === 'error'">
                    <i class="bi bi-arrow-clockwise"></i>
                  </span>
                  <span v-else><i class="bi bi-caret-right-fill"></i></span>
                </button>
              </div>
            </div>

            <div class="progress" style="height: 20px; margin: 4pt 0 20pt 0;"
              :class="{ 'jn-opacity-0': speedTestStatus == 'idle', 'jn-progress-dark': isDarkMode }">
              <div class="progress-bar progress-bar-striped jn-progress"
                :class="[speedTestStatus === 'finished' ? 'bg-success' : 'bg-info progress-bar-animated']"
                role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"
                id="speedtest-progress" aria-label="Progress Bar">
              </div>
            </div>
            <div class="row" style="margin-bottom: 10pt;">
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Download') }}</p>
                <p id="download-speed" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.downloadSpeed }}</span>
                  <span v-if="speedTestStatus !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Upload') }}</p>
                <p id="upload-speed" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.uploadSpeed }}</span>
                  <span v-if="speedTestStatus !== 'idle'">Mb/s</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Latency') }}</p>
                <p id="latency" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.latency }}</span>
                  <span v-if="speedTestStatus !== 'idle'">ms</span>
                </p>
              </div>
              <div :class="['text-center', isMobile ? 'col-6' : 'col-3']">
                <p class="speedtest-h5 jn-con-title">{{ $t('speedtest.Jitter') }}</p>
                <p id="jitter" class="speedtest-h5" :class="updateSpeedTestColor(speedTestStatus)">
                  <span class="jn-speedtest-number">{{ speedTest.jitter }}</span>
                  <span v-if="speedTestStatus !== 'idle'">ms</span>
                </p>
              </div>
            </div>
            <div class="row alert alert-success m-1 p-2 " :data-bs-theme="isDarkMode ? 'dark' : ''"
              v-if="speedTestStatus === 'finished' && hasScores">
              <p id="score" class="speedtest-p"><i class="bi bi-calendar2-check"></i> {{ $t('speedtest.score') }}
                {{ $t('speedtest.videoStreaming') }}
                <span :class="speedTest.streamingScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.streamingScore }}
                </span>
                {{ $t('speedtest.gaming') }}
                <span :class="speedTest.gamingScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.gamingScore }}
                </span>
                {{ $t('speedtest.rtc') }}
                <span :class="speedTest.rtcScore >= 50 ? 'text-success' : 'text-warning'">
                  {{ speedTest.rtcScore }}
                </span>
                {{ $t('speedtest.resultNote') }}
              </p>
            </div>
            <div id="result"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, markRaw } from 'vue';
import { useStore } from 'vuex';

// 引入 SpeedTest
import SpeedTestEngine from '@cloudflare/speedtest';

export default {
  name: 'SpeedTest',

  // 引入 Store
  setup() {
    const store = useStore();
    const isDarkMode = computed(() => store.state.isDarkMode);
    const isMobile = computed(() => store.state.isMobile);

    return {
      isDarkMode,
      isMobile,
    };
  },

  data() {
    return {
      speedTest: {
        id: "speedTest",
        downloadSpeed: "-",
        uploadSpeed: "-",
        latency: "-",
        jitter: "-",
        streamingScore: "-",
        gamingScore: "-",
        rtcScore: "-",
      },
      speedTestStatus: 'idle',
      packageSize: {
        download: {
          bytes: 50e6,
          count: 4,
        },
        upload: {
          bytes: 15e6,
          count: 4,
        },
        latency: {
          count: 20,
        }
      },
      testEngine: null,
      hasScores: false,
    };
  },

  methods: {

    // 更新 Speed Test 结果
    updateSpeedTestResults(results) {
      const summary = results.getSummary();

      this.speedTest.downloadSpeed = parseFloat((summary.download / 1000000).toFixed(2));
      this.speedTest.uploadSpeed = parseFloat((summary.upload / 1000000).toFixed(2));
      this.speedTest.latency = parseFloat(summary.latency.toFixed(2));
      this.speedTest.jitter = parseFloat(summary.jitter.toFixed(2));
    },

    // 更新 Speed Test 进度条颜色
    updateSpeedTestColor(status) {
      switch (status) {
        case 'idle':
          return 'text-secondary';
        case 'running':
          return 'text-info';
        case 'paused':
          return 'text-info';
        case 'finished':
          return 'text-success';
        case 'error':
          return 'text-danger';
        default:
          return '';
      }
    },

    // 重置 Speed Test
    resetSpeedTest() {
      this.hasScores = false;
      const engine = new SpeedTestEngine({
        autoStart: false,
        measurements: [
          { type: 'latency', numPackets: this.packageSize.latency.count },
          { type: 'download', bytes: this.packageSize.download.bytes, count: this.packageSize.download.count },
          { type: 'upload', bytes: this.packageSize.upload.bytes, count: this.packageSize.upload.count }
        ]
      });
      return markRaw(engine);
    },

    speedTestController() {
      if (this.speedTestStatus === 'running') {
        this.testEngine.pause();
        this.speedTestStatus = "paused";
      } else {
        this.startSpeedTest();
      }
    },

    // 开始 Speed Test
    startSpeedTest() {

      // 暂停继续
      if (this.speedTestStatus === 'paused') {
        this.testEngine.play();
        return;
      }

      // 初始化
      this.testEngine = this.resetSpeedTest();

      // 仅在初始化时定义数据
      if (!this.testEngine.isRunning) {
        this.speedTest.downloadSpeed = 0;
        this.speedTest.uploadSpeed = 0;
        this.speedTest.latency = 0;
        this.speedTest.jitter = 0;
      }

      this.testEngine.onRunningChange = running => {
        this.speedTestStatus = "running";
      };

      this.$trackEvent('Section', 'StartClick', 'SpeedTest');
      this.testEngine.play();

      this.testEngine.onResultsChange = ({ type }) => {
        this.progressBarChange();
        this.SpeedChange();
      }
      this.showResult();
    },

    // 修改进度条
    progressBarChange() {
      const rawData = this.testEngine.results.raw;
      // 进度条
      let progress = 0;
      const progressPerStage = 100 / 3;  // 将总进度平均分配到每个阶段

      if (rawData.download && rawData.download.started) {
        progress += rawData.download.finished ? progressPerStage : progressPerStage / 2;
      }
      if (rawData.upload && rawData.upload.started) {
        progress += rawData.upload.finished ? progressPerStage : progressPerStage / 2;
      }
      if (rawData.latency && rawData.latency.started) {
        progress += rawData.latency.finished ? progressPerStage : progressPerStage / 2;
      }

      // 确保进度不超过100%
      progress = Math.min(progress, 100);

      // 更新进度条
      const progressBar = document.getElementById('speedtest-progress');
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute('aria-valuenow', progress);
    },

    SpeedChange() {
      const rawData = this.testEngine.results.raw;

      // 更新下载速度
      if (rawData.download && rawData.download.results) {
        const downloadKeys = Object.keys(rawData.download.results);
        if (downloadKeys.length > 0) {
          const lastDownloadKey = downloadKeys[downloadKeys.length - 1];
          const downloadTimings = rawData.download.results[lastDownloadKey].timings;
          if (downloadTimings.length > 0) {
            const latestDownload = downloadTimings[downloadTimings.length - 1];
            const newDownloadSpeed = parseFloat((latestDownload.bps / 1000000).toFixed(2));
            if (newDownloadSpeed > this.speedTest.downloadSpeed) {
              this.speedTest.downloadSpeed = newDownloadSpeed;
            }
          }
        }
      }
      // 更新上传速度
      if (rawData.upload && rawData.upload.results) {
        const uploadKeys = Object.keys(rawData.upload.results);
        if (uploadKeys.length > 0) {
          const lastUploadKey = uploadKeys[uploadKeys.length - 1];
          const uploadTimings = rawData.upload.results[lastUploadKey].timings;
          if (uploadTimings.length > 0) {
            const latestUpload = uploadTimings[uploadTimings.length - 1];
            const newUploadSpeed = parseFloat((latestUpload.bps / 1000000).toFixed(2));
            if (newUploadSpeed > this.speedTest.uploadSpeed) {
              this.speedTest.uploadSpeed = newUploadSpeed;
            }
          }
        }
      }
      // 更新延迟
      if (rawData.latency && rawData.latency.results && rawData.latency.results.timings && rawData.latency.results.timings.length > 0) {
        const latencyTimings = rawData.latency.results.timings;
        const latestLatency = latencyTimings[latencyTimings.length - 1].ping;
        const newLatency = parseFloat(latestLatency.toFixed(2));
        if (newLatency < this.speedTest.latency || this.speedTest.latency === 0) {
          this.speedTest.latency = newLatency;
        }
      }
    },


    showResult() {
      this.testEngine.onFinish = results => {
        this.speedTestStatus = "finished";
        this.updateSpeedTestResults(results);
        const scores = results.getScores().streaming ? results.getScores() : '';

        if (scores) {
          this.hasScores = true;
          // 更新 Vue 实例的数据属性
          this.speedTest.streamingScore = scores.streaming.points;
          this.speedTest.gamingScore = scores.gaming.points;
          this.speedTest.rtcScore = scores.rtc.points;
        }
      };

      this.testEngine.onError = (e) => {
        if (typeof e === 'string' && !e.includes("ICE")) {
          this.speedTestStatus = "error";
        }
        console.error('Speed Test Error: ', e);
      };
    },

  },

  mounted() {
  }
}
</script>

<style scoped></style>
